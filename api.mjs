import express from 'express';
import session from 'express-session';
import createMySQLStore from 'express-mysql-session';
import {Passport} from 'passport';
import {Strategy} from 'passport-local';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {rows,transaction} from './db.mjs';
import {token,digest,hashPassword,verifyPassword,validatePassword,username,email,text,fail,canAccess,transitions} from './auth-security.mjs';
import {audit,recoveryCodes,hasMail,deliverToken} from './accounts.mjs';
import {facilities} from './dist/data.js';

const publicUser=u=>({id:u.id,role:u.role,username:u.username,name:u.name,official_email:u.official_email});
const generic='Invalid credentials or account unavailable.';
const regenerate=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
export async function createApp(pool,{rateLimitNamespace=''}={}) {
  if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32||process.env.SESSION_SECRET.startsWith('replace-')) throw Error('Configure a random SESSION_SECRET of at least 32 characters.');
  const app=express(),passport=new Passport();
  const store=new (createMySQLStore(session))({createDatabaseTable:false,clearExpired:true,expiration:8*60*60*1000},pool);
  const dummy=await hashPassword(token());
  app.disable('x-powered-by');
  // Diagnose the real browser's login latency without recording credentials or identifiers.
  app.use('/api/auth/staff-login',(req,res,next)=>{
    if(req.method==='POST'){
      const started=performance.now();
      res.once('finish',()=>console.info(`Staff sign-in: HTTP ${res.statusCode}, ${Math.round(performance.now()-started)} ms on server`));
    }
    next();
  });
  app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});next();});
  app.use('/api',express.json({limit:'16kb'}));
  const portalSessions=Object.fromEntries(['citizen','staff'].map(portal=>[portal,session({name:`js.${portal}.sid`,secret:process.env.SESSION_SECRET,store,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*60*60*1000}})]));
  app.use('/api',(req,res,next)=>{
    req.portal=req.get('X-Portal')||'citizen';
    if(!Object.hasOwn(portalSessions,req.portal))return next(Object.assign(Error('Unknown portal.'),{status:400}));
    portalSessions[req.portal](req,res,next);
  });
  app.use('/api',passport.initialize());
  app.use('/api',async(req,res,next)=>{
    res.set('Cache-Control','no-store'); req.session.csrf||=token();
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const expected=Buffer.from(req.session.csrf),actual=Buffer.from(req.get('X-CSRF-Token')||''),origin=req.get('Origin');
      if((origin&&origin!==(process.env.APP_ORIGIN||'http://127.0.0.1:4173'))||expected.length!==actual.length||!timingSafeEqual(expected,actual)) fail(403,'Refresh the page and try again (CSRF validation failed).');
    }
    if(req.session.uid) {
      const [u]=await rows(pool,'SELECT * FROM users WHERE id=?',[req.session.uid]);
      if(u?.status==='ACTIVE'&&u.session_version===req.session.version&&req.session.issued>Date.now()-8*60*60*1000&&req.session.portal===req.portal&&(u.role==='CITIZEN')===(req.portal==='citizen')) req.user=u;
      else {delete req.session.uid;delete req.session.version;}
    }
    next();
  });
  function roles(...allowed) {return(req,res,next)=>{
    if(!req.user) fail(401,'Sign in to continue.');
    if(!allowed.includes(req.user.role)) fail(403,'Access denied.');
    if(req.user.role!=='CITIZEN'&&(process.env.NODE_ENV==='production'||process.env.ALLOW_LOCAL_STAFF_WITHOUT_MFA!=='true')) fail(403,'Staff MFA is required. See local setup instructions.');
    next();
  };}
  const citizen=roles('CITIZEN'),admin=roles('ADMIN'),authenticated=roles('CITIZEN','OFFICER','ADMIN');
  // Persistent buckets use the socket IP; forwarded headers are not trusted.
  const limit=(scope,max)=>async(req,res,next)=>{
    const bucket=digest(`${rateLimitNamespace}:${scope}:${req.ip}`),now=Date.now(),expiry=now+900000;
    await rows(pool,'INSERT INTO auth_limits(bucket,attempts,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE attempts=IF(expires_at<?,1,attempts+1),expires_at=IF(expires_at<?,?,expires_at)',[bucket,expiry,now,now,expiry]);
    const [entry]=await rows(pool,'SELECT attempts FROM auth_limits WHERE bucket=?',[bucket]);
    if(entry.attempts>max){res.set('Retry-After','900');fail(429,'Too many attempts. Try again in 15 minutes.');} next();
  };
  async function signedIn(req,u){
    if((u.role==='CITIZEN')!==(req.portal==='citizen'))fail(403,'Use the correct sign-in portal for this account.');
    await regenerate(req);Object.assign(req.session,{uid:u.id,portal:req.portal,version:u.session_version,issued:Date.now(),csrf:token()});await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
  }
  // Every protected write rechecks and locks its actor, including session revocation.
  const write=(req,work)=>transaction(pool,async db=>{
    const [u]=await rows(db,'SELECT * FROM users WHERE id=? FOR UPDATE',[req.user.id]);
    if(u?.status!=='ACTIVE'||u.session_version!==req.session.version) fail(401,'Sign in again.');
    return work(db,u);
  });
  passport.use(new Strategy({usernameField:'identifier',passwordField:'password',passReqToCallback:true},async(req,identifier,password,done)=>{
    try{
      const staff=req.path==='/api/auth/staff-login';
      const normalized=typeof identifier==='string'?identifier.trim().toLowerCase().slice(0,254):'';
      const [u]=await rows(pool,staff?"SELECT * FROM users WHERE official_email=? AND role IN ('OFFICER','ADMIN')":"SELECT * FROM users WHERE username=? AND role='CITIZEN'",[normalized]);
      const valid=typeof password==='string'&&password.length<=512&&await verifyPassword(u?.password_hash||dummy,password);
      done(null,valid&&u?.status==='ACTIVE'?u:false);
    }catch(e){done(e);}
  }));
  app.get('/api/auth/session',(req,res)=>res.json({user:req.user?publicUser(req.user):null,csrf:req.session.csrf,localPrototype:true}));
  app.post('/api/auth/register',limit('register',10),async(req,res)=>{
    if(req.portal!=='citizen')fail(403,'Use citizen registration.');
    const name=username(req.body.username);await validatePassword(req.body.password,req.body.confirmation);
    const hash=await hashPassword(req.body.password),id=randomUUID();
    const codes=await transaction(pool,async db=>{
      // Never read a public request's role, department, jurisdiction or permissions.
      await rows(db,"INSERT INTO users(id,role,username,password_hash,status) VALUES (?,'CITIZEN',?,?,'ACTIVE')",[id,name,hash]);
      await audit(db,id,'REGISTER','user',id);return recoveryCodes(db,id);
    });
    const [u]=await rows(pool,'SELECT * FROM users WHERE id=?',[id]);await signedIn(req,u);res.status(201).json({user:publicUser(u),csrf:req.session.csrf,codes});
  });
  app.post(['/api/auth/login','/api/auth/staff-login'],limit('login',20),(req,res,next)=>{
    passport.authenticate('local',{session:false},async(error,u)=>{
      try{
        if(error) throw error;if(!u) fail(401,generic);
        if(u.role!=='CITIZEN'&&(process.env.NODE_ENV==='production'||process.env.ALLOW_LOCAL_STAFF_WITHOUT_MFA!=='true')) fail(403,'Staff MFA is required. See local setup instructions.');
        await signedIn(req,u);await audit(pool,u.id,'LOGIN','user',u.id);res.json({user:publicUser(u),csrf:req.session.csrf});
      }catch(e){next(e);}
    })(req,res,next);
  });
  app.post('/api/auth/logout',async(req,res)=>{await new Promise((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));res.clearCookie(`js.${req.portal}.sid`,{path:'/'}).json({ok:true});});
  app.post('/api/auth/password',authenticated,limit('password',10),async(req,res)=>{
    await validatePassword(req.body.password,req.body.confirmation);const hash=await hashPassword(req.body.password);
    const u=await write(req,async(db,u)=>{
      if(typeof req.body.current_password!=='string'||!await verifyPassword(u.password_hash,req.body.current_password)) fail(400,'Current password is incorrect.');
      await rows(db,'UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',[hash,u.id]);
      await rows(db,"DELETE FROM account_tokens WHERE user_id=? AND kind='STAFF_RESET'",[u.id]);
      await audit(db,u.id,'PASSWORD_CHANGED','user',u.id);return {...u,session_version:u.session_version+1};
    });await signedIn(req,u);res.json({ok:true,csrf:req.session.csrf});
  });
  app.post('/api/auth/recovery-codes',citizen,limit('password',10),async(req,res)=>{
    const codes=await write(req,async(db,u)=>{
      if(typeof req.body.current_password!=='string'||!await verifyPassword(u.password_hash,req.body.current_password)) fail(400,'Current password is incorrect.');
      await audit(db,u.id,'RECOVERY_CODES_REGENERATED','user',u.id);return recoveryCodes(db,u.id);
    });res.json({codes});
  });
  app.post('/api/auth/recover',limit('recovery',10),async(req,res)=>{
    const name=username(req.body.username),code=text(req.body.code,100);await validatePassword(req.body.password,req.body.confirmation);const hash=await hashPassword(req.body.password);
    await transaction(pool,async db=>{
      const [u]=await rows(db,"SELECT * FROM users WHERE username=? AND role='CITIZEN' FOR UPDATE",[name]);if(!u||u.status!=='ACTIVE') fail(400,generic);
      const result=await rows(db,"UPDATE account_tokens SET used_at=UTC_TIMESTAMP(3) WHERE user_id=? AND kind='RECOVERY' AND token_hash=? AND used_at IS NULL",[u.id,digest(code)]);
      if(result.affectedRows!==1) fail(400,generic);
      await rows(db,'UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',[hash,u.id]);await audit(db,u.id,'PASSWORD_RECOVERED','user',u.id);
    });res.json({ok:true});
  });
  app.post('/api/auth/staff-forgot',limit('recovery',10),async(req,res)=>{
    const address=email(req.body.email);if(!hasMail()) fail(503,'Email is not configured. For local testing use npm run auth:dev-link.');
    const [u]=await rows(pool,"SELECT * FROM users WHERE official_email=? AND role IN ('OFFICER','ADMIN') AND status='ACTIVE'",[address]);
    if(u){try{await deliverToken(pool,u,'STAFF_RESET');}catch{/* Generic response avoids account disclosure and leaking mail errors. */}}
    res.json({ok:true,message:'If an active account matches, a reset link will be sent to its official email.'});
  });
  app.post(['/api/auth/invitation','/api/auth/staff-reset'],limit('tokens',10),async(req,res)=>{
    const secret=text(req.body.token,100),kind=req.path.endsWith('/invitation')?'INVITATION':'STAFF_RESET';
    await validatePassword(req.body.password,req.body.confirmation);const hash=await hashPassword(req.body.password);
    await transaction(pool,async db=>{
      const [candidate]=await rows(db,'SELECT user_id FROM account_tokens WHERE token_hash=? AND kind=?',[digest(secret),kind]);if(!candidate) fail(400,'Link is invalid or expired.');
      const [u]=await rows(db,'SELECT * FROM users WHERE id=? FOR UPDATE',[candidate.user_id]);
      if(!u||u.role==='CITIZEN'||u.status!==(kind==='INVITATION'?'PENDING':'ACTIVE')) fail(400,'Link is invalid or expired.');
      const result=await rows(db,'UPDATE account_tokens SET used_at=UTC_TIMESTAMP(3) WHERE token_hash=? AND kind=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP(3)',[digest(secret),kind]);if(result.affectedRows!==1) fail(400,'Link is invalid or expired.');
      // Setup does not approve an officer. An administrator must explicitly activate the account.
      await rows(db,'UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',[hash,u.id]);await audit(db,u.id,kind==='INVITATION'?'INVITATION_ACCEPTED':'STAFF_PASSWORD_RESET','user',u.id);
    });res.json({ok:true});
  });
  app.get('/api/catalog',authenticated,async(req,res)=>res.json({departments:await rows(pool,'SELECT * FROM departments ORDER BY name'),jurisdictions:await rows(pool,'SELECT * FROM jurisdictions ORDER BY name')}));
  app.get('/api/complaints',authenticated,async(req,res)=>{
    const u=req.user,where=u.role==='CITIZEN'?'WHERE citizen_id=?':u.role==='OFFICER'?'WHERE assigned_officer_id=? AND department_id=? AND jurisdiction_id=?':'';
    const values=u.role==='CITIZEN'?[u.id]:u.role==='OFFICER'?[u.id,u.department_id,u.jurisdiction_id]:[];
    res.json(await rows(pool,`SELECT id,facility,category,description,status,department_id,jurisdiction_id,created_at FROM complaints ${where} ORDER BY created_at DESC LIMIT 500`,values));
  });
  app.post('/api/complaints',citizen,limit('complaints',30),async(req,res)=>{
    const facility=text(req.body.facility,80),category=text(req.body.category,80),description=text(req.body.description,1500,10),department=text(req.body.department_id,36),jurisdiction=text(req.body.jurisdiction_id,36),id=randomUUID();
    if(!facilities.some(f=>f.id===facility)) fail(400,'Choose a listed facility.');
    await write(req,async(db,u)=>{await rows(db,'INSERT INTO complaints(id,citizen_id,facility,category,description,department_id,jurisdiction_id) VALUES (?,?,?,?,?,?,?)',[id,u.id,facility,category,description,department,jurisdiction]);await audit(db,u.id,'COMPLAINT_CREATED','complaint',id);});res.status(201).json({id});
  });
  app.get('/api/complaints/:id',authenticated,async(req,res)=>{
    const [c]=await rows(pool,'SELECT * FROM complaints WHERE id=?',[req.params.id]);if(!c||!canAccess(req.user,c)) fail(404,'Complaint not found.');
    const updates=await rows(pool,`SELECT note,visibility,previous_status,new_status,created_at FROM complaint_updates WHERE complaint_id=? ${req.user.role==='CITIZEN'?"AND visibility='PUBLIC'":''} ORDER BY created_at`,[c.id]);
    res.json({id:c.id,facility:c.facility,category:c.category,description:c.description,status:c.status,department_id:c.department_id,jurisdiction_id:c.jurisdiction_id,created_at:c.created_at,updates});
  });
  app.post('/api/complaints/:id/updates',roles('OFFICER','ADMIN'),async(req,res)=>{
    const note=text(req.body.note,1500),visibility=req.body.visibility,status=req.body.status;if(!['PUBLIC','INTERNAL'].includes(visibility)) fail(400,'Choose note visibility.');
    await write(req,async(db,u)=>{
      const [c]=await rows(db,'SELECT * FROM complaints WHERE id=? FOR UPDATE',[req.params.id]);if(!c||!canAccess(u,c)) fail(404,'Complaint not found.');
      if(status!==c.status&&!transitions[c.status]?.includes(status)) fail(400,'This status transition is not permitted.');
      if(status==='Resolved'&&c.status!=='Resolved') fail(400,'Resolution requires evidence support, which is not yet implemented.');
      await rows(db,'INSERT INTO complaint_updates(id,complaint_id,actor_id,note,visibility,previous_status,new_status) VALUES (?,?,?,?,?,?,?)',[randomUUID(),c.id,u.id,note,visibility,c.status,status]);
      await rows(db,'UPDATE complaints SET status=? WHERE id=?',[status,c.id]);await audit(db,u.id,'COMPLAINT_UPDATED','complaint',c.id);
    });res.json({ok:true});
  });
  app.get('/api/admin/officers',admin,async(req,res)=>res.json(await rows(pool,"SELECT id,name,official_email,department_id,jurisdiction_id,status,(password_hash IS NOT NULL) AS setup_complete FROM users WHERE role='OFFICER' ORDER BY name")));
  app.post('/api/admin/officers',admin,async(req,res)=>{
    const u={id:randomUUID(),name:text(req.body.name),official_email:email(req.body.official_email),department_id:text(req.body.department_id,36),jurisdiction_id:text(req.body.jurisdiction_id,36)};
    await write(req,async(db,actor)=>{await rows(db,"INSERT INTO users(id,role,name,official_email,department_id,jurisdiction_id,status) VALUES (?,'OFFICER',?,?,?,?,'PENDING')",[u.id,u.name,u.official_email,u.department_id,u.jurisdiction_id]);await audit(db,actor.id,'OFFICER_CREATED','user',u.id);});
    let message='Pending account created. Use npm run auth:dev-link in your terminal for a development invitation.';
    if(hasMail()){try{await deliverToken(pool,u,'INVITATION');message='Invitation sent to official email.';}catch{message='Account created, but delivery failed. Retry the invitation.';}}
    res.status(201).json({id:u.id,message});
  });
  app.post('/api/admin/officers/:id/invite',admin,limit('invitations',10),async(req,res)=>{
    const [u]=await rows(pool,"SELECT * FROM users WHERE id=? AND role='OFFICER' AND status='PENDING'",[req.params.id]);if(!u) fail(404,'Pending officer not found.');
    await deliverToken(pool,u,'INVITATION');await audit(pool,req.user.id,'INVITATION_SENT','user',u.id);res.json({ok:true,message:'Invitation sent.'});
  });
  app.patch('/api/admin/officers/:id',admin,async(req,res)=>{
    const name=text(req.body.name),department=text(req.body.department_id,36),jurisdiction=text(req.body.jurisdiction_id,36),status=req.body.status;if(!['ACTIVE','DISABLED','PENDING'].includes(status)) fail(400,'Invalid account status.');
    await write(req,async(db,actor)=>{
      const [u]=await rows(db,"SELECT * FROM users WHERE id=? AND role='OFFICER' FOR UPDATE",[req.params.id]);if(!u) fail(404,'Officer not found.');if(status==='ACTIVE'&&!u.password_hash) fail(400,'Officer must accept the invitation before approval.');
      await rows(db,'UPDATE users SET name=?,department_id=?,jurisdiction_id=?,status=?,session_version=session_version+1 WHERE id=?',[name,department,jurisdiction,status,u.id]);await audit(db,actor.id,'OFFICER_UPDATED','user',u.id);
    });res.json({ok:true});
  });
  app.post('/api/admin/complaints/:id/assign',admin,async(req,res)=>{
    const officer=text(req.body.officer_id,36);
    await write(req,async(db,u)=>{
      const [o]=await rows(db,'SELECT * FROM users WHERE id=? FOR UPDATE',[officer]);const [c]=await rows(db,'SELECT * FROM complaints WHERE id=? FOR UPDATE',[req.params.id]);if(!c) fail(404,'Complaint not found.');
      if(!o||o.role!=='OFFICER'||o.status!=='ACTIVE'||o.department_id!==c.department_id||o.jurisdiction_id!==c.jurisdiction_id) fail(400,'Choose an active officer in the same department and jurisdiction.');
      if(['Resolved','Closed','Rejected'].includes(c.status)) fail(400,'Cannot assign a completed complaint.');
      await rows(db,"UPDATE complaints SET assigned_officer_id=?,status='Assigned' WHERE id=?",[officer,c.id]);await rows(db,"INSERT INTO complaint_updates(id,complaint_id,actor_id,note,visibility,previous_status,new_status) VALUES (?,?,?,'Assigned to an officer','PUBLIC',?,'Assigned')",[randomUUID(),c.id,u.id,c.status]);await audit(db,u.id,'COMPLAINT_ASSIGNED','complaint',c.id);
    });res.json({ok:true});
  });
  for(const table of ['departments','jurisdictions']){
    app.post(`/api/admin/${table}`,admin,async(req,res)=>{const id=randomUUID(),name=text(req.body.name);await write(req,async(db,u)=>{await rows(db,`INSERT INTO ${table}(id,name) VALUES (?,?)`,[id,name]);await audit(db,u.id,'CATALOG_CREATED',table,id);});res.status(201).json({id});});
    app.patch(`/api/admin/${table}/:id`,admin,async(req,res)=>{const name=text(req.body.name);await write(req,async(db,u)=>{const result=await rows(db,`UPDATE ${table} SET name=? WHERE id=?`,[name,req.params.id]);if(!result.affectedRows) fail(404,'Entry not found.');await audit(db,u.id,'CATALOG_UPDATED',table,req.params.id);});res.json({ok:true});});
  }
  app.get('/api/admin/audit',admin,async(req,res)=>res.json(await rows(pool,'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200')));
  app.use('/api',(req,res)=>res.status(404).json({message:'Endpoint not found.'}));
  app.use(express.static('dist',{dotfiles:'deny'}));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=error.code==='ER_DUP_ENTRY'?409:error.code==='ER_NO_REFERENCED_ROW_2'?400:error.status||500;
    // Driver errors may contain query parameters. Only log the error class/code.
    if(status>=500)console.error('Account service failure:',error.code||error.name);
    res.status(status).json({message:status===409?'That username, email or name is already in use.':error.code==='ER_NO_REFERENCED_ROW_2'?'Choose an existing department and jurisdiction.':status>=500?'Service unavailable. Check server configuration or try again later.':error.message});
  });
  return {app,store};
}

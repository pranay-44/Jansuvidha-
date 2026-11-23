import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {token,hashPassword,fail} from './auth-security.mjs';
import {rows,transaction} from './db.mjs';
import {audit} from './accounts.mjs';

export function providerConfig(provider,env=process.env){
  if(!['google','facebook'].includes(provider))return null;
  const google=provider==='google';
  const id=env[google?'GOOGLE_CLIENT_ID':'FACEBOOK_APP_ID'];
  const secret=env[google?'GOOGLE_CLIENT_SECRET':'FACEBOOK_APP_SECRET'];
  const version=env.FACEBOOK_GRAPH_VERSION;
  if(!id||!secret||(!google&&!/^v\d+\.\d+$/.test(version||'')))return null;
  let origin;
  try{origin=new URL(env.APP_ORIGIN||'http://127.0.0.1:4173');}catch{return null;}
  if(origin.username||origin.password)return null;
  if(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))return null;
  return {id,secret,callback:new URL(`/api/auth/social/${provider}/callback`,origin).href,
    authorize:google?'https://accounts.google.com/o/oauth2/v2/auth':`https://www.facebook.com/${version}/dialog/oauth`,
    token:google?'https://oauth2.googleapis.com/token':`https://graph.facebook.com/${version}/oauth/access_token`,
    profile:google?'https://openidconnect.googleapis.com/v1/userinfo':`https://graph.facebook.com/${version}/me`,
    debug:`https://graph.facebook.com/${version}/debug_token`};
}
export const socialProviders=()=>Object.fromEntries(['google','facebook'].map(p=>[p,Boolean(providerConfig(p))]));
export function beginAuthorization(provider,config){
  const pending={provider,state:token(),verifier:token(),created:Date.now()};
  const url=new URL(config.authorize);
  url.search=new URLSearchParams({client_id:config.id,redirect_uri:config.callback,response_type:'code',state:pending.state,
    scope:provider==='google'?'openid profile':'public_profile'}).toString();
  if(provider==='google'){
    url.searchParams.set('code_challenge',createHash('sha256').update(pending.verifier).digest('base64url'));
    url.searchParams.set('code_challenge_method','S256');
    url.searchParams.set('prompt','select_account');
  }
  return {pending,url:url.href};
}
export function validState(pending,provider,state){
  if(!pending||pending.provider!==provider||typeof state!=='string'||state.length!==43||Date.now()-pending.created>600000||pending.created>Date.now())return false;
  const expected=Buffer.from(pending.state),actual=Buffer.from(state);
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export async function exchangeIdentity(provider,config,code,pending,request=fetch){
  async function json(url,options={}){
    const response=await request(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Object.assign(Error('Provider request failed'),{providerStatus:response.status});
    const data=await response.json();
    if(data.error)throw Error('Provider rejected request');
    return data;
  }
  const body=new URLSearchParams({client_id:config.id,client_secret:config.secret,redirect_uri:config.callback,code,grant_type:'authorization_code'});
  if(provider==='google')body.set('code_verifier',pending.verifier);
  const tokens=await json(config.token,{method:'POST',body});
  if(typeof tokens.access_token!=='string'||!tokens.access_token)throw Error('Missing access token');
  const profileUrl=new URL(config.profile);
  if(provider==='facebook'){
    const debug=new URL(config.debug);debug.searchParams.set('input_token',tokens.access_token);
    const {data}=await json(debug,{headers:{Authorization:`Bearer ${config.id}|${config.secret}`}});
    if(data?.is_valid!==true||String(data.app_id)!==config.id||!data.user_id||!Number.isFinite(data.expires_at)||data.expires_at*1000<=Date.now()||(data.data_access_expires_at&&data.data_access_expires_at*1000<=Date.now()))throw Error('Invalid Facebook token');
    profileUrl.searchParams.set('fields','id,name');
    profileUrl.searchParams.set('appsecret_proof',createHmac('sha256',config.secret).update(tokens.access_token).digest('hex'));
    const profile=await json(profileUrl,{headers:{Authorization:`Bearer ${tokens.access_token}`}});
    if(String(profile.id)!==String(data.user_id))throw Error('Facebook identity mismatch');
    return identity(profile.id,profile.name);
  }
  const profile=await json(profileUrl,{headers:{Authorization:`Bearer ${tokens.access_token}`}});
  // UserInfo is fetched with the code-exchanged token over TLS; no unverified JWT claims are used.
  return identity(profile.sub,profile.name);
}
function identity(subject,name){
  if(typeof subject!=='string'||!subject||subject.length>255)throw Error('Invalid provider identity');
  return {subject,name:typeof name==='string'?name.trim().slice(0,120)||'Citizen':'Citizen'};
}
export async function socialCitizen(pool,provider,identity){
  // The stable provider ID is the key. Never link by a supplied name or email.
  async function existing(db){
    const [u]=await rows(db,'SELECT u.* FROM users u JOIN social_identities s ON s.user_id=u.id WHERE s.provider=? AND s.subject=? FOR UPDATE',[provider,identity.subject]);
    if(u&&(u.role!=='CITIZEN'||u.status!=='ACTIVE'))fail(403,'Account unavailable.');
    return u;
  }
  try{return await transaction(pool,async db=>{
    const u=await existing(db);if(u)return u;
    const id=randomUUID();
    // Preserve the existing schema; this random password is never exposed or accepted by citizen routes.
    await rows(db,"INSERT INTO users(id,role,username,name,password_hash,status) VALUES (?,'CITIZEN',?,?,?,'ACTIVE')",[id,'c_'+id.replaceAll('-','').slice(0,30),identity.name,await hashPassword(token())]);
    await rows(db,'INSERT INTO social_identities(provider,subject,user_id) VALUES (?,?,?)',[provider,identity.subject,id]);
    await audit(db,id,'SOCIAL_REGISTER','user',id);
    return (await rows(db,'SELECT * FROM users WHERE id=?',[id]))[0];
  });}catch(error){
    if(error.code!=='ER_DUP_ENTRY')throw error;
    return transaction(pool,async db=>{const u=await existing(db);if(!u)throw error;return u;});
  }
}
export function installSocialAuth(app,pool,{limit,signedIn,resolveIdentity=exchangeIdentity}){
  app.post('/api/auth/social/:provider/start',limit('social-login',20),async(req,res)=>{
    if(req.portal!=='citizen')fail(403,'Use citizen sign in.');
    if(req.user)fail(409,'Log out before switching accounts.');
    const config=providerConfig(req.params.provider);if(!config)fail(503,'This sign-in provider is not configured yet.');
    const {pending,url}=beginAuthorization(req.params.provider,config);
    req.session.oauth=pending;
    await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
    res.json({url});
  });
  app.get('/api/auth/social/:provider/callback',limit('social-callback',30),async(req,res)=>{
    const pending=req.session.oauth;
    if(req.portal!=='citizen'||!validState(pending,req.params.provider,req.query.state)){
      return res.redirect('/#login/oauth-session');
    }
    delete req.session.oauth;
    await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
    let stage='authorization';
    try{
      if(req.query.error==='access_denied')return res.redirect('/#login/oauth-denied');
      if(req.query.error||typeof req.query.code!=='string'||!req.query.code||req.query.code.length>4096)throw Error('Authorization cancelled');
      const config=providerConfig(req.params.provider);if(!config)throw Error('Provider unavailable');
      stage='provider exchange';
      const identity=await resolveIdentity(req.params.provider,config,req.query.code,pending);
      stage='citizen account';
      const u=await socialCitizen(pool,req.params.provider,identity);
      stage='session';
      await signedIn(req,u);await audit(pool,u.id,'SOCIAL_LOGIN','user',u.id);
      res.redirect('/#complaints');
    }catch(error){
      const reason=error.providerStatus || (/^ER_[A-Z0-9_]+$/.test(error.code)?error.code:'failed');
      console.warn('Social sign-in failed during '+stage,reason);
      // Never return provider errors, authorization codes or tokens to the page or logs.
      res.redirect('/#login/oauth-error');
    }
  });
}

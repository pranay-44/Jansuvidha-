import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {connectDatabase,rows,transaction} from './db.mjs';
import {migrate} from './migrate.mjs';
import {createApp} from './api.mjs';
import {hashPassword,verifyPassword,username,validatePassword,assertLocalPrototype,digest} from './auth-security.mjs';
import {issueToken} from './accounts.mjs';
import {facilities} from './dist/data.js';

const password='A long unique test passphrase 924!',newPassword='A different long test passphrase 743!';
assert.equal(username(' Mixed_CASE '),'mixed_case');
assert.throws(()=>username('bad-name'));
await assert.rejects(()=>validatePassword('short','short'));
await validatePassword('x'.repeat(128),'x'.repeat(128));
await assert.rejects(()=>validatePassword('x'.repeat(129),'x'.repeat(129)));
const hash=await hashPassword(password);assert.match(hash,/^\$argon2id\$/);assert.ok(await verifyPassword(hash,password));assert.equal(await verifyPassword(hash,'wrong'),false);
const oldEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';assert.throws(assertLocalPrototype,/Production startup blocked/);process.env.NODE_ENV=oldEnv;

// This suite only uses the explicitly named test database, never the application database.
process.env.MYSQL_DATABASE='jansuvidha_test';
const pool=connectDatabase();let server,store;
const ids=[],departments=[],jurisdictions=[],complaints=[];
const rateLimitNamespace=randomUUID();
try {
  const connection=await pool.getConnection();try{await migrate(connection);}finally{connection.release();}
  const {app,store:sessionStore}=await createApp(pool,{rateLimitNamespace});store=sessionStore;server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN=origin;
  function client(){const cookies={},csrf={};let portal='citizen';return {
    async usePortal(next){portal=next;return this.request('/auth/session');},
    async request(path,body,method=body?'POST':'GET',omitCsrf=false){
    if(path==='/auth/staff-login'&&portal!=='staff')await this.usePortal('staff');
    if(path==='/auth/login'&&portal!=='citizen')await this.usePortal('citizen');
    const started=performance.now();
    const response=await fetch(origin+'/api'+path,{method,headers:{'Content-Type':'application/json','X-Portal':portal,Cookie:Object.values(cookies).join('; '),...(!omitCsrf&&csrf[portal]?{'X-CSRF-Token':csrf[portal]}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const setCookie=response.headers.getSetCookie();for(const value of setCookie){const pair=value.split(';')[0];cookies[pair.split('=')[0]]=pair;}
    const data=await response.json();if(data.csrf)csrf[portal]=data.csrf;
    if(path==='/auth/staff-login'&&response.status===200)console.log(`Successful ${data.user.role} HTTP sign-in: ${Math.round(performance.now()-started)} ms`);
    return {status:response.status,data,cookies:setCookie};
  }};}
  async function fresh(){const c=client();assert.equal((await c.request('/auth/session')).status,200);return c;}
  const suffix=randomUUID().slice(0,8),alice=await fresh(),bob=await fresh();
  const register=(name,extra={})=>({username:name,password,confirmation:password,...extra});
  const a=await alice.request('/auth/register',register('alice_'+suffix,{role:'ADMIN',department_id:randomUUID(),permissions:['all']}));assert.equal(a.status,201);ids.push(a.data.user.id);assert.equal(a.data.user.role,'CITIZEN');assert.equal(a.data.codes.length,8);assert.match(a.cookies.join(';'),/HttpOnly/i);assert.match(a.cookies.join(';'),/SameSite=Strict/i);
  const b=await bob.request('/auth/register',register('bob_'+suffix));assert.equal(b.status,201);ids.push(b.data.user.id);
  assert.equal((await bob.request('/auth/register',register('ALICE_'+suffix))).status,409);
  const [stored]=await rows(pool,'SELECT * FROM users WHERE id=?',[ids[0]]);assert.match(stored.password_hash,/^\$argon2id\$/);assert.equal(stored.department_id,null);assert.notEqual(stored.id,stored.username);
  const codes=await rows(pool,'SELECT token_hash FROM account_tokens WHERE user_id=?',[ids[0]]);assert.ok(codes.every(c=>!a.data.codes.includes(c.token_hash)));
  const login=await fresh();assert.equal((await login.request('/auth/login',{identifier:'alice_'+suffix,password:'incorrect password'})).status,401);assert.equal((await login.request('/auth/login',{identifier:'ALICE_'+suffix,password})).status,200);
  assert.equal((await alice.request('/admin/officers')).status,403);assert.equal((await alice.request('/complaints',{},'POST',true)).status,403);
  const department=randomUUID(),jurisdiction=randomUUID(),otherDepartment=randomUUID();departments.push(department,otherDepartment);jurisdictions.push(jurisdiction);
  for(const id of departments)await rows(pool,'INSERT INTO departments(id,name) VALUES (?,?)',[id,'Department '+id]);await rows(pool,'INSERT INTO jurisdictions(id,name) VALUES (?,?)',[jurisdiction,'Jurisdiction '+suffix]);
  async function staff(role,dept=department){const id=randomUUID();ids.push(id);const address=`${id}@example.test`;await rows(pool,'INSERT INTO users(id,role,name,official_email,password_hash,department_id,jurisdiction_id,status) VALUES (?,?,?,?,?,?,?,?)',[id,role,'Test '+role,address,hash,role==='OFFICER'?dept:null,role==='OFFICER'?jurisdiction:null,'ACTIVE']);const c=await fresh();assert.equal((await c.request('/auth/staff-login',{identifier:address,password})).status,200);return {id,address,c};}
  const admin=await staff('ADMIN'),officer=await staff('OFFICER'),outsider=await staff('OFFICER'),outOfScope=await staff('OFFICER',otherDepartment);
  assert.equal((await alice.usePortal('staff')).data.user,null,'Citizen login must not appear in government portal');
  assert.equal((await alice.request('/admin/officers')).status,401);
  assert.equal((await alice.request('/auth/staff-login',{identifier:admin.address,password})).status,200);
  assert.equal((await alice.usePortal('citizen')).data.user.id,ids[0],'Staff login preserves the citizen account');
  assert.equal((await alice.usePortal('staff')).data.user.id,admin.id);
  await alice.request('/auth/logout',{});
  assert.equal((await alice.usePortal('citizen')).data.user.id,ids[0],'Staff logout must not log out the citizen');
  const c=await alice.request('/complaints',{facility:facilities[0].id,category:'No water',description:'There has been no water here for several days.',department_id:department,jurisdiction_id:jurisdiction,citizen_id:ids[1],assigned_officer_id:officer.id,status:'Closed'});assert.equal(c.status,201);complaints.push(c.data.id);const cid=c.data.id;
  const [saved]=await rows(pool,'SELECT * FROM complaints WHERE id=?',[cid]);assert.equal(saved.citizen_id,ids[0]);assert.equal(saved.status,'Submitted');assert.equal(saved.assigned_officer_id,null);
  assert.equal((await bob.request('/complaints/'+cid)).status,404);assert.equal((await officer.c.request('/complaints/'+cid)).status,404);assert.equal((await bob.request('/complaints')).data.length,0);
  assert.equal((await officer.c.request('/admin/officers')).status,403);assert.equal((await officer.c.request(`/admin/complaints/${cid}/assign`,{officer_id:officer.id})).status,403);
  assert.equal((await admin.c.request(`/admin/complaints/${cid}/assign`,{officer_id:outOfScope.id})).status,400);
  assert.equal((await admin.c.request(`/admin/complaints/${cid}/assign`,{officer_id:officer.id})).status,200);
  assert.equal((await officer.c.request('/complaints/'+cid)).status,200);assert.equal((await outsider.c.request('/complaints/'+cid)).status,404);
  assert.equal((await officer.c.request(`/complaints/${cid}/updates`,{note:'Staff internal investigation',visibility:'INTERNAL',status:'In progress'})).status,200);
  assert.equal((await officer.c.request(`/complaints/${cid}/updates`,{note:'An officer is investigating',visibility:'PUBLIC',status:'In progress'})).status,200);
  const visible=(await alice.request('/complaints/'+cid)).data;assert.ok(visible.updates.every(u=>u.visibility==='PUBLIC'));assert.ok(!JSON.stringify(visible).includes('Staff internal investigation'));
  assert.equal((await officer.c.request(`/complaints/${cid}/updates`,{note:'Skip workflow',visibility:'PUBLIC',status:'Closed'})).status,400);
  await rows(pool,'UPDATE users SET department_id=? WHERE id=?',[otherDepartment,officer.id]);assert.equal((await officer.c.request('/complaints/'+cid)).status,404);await rows(pool,'UPDATE users SET department_id=? WHERE id=?',[department,officer.id]);
  const edited={name:'Disabled officer',department_id:department,jurisdiction_id:jurisdiction,status:'DISABLED',role:'ADMIN'};
  assert.equal((await admin.c.request('/admin/officers/'+officer.id,edited,'PATCH')).status,200);assert.equal((await officer.c.request('/complaints')).status,401);
  assert.equal((await admin.c.request(`/admin/complaints/${cid}/assign`,{officer_id:officer.id})).status,400);
  assert.equal((await admin.c.request('/admin/officers/'+admin.id,edited,'PATCH')).status,404);
  const pending=await admin.c.request('/admin/officers',{name:'Invited officer',official_email:`invited-${suffix}@example.test`,department_id:department,jurisdiction_id:jurisdiction,role:'ADMIN',status:'ACTIVE'});assert.equal(pending.status,201);ids.push(pending.data.id);assert.ok(!pending.data.token&&!pending.data.link);
  assert.equal((await admin.c.request('/admin/officers/'+pending.data.id,{...edited,status:'ACTIVE'},'PATCH')).status,400);
  const invitation=await transaction(pool,db=>issueToken(db,pending.data.id,'INVITATION'));const inviteClient=await fresh();
  const setPassword=secret=>({token:secret,password:newPassword,confirmation:newPassword});
  assert.equal((await inviteClient.request('/auth/invitation',setPassword(invitation))).status,200);assert.equal((await inviteClient.request('/auth/invitation',setPassword(invitation))).status,400);
  assert.equal((await inviteClient.request('/auth/staff-login',{identifier:`invited-${suffix}@example.test`,password:newPassword})).status,401);
  assert.equal((await admin.c.request('/admin/officers/'+pending.data.id,{...edited,status:'ACTIVE'},'PATCH')).status,200);
  assert.equal((await inviteClient.request('/auth/staff-login',{identifier:`invited-${suffix}@example.test`,password:newPassword})).status,200);
  const reset=await transaction(pool,db=>issueToken(db,pending.data.id,'STAFF_RESET'));const resetClient=await fresh();assert.equal((await resetClient.request('/auth/staff-reset',setPassword(reset))).status,200);assert.equal((await resetClient.request('/auth/staff-reset',setPassword(reset))).status,400);assert.equal((await inviteClient.request('/complaints')).status,401);
  const expired=await transaction(pool,db=>issueToken(db,pending.data.id,'STAFF_RESET'));await rows(pool,"UPDATE account_tokens SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE user_id=? AND kind='STAFF_RESET'",[pending.data.id]);assert.equal((await resetClient.request('/auth/staff-reset',setPassword(expired))).status,400);
  const recovery1=await fresh(),recovery2=await fresh(),recoveryBody={username:'alice_'+suffix,code:a.data.codes[0],password:newPassword,confirmation:newPassword};
  const attempts=await Promise.all([recovery1.request('/auth/recover',recoveryBody),recovery2.request('/auth/recover',recoveryBody)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,400]);assert.equal((await alice.request('/complaints')).status,401);assert.equal((await login.request('/complaints')).status,401);
  assert.equal((await recovery1.request('/auth/login',{identifier:'alice_'+suffix,password:newPassword})).status,200);
  assert.equal((await recovery1.request('/auth/recovery-codes',{current_password:'wrong'})).status,400);
  const renewed=await recovery1.request('/auth/recovery-codes',{current_password:newPassword});assert.equal(renewed.data.codes.length,8);
  assert.equal((await recovery2.request('/auth/recover',{...recoveryBody,code:a.data.codes[1]})).status,400);
  const other=await fresh();assert.equal((await other.request('/auth/login',{identifier:'alice_'+suffix,password:newPassword})).status,200);
  assert.equal((await recovery1.request('/auth/password',{current_password:newPassword,password,confirmation:password})).status,200);assert.equal((await other.request('/complaints')).status,401);assert.equal((await recovery1.request('/complaints')).status,200);
  const mfaFlag=process.env.ALLOW_LOCAL_STAFF_WITHOUT_MFA;process.env.ALLOW_LOCAL_STAFF_WITHOUT_MFA='false';assert.equal((await admin.c.request('/admin/officers')).status,403);process.env.ALLOW_LOCAL_STAFF_WITHOUT_MFA=mfaFlag;
  await recovery1.request('/auth/logout',{});assert.equal((await recovery1.request('/complaints')).status,401);
  let limited;const rateClient=await fresh();
  for(let i=0;i<21;i++){limited=await rateClient.request('/auth/login',{identifier:'missing',password});if(limited.status===429)break;}
  assert.equal(limited.status,429);
  console.log('Passed: Argon2id, username case/uniqueness, role injection, CSRF, login, citizen isolation, internal-note privacy, officer scope, admin boundaries, assignments, disabled sessions, invitation approval/reuse, reset expiry/reuse, concurrent single-use recovery, session revocation, password change, code replacement, MFA production guard and logout.');
}finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(store)await store.close();
  // Delete only records created by this run. Existing test data is preserved.
  for(const id of complaints){await rows(pool,'DELETE FROM complaint_updates WHERE complaint_id=?',[id]);await rows(pool,'DELETE FROM complaints WHERE id=?',[id]);}
  for(const id of ids){await rows(pool,'DELETE FROM audit_logs WHERE actor_id=? OR target_id=?',[id,id]);await rows(pool,'DELETE FROM account_tokens WHERE user_id=?',[id]);}
  for(const id of ids)await rows(pool,'DELETE FROM users WHERE id=?',[id]);
  for(const id of departments)await rows(pool,'DELETE FROM departments WHERE id=?',[id]);
  for(const id of jurisdictions)await rows(pool,'DELETE FROM jurisdictions WHERE id=?',[id]);
  for(const scope of ['register','login','password','recovery','tokens','complaints','invitations'])await rows(pool,'DELETE FROM auth_limits WHERE bucket=?',[digest(`${rateLimitNamespace}:${scope}:127.0.0.1`)]);
  await pool.end();
}

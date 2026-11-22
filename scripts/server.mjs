import {connectDatabase} from './db.mjs';
import {createApp} from './api.mjs';
import {encryptionKey} from './staff-mfa.mjs';
import {assertLocalPrototype} from './auth-security.mjs';

const onRender=process.env.RENDER==='true'&&process.env.NODE_ENV==='production';
const host=onRender?'0.0.0.0':process.env.HOST||'127.0.0.1';
if(onRender)process.env.APP_ORIGIN ||= process.env.RENDER_EXTERNAL_URL || '';
if(process.env.NODE_ENV==='production'){
  const origin=new URL(process.env.APP_ORIGIN);
  if(origin.protocol!=='https:'||origin.origin!==process.env.APP_ORIGIN||process.env.PRESENTATION_MODE==='true'||process.env.ALLOW_LOCAL_STAFF_WITHOUT_MFA==='true')throw Error('Configure an HTTPS origin and disable both development modes.');
  if(!onRender&&!['127.0.0.1','::1'].includes(host))throw Error('Bind the service to loopback behind the HTTPS proxy.');
  if(!['127.0.0.1','localhost','::1'].includes(process.env.MYSQL_HOST||'127.0.0.1')&&process.env.MYSQL_TLS!=='true')throw Error('Enable verified TLS for a remote MySQL host.');
  encryptionKey();
}else assertLocalPrototype();
const pool=connectDatabase();
try {
  await pool.query('SELECT encrypted_secret FROM staff_factors LIMIT 0');
  await pool.query('SELECT record_id FROM citizen_records LIMIT 0');
  const {app}=await createApp(pool);
  app.listen(Number(process.env.PORT||4173),host,()=>console.log(`JanSuvidha listening: ${process.env.APP_ORIGIN||'http://127.0.0.1:4173'}`));
}catch{
  console.error('Startup failed. Check MySQL, SESSION_SECRET and migrations. See AUTH.md.');
  await pool.end();process.exitCode=1;
}

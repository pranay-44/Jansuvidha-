import {connectDatabase} from './db.mjs';
import {createApp} from './api.mjs';
import {assertLocalPrototype} from './auth-security.mjs';

assertLocalPrototype();
const pool=connectDatabase();
try {
  await pool.query('SELECT 1 FROM schema_migrations LIMIT 1');
  const {app}=await createApp(pool);
  app.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log(`Local prototype: ${process.env.APP_ORIGIN||'http://127.0.0.1:4173'} (staff MFA deferred; production blocked)`));
}catch{
  console.error('Startup failed. Check MySQL, SESSION_SECRET and migrations. See AUTH.md.');
  await pool.end();process.exitCode=1;
}

import {password, input} from '@inquirer/prompts';
import mysql from 'mysql2/promise';
import {randomBytes} from 'node:crypto';
import {writeFile, access} from 'node:fs/promises';

try { await access('.env'); console.error('.env already exists. Keep it and follow AUTH.md to adjust configuration.'); process.exit(1); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const rootPassword = await password({message:'MySQL root password (hidden; never saved):'});
const rootUser = await input({message:'MySQL setup user:',default:'root'});
let db;
try {
  db = await mysql.createConnection({host:'127.0.0.1',user:rootUser,password:rootPassword});
  const account = 'js_' + randomBytes(6).toString('hex'), secret = randomBytes(32).toString('hex');
  for (const name of ['jansuvidha','jansuvidha_test']) await db.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await db.query('CREATE USER ?@? IDENTIFIED BY ?',[account,'localhost',secret]);
  for (const name of ['jansuvidha','jansuvidha_test']) await db.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO ?@?`,[account,'localhost']);
  await writeFile('.env',`NODE_ENV=development\nHOST=127.0.0.1\nPORT=4173\nAPP_ORIGIN=http://127.0.0.1:4173\nSESSION_SECRET=${randomBytes(48).toString('hex')}\nMYSQL_HOST=127.0.0.1\nMYSQL_PORT=3306\nMYSQL_DATABASE=jansuvidha\nMYSQL_USER=${account}\nMYSQL_PASSWORD=${secret}\nALLOW_LOCAL_STAFF_WITHOUT_MFA=true\nBREACHED_PASSWORD_CHECK=false\n`,{flag:'wx',mode:0o600});
  console.log('Created application databases and .env. Root credentials were not saved.');
} catch { console.error('Setup failed. Check your MySQL credentials and service. No password details were logged.'); process.exitCode=1; }
finally { await db?.end(); }

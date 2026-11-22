import {input,password} from '@inquirer/prompts';
import {connectDatabase,rows,transaction} from './db.mjs';
import {authenticator,encryptionKey,encryptSecret,matchingStep} from './staff-mfa.mjs';
import {email} from './auth-security.mjs';
import {audit} from './accounts.mjs';

if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Use a private interactive terminal.');
encryptionKey();
const pool=connectDatabase();
try{
  const address=email(await input({message:'Identity-verified staff member’s official email'}));
  const [user]=await rows(pool,"SELECT id,session_version FROM users WHERE official_email=? AND role IN ('ADMIN','OFFICER') AND status='ACTIVE'",[address]);
  if(!user)throw Error('Active staff account required.');
  const factor=authenticator(address);
  console.log('Enter this time-based setup key into the staff member’s authenticator:',factor.secret.base32);
  const step=matchingStep(factor,await password({message:'Six-digit code from that authenticator'}));
  if(step===null)throw Error('Code did not match. Enrollment cancelled.');
  await transaction(pool,async db=>{
    const updated=await rows(db,"UPDATE users SET session_version=session_version+1 WHERE id=? AND session_version=? AND status='ACTIVE'",[user.id,user.session_version]);
    if(!updated.affectedRows)throw Error('Account changed during enrollment. Start again.');
    const secret=encryptSecret(user.id,factor.secret.base32);
    await rows(db,'INSERT INTO staff_factors(user_id,encrypted_secret,last_step) VALUES (?,?,?) ON DUPLICATE KEY UPDATE encrypted_secret=?,last_step=?',[user.id,secret,step,secret,step]);
    await audit(db,null,'STAFF_FACTOR_PROVISIONED','user',user.id);
  });
  console.log('Authenticator confirmed. Prior sessions and the previous factor are revoked. Sign in with the next code.');
}finally{await pool.end();}

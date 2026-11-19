import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import {rows,transaction} from './db.mjs';
import {token,digest,fail} from './auth-security.mjs';

export const audit=(db,actor,action,type,id)=>rows(db,'INSERT INTO audit_logs(actor_id,action,target_type,target_id) VALUES (?,?,?,?)',[actor,action,type,id]);
export async function recoveryCodes(db,id) {
  await rows(db,"DELETE FROM account_tokens WHERE user_id=? AND kind='RECOVERY'",[id]);
  const codes=Array.from({length:8},token);
  for(const code of codes) await rows(db,"INSERT INTO account_tokens(id,user_id,kind,token_hash) VALUES (?,?,'RECOVERY',?)",[randomUUID(),id,digest(code)]);
  return codes;
}
export async function issueToken(db,id,kind) {
  const secret=token();
  await rows(db,'DELETE FROM account_tokens WHERE user_id=? AND kind=?',[id,kind]);
  await rows(db,'INSERT INTO account_tokens(id,user_id,kind,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? MINUTE))',[randomUUID(),id,kind,digest(secret),kind==='INVITATION'?1440:20]);
  return secret;
}
export const accountLink=(kind,secret)=>`${process.env.APP_ORIGIN||'http://127.0.0.1:4173'}/#${kind==='INVITATION'?'invitation':'staff-reset'}/${secret}`;
export const hasMail=()=>Boolean(process.env.SMTP_HOST&&process.env.MAIL_FROM);
export async function deliverToken(pool,user,kind) {
  if(!hasMail()) fail(503,'Email is not configured. Use the local development CLI.');
  const secret=await transaction(pool,async db=>{
    const [fresh]=await rows(db,'SELECT * FROM users WHERE id=? FOR UPDATE',[user.id]);
    if(!fresh||fresh.status!==(kind==='INVITATION'?'PENDING':'ACTIVE')) fail(400,'Account unavailable.');
    return issueToken(db,user.id,kind);
  });
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',requireTLS:true,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
  await transport.sendMail({from:process.env.MAIL_FROM,to:user.official_email,subject:kind==='INVITATION'?'Set up your JanSuvidha officer account':'Reset your JanSuvidha password',text:`Open this single-use link: ${accountLink(kind,secret)}\nExpires in ${kind==='INVITATION'?'24 hours':'20 minutes'}. If you did not request this, ignore it.`});
}

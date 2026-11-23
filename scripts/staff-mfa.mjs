import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {TOTP,Secret} from 'otpauth';
import {rows} from './db.mjs';

export function encryptionKey(){
  if(!/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY||''))throw Error('Configure MFA_ENCRYPTION_KEY with 32 random bytes in hex.');
  return Buffer.from(process.env.MFA_ENCRYPTION_KEY,'hex');
}
export function authenticator(label,secret=new Secret({size:20})){
  return new TOTP({issuer:'JanSuvidha',label,secret,digits:6,period:30});
}
export function encryptSecret(id,secret){
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from(id));
  const body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');
}
export function matchingStep(factor,code,now=Date.now()){
  if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;
  const delta=factor.validate({token:code,timestamp:now,window:1});
  return delta===null?null:Math.floor(now/30000)+delta;
}
export async function consumeFactor(db,user,code){
  const [record]=await rows(db,'SELECT * FROM staff_factors WHERE user_id=? FOR UPDATE',[user.id]);
  if(!record)return false;
  const blob=Buffer.from(record.encrypted_secret,'base64');
  const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),blob.subarray(0,12));
  cipher.setAAD(Buffer.from(user.id));cipher.setAuthTag(blob.subarray(12,28));
  const secret=Buffer.concat([cipher.update(blob.subarray(28)),cipher.final()]).toString();
  const step=matchingStep(authenticator(user.official_email,Secret.fromBase32(secret)),code);
  if(step===null||step<=record.last_step)return false;
  await rows(db,'UPDATE staff_factors SET last_step=? WHERE user_id=?',[step,user.id]);
  return true;
}

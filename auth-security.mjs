import {createHash, randomBytes} from 'node:crypto';
import argon2 from 'argon2';
import {isIP} from 'node:net';

export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const hashPassword = password => argon2.hash(password, {type:argon2.argon2id, memoryCost:65536, timeCost:3, parallelism:1});
export const verifyPassword = (hash, password) => argon2.verify(hash, password);
export function fail(status, message) { throw Object.assign(Error(message), {status}); }
export function text(value, max = 120, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, `Enter between ${min} and ${max} characters.`);
  return value.trim();
}
export function username(value) {
  const name = text(value,32,3).toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(name)) fail(400,'Username must be 3–32 letters, numbers or underscores.');
  return name;
}
export function email(value) {
  const result = text(value,254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400,'Enter an official email address.');
  return result;
}
export async function validatePassword(password, confirmation) {
  if (typeof password !== 'string' || [...password].length < 15 || [...password].length > 128) fail(400,'Use a passphrase of 15–128 characters.');
  if (password !== confirmation) fail(400,'Passwords do not match.');
  if (process.env.BREACHED_PASSWORD_CHECK === 'true') {
    const sha = createHash('sha1').update(password).digest('hex').toUpperCase();
    const response = await fetch(`https://api.pwnedpasswords.com/range/${sha.slice(0,5)}`, {headers:{'Add-Padding':'true'},signal:AbortSignal.timeout(5000)});
    if (!response.ok) fail(503,'Password screening is unavailable. Try again later.');
    if ((await response.text()).split('\n').some(line => line.split(':')[0] === sha.slice(5) && Number(line.split(':')[1]) > 0)) fail(400,'This password has appeared in a breach. Choose a different passphrase.');
  }
}
export const transitions = Object.freeze({Submitted:['Rejected'],Assigned:['In progress','Rejected'],'In progress':['Resolved','Rejected'],Resolved:['Closed','In progress'],Closed:[],Rejected:[]});
export function canAccess(user, complaint) {
  return user.status === 'ACTIVE' && (user.role === 'ADMIN' || (user.role === 'CITIZEN' && user.id === complaint.citizen_id) || (user.role === 'OFFICER' && user.id === complaint.assigned_officer_id && user.department_id === complaint.department_id && user.jurisdiction_id === complaint.jurisdiction_id));
}
export function isPrivateIPv4(host) {
  if(isIP(host)!==4)return false;
  const [a,b]=host.split('.').map(Number);
  return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
export function assertLocalPrototype() {
  if (process.env.NODE_ENV === 'production') throw Error('Production startup blocked: staff MFA enrollment, verification and recovery must be implemented first.');
  const host=process.env.HOST||'127.0.0.1';
  if(process.env.PRESENTATION_MODE==='true'&&process.env.NODE_ENV==='development'&&isPrivateIPv4(host))return;
  if (!['127.0.0.1','localhost','::1'].includes(host)) throw Error('Use loopback or npm run presentation on a private network. Public deployment requires staff MFA.');
}

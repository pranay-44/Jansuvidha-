import assert from 'node:assert/strict';
import {assertLocalPrototype,isPrivateIPv4} from './auth-security.mjs';

for(const address of ['192.168.0.103','10.1.2.3','172.16.0.1','172.31.255.254'])assert.ok(isPrivateIPv4(address));
for(const address of ['8.8.8.8','0.0.0.0','172.15.0.1','172.32.0.1','192.168.0.999','192.168.0.1.example.com','localhost','::'])assert.equal(isPrivateIPv4(address),false);
const original={...process.env};
try{
  Object.assign(process.env,{NODE_ENV:'development',HOST:'192.168.0.103',PRESENTATION_MODE:'true'});assert.doesNotThrow(assertLocalPrototype);
  process.env.PRESENTATION_MODE='false';assert.throws(assertLocalPrototype);
  process.env.PRESENTATION_MODE='true';process.env.NODE_ENV='production';assert.throws(assertLocalPrototype);
  process.env.NODE_ENV='development';process.env.HOST='0.0.0.0';assert.throws(assertLocalPrototype);
  process.env.HOST='8.8.8.8';assert.throws(assertLocalPrototype);
}finally{for(const key of ['NODE_ENV','HOST','PRESENTATION_MODE']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
console.log('Passed: presentation mode permits explicit private IPs only; public binding and production remain blocked.');

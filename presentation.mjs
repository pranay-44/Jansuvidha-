import {networkInterfaces} from 'node:os';
import {isPrivateIPv4,assertLocalPrototype} from './auth-security.mjs';

if(process.env.NODE_ENV==='production')throw Error('Presentation mode cannot run in production.');
const addresses=Object.entries(networkInterfaces()).flatMap(([name,items])=>items.filter(i=>!i.internal&&i.family==='IPv4'&&isPrivateIPv4(i.address)).map(i=>({name,address:i.address})));
const preferred=addresses.filter(i=>/wi-?fi|wireless|wlan/i.test(i.name));
const candidates=preferred.length?preferred:addresses;
const host=process.env.PRESENTATION_HOST||(candidates.length===1?candidates[0].address:null);
if(!host||!addresses.some(i=>i.address===host)){
  console.error('Choose the Wi-Fi/hotspot address with PRESENTATION_HOST, then run again. Available private interfaces:',addresses);
  process.exit(1);
}
Object.assign(process.env,{NODE_ENV:'development',PRESENTATION_MODE:'true',HOST:host,PORT:'4174',APP_ORIGIN:`http://${host}:4174`,ALLOW_LOCAL_STAFF_WITHOUT_MFA:'true'});
assertLocalPrototype();
console.log(`Phone presentation link: ${process.env.APP_ORIGIN}`);
console.log('Connect phones to the same Wi-Fi/hotspot as this computer. Keep MySQL and this terminal running.');
console.log('Local HTTP presentation only: use test accounts and fictional complaints. No internet deployment or MFA.');
if(process.argv[2]==='dev-link'){
  process.argv[2]='dev-link';
  await import('./auth-cli.mjs');
}else await import('./server.mjs');

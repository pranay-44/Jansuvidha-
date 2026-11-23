import {writeFile} from 'node:fs/promises';
const value=process.env.JANSUVIDHA_PUBLIC_ORIGIN ?? 'https://jansuvidha-9t1l.onrender.com';
if(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.origin!==value)throw Error('JANSUVIDHA_PUBLIC_ORIGIN must be an HTTPS origin.');
}
await writeFile(new URL('../android/app/src/main/assets/public/hosted-origin.json',import.meta.url),JSON.stringify({origin:value||null}));

import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const packaged=join(root,'android/app/src/main/assets/public');
let count=0;
async function check(folder=''){
  for(const entry of await readdir(join(root,'dist',folder),{withFileTypes:true})){
    if(entry.name.startsWith('.'))continue;
    const path=join(folder,entry.name);
    if(entry.isDirectory()){await check(path);continue;}
    if(!entry.isFile())continue;
    const [source,copy]=await Promise.all([readFile(join(root,'dist',path)),readFile(join(packaged,path))]);
    assert.ok(source.equals(copy),`Android asset is stale: ${path}. Run npm run android:sync.`);
    count++;
  }
}
await check();
const config=JSON.parse(await readFile(join(root,'android/app/src/main/assets/capacitor.config.json'),'utf8'));
assert.equal(config.appId,'org.jansuvidha.app');
assert.equal(config.server?.url,undefined,'Offline Android package must not depend on a development server URL.');
console.log(`Passed: ${count} Android assets match dist byte-for-byte; application ID and bundled mode verified.`);

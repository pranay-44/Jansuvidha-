import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Exercise the actual login form handler, including sign-in on a dashboard URL.
const source=readFileSync(new URL('./dist/account.js',import.meta.url),'utf8')
  .replace("import {facilities} from './data.js';",'const facilities=[];')
  .replaceAll('export function ','function ').replaceAll('export async function ','async function ');
for(const [role,route] of [['OFFICER','government'],['ADMIN','government'],['CITIZEN','complaints']]){
  for(const initial of [route,role==='CITIZEN'?'login':'staff-login']){
    let signedIn=false;
    const requests=[],button={disabled:false},output={textContent:''};
    const form={querySelector:s=>s==='.form-message'?output:button};
    const elements={'#main':{innerHTML:''},'.profile':{innerHTML:''},'#login-form':form,'#logout':{}};
    const location={hash:'#'+initial};
    const context={document:{querySelector:s=>elements[s]||null},location,AbortSignal,
      history:{replaceState(_state,_title,hash){location.hash=hash;}},
      FormData:class { *[Symbol.iterator](){yield ['identifier','test'];yield ['password','test passphrase'];} },
      fetch:async(path,options)=>{
        assert.equal(options.headers['X-Portal'],role==='CITIZEN'?'citizen':'staff');
        requests.push(path);
        let data;
        const user={id:'test',role,username:role==='CITIZEN'?'test':null,name:'Test'};
        if(path==='/api/auth/session')data={user:signedIn?user:null,csrf:'test-csrf'};
        else if(path==='/api/auth/login'||path==='/api/auth/staff-login'){signedIn=true;data={user,csrf:'rotated-csrf'};}
        else if(path==='/api/complaints')data=[];
        else throw Error('Unexpected request: '+path);
        return {ok:true,json:async()=>data};
      }};
    runInNewContext(source+'\nglobalThis.renderAccount=renderAccount;',context);
    await context.renderAccount(initial);
    await form.onsubmit({preventDefault(){}});
    assert.equal(button.disabled,false);
    assert.equal(requests.includes('/api/catalog'),false,'Inbox must not load unused catalog data');
    assert.match(elements['#main'].innerHTML,/Complaint inbox|Your reports/,'Dashboard must render without relying on a hashchange event');
    assert.ok(requests.includes('/api/complaints'));
    assert.equal(location.hash,'#'+route,'Sign-in navigates to the role dashboard');
  }
}
console.log('Passed: citizen/officer/admin sign-in on existing dashboard URLs, separate login redirects, and no unused inbox catalog request.');
for(const [name,message] of [['TimeoutError',/15 seconds/],['TypeError',/Cannot reach/]]){
  const context={AbortSignal,document:{},fetch:async(_path,options)=>{
    assert.ok(options.signal,'Requests must have a timeout signal');
    throw Object.assign(Error('Simulated connection failure'),{name});
  }};
  runInNewContext(source+'\nglobalThis.api=api;',context);
  await assert.rejects(()=>context.api('/auth/staff-login',{}),message);
}
console.log('Passed: stalled and disconnected requests show actionable errors.');

{
  const main={innerHTML:''},form={querySelector:()=>({})};
  const elements={'#main':main,'.profile':{},'#logout':{},'#complaint-form':form};
  const context={AbortSignal,document:{querySelector:s=>elements[s]||null},
    fetch:async path=>({ok:true,json:async()=>{
      if(path==='/api/auth/session')return {user:{id:'citizen',role:'CITIZEN',username:'test'},csrf:'test'};
      if(path==='/api/catalog')return {departments:[{id:'department',name:'Pilot department'}],jurisdictions:[{id:'area',name:'Pilot area'}]};
      if(path==='/api/complaints')return [];
      throw Error('Unexpected request');
    }})};
  runInNewContext(source+'\nglobalThis.renderAccount=renderAccount;',context);
  await context.renderAccount('complaints','new');
  assert.match(main.innerHTML,/id="complaint-form"/);
  assert.match(main.innerHTML,/value="department" selected/);
  assert.match(main.innerHTML,/value="area" selected/);
  assert.match(main.innerHTML,/Submit complaint/);
  assert.equal(typeof form.onsubmit,'function');
}
console.log('Passed: citizen complaint form is available with default routing selected.');

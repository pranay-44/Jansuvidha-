import {facilities} from './data.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
let requiresStaffFactor=true;
let csrf,user,routeVersion=0,portal='citizen',providers={};
const staffRoutes=new Set(['government','staff-login','staff-forgot','staff-reset','invitation','staff-account','officers','catalog','audit']);
const routes=new Set(['login','register','recover','staff-login','staff-forgot','invitation','staff-reset','account','staff-account','complaints','government','officers','catalog','audit']);
const dashboard=()=>user?.role==='CITIZEN'?'complaints':'government';
async function api(path,body,method=body?'POST':'GET') {
  const requestedPortal=portal;
  let response,data;
  try {
    response=await fetch('/api'+path,{method,credentials:'same-origin',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','X-Portal':portal,...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
    data=await response.json();
  }catch(error){
    if(error.name==='TimeoutError'||error.name==='AbortError')throw Error('The server did not respond within 15 seconds. Refresh the page to check your session, then try again.',{cause:error});
    if(error instanceof SyntaxError)throw Error('The account service needs the Node server and MySQL. See AUTH.md.',{cause:error});
    throw Error('Cannot reach the account service. Check that npm start is running, then refresh the page.',{cause:error});
  }
  if(requestedPortal!==portal)throw Error('Portal changed. Continue in the selected portal.');
  if(data.csrf)csrf=data.csrf;
  if(!response.ok)throw Error(data.message||'Request failed.');
  return data;
}
function profile(){const p=$('.profile');p.innerHTML=`<span class="avatar">${user?esc(user.role[0]):'J'}</span><div>${user?esc(user.name||user.username):'Thane workspace'}<small><a href="#${user?(portal==='staff'?'staff-account':'account'):(portal==='staff'?'staff-login':'login')}">${user?'Account settings':portal==='staff'?'Staff sign in':'Citizen sign in'}</a></small></div>`;}
const field=(label,name,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" required ${extra}></label>`;
const passwords=()=>field('New password','password','password','minlength="15" maxlength="256" autocomplete="new-password"')+field('Confirm password','confirmation','password','autocomplete="new-password"')+'<p class="note">Use 15–128 characters. Long passphrases, password managers and pasting are supported.</p>';
const select=(label,name,items,current='')=>`<label>${label}<select name="${name}" required><option value="">Choose ${label.toLowerCase()}</option>${items.map(i=>`<option value="${esc(i.id)}" ${i.id===current?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label>`;
const simpleOptions=items=>items.map(s=>({id:s,name:s}));
const message=()=>'<p class="form-message" role="status" aria-live="polite"></p>';
const form=(id,body,button)=>`<form id="${id}">${body}${message()}<button class="button primary">${button}</button></form>`;
const header=(title,description)=>`<section class="intro"><div><div class="eyebrow">JANSUVIDHA ACCOUNT SERVICES</div><h1>${title}</h1><p>${description}</p></div></section>`;
const links=()=>`<div class="account-nav"><a class="button" href="#${dashboard()}">Dashboard</a><a class="button" href="#${portal==='staff'?'staff-account':'account'}">Account settings</a>${user?.role==='ADMIN'?'<a class="button" href="#officers">Officers</a><a class="button" href="#catalog">Departments & jurisdictions</a><a class="button" href="#audit">Audit history</a>':''}<button class="button" id="logout">Log out</button></div>`;
function bind(id,handler) {
  const element=$(id);if(!element)return;
  element.onsubmit=async e=>{e.preventDefault();const button=element.querySelector('button[type="submit"],button:not([type])'),output=element.querySelector('.form-message');button.disabled=true;output.textContent='Working…';
    try{await handler(Object.fromEntries(new FormData(element)),output,element);if(output.textContent==='Working…')output.textContent='Done.';}catch(error){output.textContent=error.message;}finally{button.disabled=false;}
  };
}
function logout(){if($('#logout'))$('#logout').onclick=async()=>{try{await api('/auth/logout',{});user=null;csrf=null;profile();location.hash=portal==='staff'?'staff-login':'login';}catch(e){$('#account-notice').textContent=e.message;}};}
function citizenLogin(error=false){
  $('#main').innerHTML=header('Citizen sign in','Create an account or sign in with Google or Facebook.')+`<section class="panel auth-card social-login"><h2>Welcome to JanSuvidha</h2><p>Use the same provider each time to access your complaints.</p><div class="social-buttons">${['google','facebook'].map(provider=>`<button class="button" id="signin-${provider}" ${providers[provider]?'':'disabled'}>Continue with ${provider==='google'?'Google':'Facebook'}</button>`).join('')}</div>${!providers.google||!providers.facebook?'<p class="note">Sign-in options that are unavailable are still being set up. Please try again later.</p>':''}<p id="social-message" role="status" aria-live="polite">${error?'Sign-in was cancelled or could not be completed. Please try again.':''}</p><p class="note">Your first sign-in creates a citizen account. JanSuvidha never receives your Google or Facebook password.</p><a href="#staff-login">Officer / administrator sign in</a></section>`;
  for(const provider of ['google','facebook']){
    const button=$('#signin-'+provider);
    if(!providers[provider])continue;
    button.onclick=async()=>{
      const version=routeVersion;
      button.disabled=true;$('#social-message').textContent='Opening sign in…';
      try{const result=await api('/auth/social/'+provider+'/start',{});if(version===routeVersion)location.assign(result.url);}
      catch(error){if(version===routeVersion){$('#social-message').textContent=error.message;button.disabled=false;}}
    };
  }
}
function loginPage(staff){
  if(!staff){citizenLogin();return;}
  $('#main').innerHTML=header('Government portal sign in','Officers and administrators sign in with their official email.')+`<section class="panel auth-card">${form('login-form',field('Official email','identifier','email','autocomplete="username"')+field('Password','password','password','autocomplete="current-password"')+(requiresStaffFactor?field('Authenticator code','code','text','autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"'):' '),'Sign in')}<div class="account-links"><a href="#staff-forgot">Forgot password?</a><a href="#login">Citizen sign in</a></div></section>`;
  bind('#login-form',async data=>{
    const result=await api('/auth/staff-login',data);user=result.user;profile();
    const target=dashboard();
    // Render directly on success; do not depend on a hashchange event to finish login.
    history.replaceState(null,'','#'+target);
    await renderAccount(target);
  });
}
function publicPage(page,secret){
  if(['login','register','recover'].includes(page)){citizenLogin(secret==='oauth-error');return;}
  if(page==='staff-login'){loginPage(true);return;}
  const titles={'staff-forgot':'Staff password recovery',invitation:'Set up your officer account','staff-reset':'Reset your staff password'};
  const body=page==='staff-forgot'?field('Official email','email','email','autocomplete="username"'):passwords();
  $('#main').innerHTML=header(titles[page],'Use a password you do not use elsewhere.')+`<section class="panel auth-card">${form('public-form',body,page==='staff-forgot'?'Send reset link':'Save new password')}<p><a href="#staff-login">Back to sign in</a></p></section>`;
  bind('#public-form',async(data,output,element)=>{
    const result=await api('/auth/'+page,{...data,...(secret?{token:secret}:{})});
    element.reset();
    output.textContent=page==='invitation'?'Password saved. Your administrator must approve the account before you can sign in.':result.message||'Password saved. Sign in with your new password. Existing sessions have been revoked.';
    if(secret){history.replaceState(null,'',`#${page==='invitation'?'staff-login':'staff-reset'}`);element.querySelector('button').hidden=true;}
  });
}
function accountPage(){
  if(user.role==='CITIZEN'){
    $('#main').innerHTML=header('Account settings',`Signed in as ${esc(user.name||user.username)}`)+links()+`<p id="account-notice" role="status"></p><section class="panel"><h2>Google and Facebook sign-in</h2><p>Manage your password and account recovery directly with your sign-in provider. Use the same provider to return to this citizen account.</p></section>`;
    logout();return;
  }
  $('#main').innerHTML=header('Account settings',`Signed in as ${esc(user.name||user.username)} · ${esc(user.role)}`)+links()+`<p id="account-notice" role="status"></p><div class="two-col"><section class="panel"><h2>Change password</h2>${form('password-form',field('Current password','current_password','password','autocomplete="current-password"')+passwords(),'Change password')}</section><section class="panel"><h2>Staff account</h2><p>Official email: ${esc(user.official_email)}</p><p class="warning">Contact your administrator to enroll or replace your authenticator.</p></section></div>`;
  bind('#password-form',async(data,output,element)=>{await api('/auth/password',data);element.reset();output.textContent='Password changed. Your other sessions have been revoked.';});
  logout();
}
async function complaintPage(page,action,id,version){
  const staff=user.role!=='CITIZEN';
  const [catalog,items]=await Promise.all([!staff&&action==='new'?api('/catalog'):null,api('/complaints')]);if(version!==routeVersion)return;
  let body=header(staff?(user.role==='ADMIN'?'Administrator dashboard':'Officer dashboard'):'My complaints',staff?'Review authorized complaints and record progress.':'Your reports are saved to your account. Complaint content may identify you; this service is not anonymous.')+links()+'<p id="account-notice" role="status"></p>';
  if(action==='view'&&id){
    const c=await api('/complaints/'+encodeURIComponent(id));
    const officers=user.role==='ADMIN'?await api('/admin/officers'):[];if(version!==routeVersion)return;
    body+=`<section class="panel"><h2>${esc(c.category)} · ${esc(c.status)}</h2><p>${esc(c.description)}</p><small>Reference: ${esc(c.id)}</small><h3>Updates</h3>${c.updates.map(u=>`<div class="audit"><strong>${esc(u.new_status)}${u.visibility==='INTERNAL'?' · Internal staff note':''}</strong><p>${esc(u.note)}</p><small>${esc(new Date(u.created_at).toLocaleString())}</small></div>`).join('')||'<p>No updates yet.</p>'}</section>`;
    if(staff){const next={Submitted:['Rejected'],Assigned:['In progress','Rejected'],'In progress':['Rejected'],Resolved:['Closed','In progress'],Closed:[],Rejected:[]};body+=`<section class="panel"><h2>Add an update</h2>${form('update-form',select('Status','status',simpleOptions([c.status,...next[c.status]]),c.status)+select('Visibility','visibility',[{id:'PUBLIC',name:'Citizen-visible response'},{id:'INTERNAL',name:'Internal staff note'}],'PUBLIC')+'<label>Action note<textarea name="note" maxlength="1500" required></textarea></label><p class="note">Resolving complaints remains unavailable until evidence support is implemented.</p>','Save update')}</section>`;}
    if(user.role==='ADMIN')body+=`<section class="panel"><h2>Assign / reassign</h2>${form('assign-form',select('Officer','officer_id',officers.filter(o=>o.status==='ACTIVE'&&o.department_id===c.department_id&&o.jurisdiction_id===c.jurisdiction_id)),'Assign complaint')}</section>`;
    $('#main').innerHTML=body;logout();
    bind('#update-form',async data=>{await api(`/complaints/${encodeURIComponent(id)}/updates`,data);await renderAccount(page,action,id);});
    bind('#assign-form',async data=>{await api(`/admin/complaints/${encodeURIComponent(id)}/assign`,data);await renderAccount(page,action,id);});return;
  }
  if(!staff)body+=`<p><a class="button primary" href="#complaints/new">New complaint</a></p>`;
  if(!staff&&action==='new')body+=`<section class="panel"><h2>Report a problem</h2>${!catalog.departments.length||!catalog.jurisdictions.length?'<p class="warning">The administrator must configure departments and jurisdictions before reports can be submitted.</p>':form('complaint-form',select('Facility','facility',facilities,id)+select('Department','department_id',catalog.departments,catalog.departments.length===1?catalog.departments[0].id:'')+select('Jurisdiction','jurisdiction_id',catalog.jurisdictions,catalog.jurisdictions.length===1?catalog.jurisdictions[0].id:'')+select('Issue category','category',simpleOptions(['Not working','No water','Unclean','Unsafe','Locked / inaccessible','Overcharging','Damaged','Other']))+'<label>What happened?<textarea name="description" required minlength="10" maxlength="1500"></textarea></label>','Submit complaint')}</section>`;
  body+=`<section class="panel"><h2>${staff?'Complaint inbox':'Your reports'}</h2><div class="table-wrap"><table><thead><tr><th>Facility / issue</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>${items.map(c=>`<tr><td>${esc(facilities.find(f=>f.id===c.facility)?.name||c.facility)}<br>${esc(c.category)}</td><td>${esc(c.status)}</td><td>${esc(new Date(c.created_at).toLocaleDateString())}</td><td><a class="button" href="#${staff?'government':'complaints'}/view/${esc(c.id)}">View</a></td></tr>`).join('')}</tbody></table>${items.length?'':'<div class="empty">'+(staff?'No complaints are available in your authorized inbox.':'No complaints yet. Submit your first report to track it here.')+'</div>'}</div></section>`;
  $('#main').innerHTML=body;logout();bind('#complaint-form',async data=>{await api('/complaints',data);location.hash='complaints';});
}
async function adminPage(page,version){
  if(user.role!=='ADMIN')throw Error('Only administrators can access this page.');
  let body=header(page==='officers'?'Officer management':page==='catalog'?'Departments and jurisdictions':'Audit history','Administrator workspace')+links()+'<p id="account-notice" role="status"></p>';
  if(page==='audit'){const items=await api('/admin/audit');if(version!==routeVersion)return;$('#main').innerHTML=body+`<section class="panel"><h2>Latest 200 events</h2>${items.map(i=>`<div class="audit"><strong>${esc(i.action)}</strong><small>${esc(i.created_at)} · Actor: ${esc(i.actor_id||'Local setup')} · ${esc(i.target_type)} ${esc(i.target_id)}</small></div>`).join('')||'<p>No events.</p>'}</section>`;logout();return;}
  const catalog=await api('/catalog');const officers=page==='officers'?await api('/admin/officers'):[];if(version!==routeVersion)return;
  if(page==='catalog'){
    for(const type of ['departments','jurisdictions'])body+=`<section class="panel"><h2>${type==='departments'?'Departments':'Jurisdictions'}</h2>${form('new-'+type,field('Name','name','text','maxlength="120"'),'Add')}${catalog[type].map(i=>form('edit-'+i.id,field('Name','name','text',`maxlength="120" value="${esc(i.name)}"`),'Rename')).join('')}</section>`;
    $('#main').innerHTML=body;logout();
    for(const type of ['departments','jurisdictions']){bind('#new-'+type,async data=>{await api('/admin/'+type,data);await renderAccount(page);});for(const i of catalog[type])bind('#edit-'+i.id,async(data,output)=>{await api(`/admin/${type}/${i.id}`,data,'PATCH');output.textContent='Name updated.';});}return;
  }
  const scope=(o={})=>select('Department','department_id',catalog.departments,o.department_id)+select('Jurisdiction','jurisdiction_id',catalog.jurisdictions,o.jurisdiction_id);
  body+=`<section class="panel"><h2>Invite an officer</h2><p>Officers set their own password. Setup must be completed before you approve access.</p>${form('officer-form',field('Name','name','text','maxlength="120"')+field('Official email','official_email','email','maxlength="254"')+scope(),'Create pending officer')}</section><section class="panel"><h2>Officers</h2>${officers.map(o=>`<details><summary>${esc(o.name)} · ${esc(o.status)} · ${o.setup_complete?'Password set':'Awaiting setup'}</summary><p>${esc(o.official_email)}</p>${form('edit-'+o.id,field('Name','name','text',`value="${esc(o.name)}" maxlength="120"`)+scope(o)+select('Account status','status',simpleOptions(['PENDING','ACTIVE','DISABLED']),o.status),'Save officer')}${o.status==='PENDING'?`<button class="button" data-invite="${o.id}">Resend invitation email</button>`:''}</details>`).join('')||'<div class="empty">No officers yet. Add departments and jurisdictions, then invite an officer.</div>'}</section>`;
  $('#main').innerHTML=body;logout();bind('#officer-form',async(data,output,element)=>{const result=await api('/admin/officers',data);element.reset();output.textContent=result.message+' Refresh Officers to see the new account.';});
  for(const o of officers)bind('#edit-'+o.id,async(data,output)=>{await api('/admin/officers/'+o.id,data,'PATCH');output.textContent='Officer updated. Existing sessions revoked.';});
  document.querySelectorAll('[data-invite]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{const result=await api(`/admin/officers/${button.dataset.invite}/invite`,{});$('#account-notice').textContent=result.message;}catch(e){$('#account-notice').textContent=e.message;}finally{button.disabled=false;}});
}
export function isAccountRoute(page){return routes.has(page);}
export function cancelAccountRender(){routeVersion++;user=null;csrf=null;portal='citizen';profile();}
export async function renderAccount(page,action,id){
  if(globalThis.Capacitor?.isNativePlatform?.()){
    const main=$('#main');
    try{
      const {origin}=await (await fetch('hosted-origin.json')).json();
      if(!origin||new URL(origin).protocol!=='https:')throw Error();
      const link=document.createElement('a');link.className='button primary';link.href=origin+'/'+location.hash;link.textContent='Open secure account services';
      main.innerHTML=header('Account services','Continue in your browser for secure sign-in and synced reviews and drafts.');main.append(link);
    }catch{main.innerHTML=header('Account services','This Android build needs the hosted service address.');}
    return;
  }
  portal=staffRoutes.has(page)?'staff':'citizen';user=null;csrf=null;profile();
  const version=++routeVersion;$('#main').innerHTML='<section class="panel" role="status">Loading account services…</section>';
  try{
    const result=await api('/auth/session');if(version!==routeVersion)return;user=result.user;providers=result.providers||{};requiresStaffFactor=result.requiresStaffFactor!==false;profile();
    if(['login','register','recover','staff-login','staff-forgot','invitation','staff-reset'].includes(page)){publicPage(page,action);return;}
    if(!user){loginPage(portal==='staff');return;}
    if(page==='account'||page==='staff-account'){accountPage();return;}
    if(page==='complaints'&&user.role!=='CITIZEN'||page==='government'&&user.role==='CITIZEN'){throw Error(`You are signed in as ${user.role}. Use your dashboard or log out to switch accounts.`);}
    if(page==='complaints'||page==='government')await complaintPage(page,action,id,version);else await adminPage(page,version);
  }catch(e){if(version!==routeVersion)return;$('#main').innerHTML=header('Account services',esc(e.message))+(user?links():'<a class="button" href="#login">Try again</a>')+'<p id="account-notice" role="status"></p>';logout();}
}

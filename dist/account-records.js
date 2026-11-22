let visibleForm;
const prefix='js-account-outbox:';
async function request(path,options={}){
  const response=await fetch('/api'+path,{...options,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok)throw Error(result.message||'Account sync unavailable.');
  return result;
}
async function flush(session){
  const owner=session.user.id;
  for(const key of Object.keys(localStorage).filter(k=>k.startsWith(prefix+owner+':'))){
    const entry=JSON.parse(localStorage.getItem(key));
    if(!entry)continue;
    await request('/records/'+entry.id,{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify(entry)});
    localStorage.removeItem(key);
  }
}
function queue(owner,id,kind,data){
  localStorage.setItem(prefix+owner+':'+id,JSON.stringify({owner,id,kind,data}));
}
async function legacyId(kind,record){
  const canonical=JSON.stringify([kind,Object.entries(record).sort(([a],[b])=>a.localeCompare(b))]);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const hex=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20,32)].join('-');
}
export async function connectRecordForm(form,kind,facility){
  if(!form?.isConnected)return;
  const submit=form.querySelector('button:not([type]),button[type=submit]');
  submit.disabled=true;
  let session;
  try{session=await request('/auth/session');}catch{return}finally{submit.disabled=false;}
  if(!form.isConnected||session.user?.role!=='CITIZEN')return;
  const owner=session.user.id;
  const panel=document.createElement('section'),title=document.createElement('h3'),status=document.createElement('p'),list=document.createElement('ul'),upload=document.createElement('button');
  title.textContent=kind==='review'?'My synced reviews':'My synced assessments';
  status.setAttribute('role','status');
  upload.type='button';upload.className='button';upload.textContent='Import my existing device '+(kind==='review'?'reviews':'drafts');
  panel.append(title,status,list,upload);form.after(panel);
  submit.textContent='Save to my account';
  const notice=document.createElement('p');
  notice.textContent='Saving privately to '+(session.user.name||session.user.username||'your citizen account')+'.';
  form.prepend(notice);
  async function refresh(){
    const current=await request('/auth/session');
    if(current.user?.id!==owner){list.replaceChildren();submit.disabled=true;upload.disabled=true;throw Error('Account changed. Reopen this page.');}
    await flush(current);
    const entries=[];let after=0;
    for(;;){
      const page=await request('/records?after='+after);
      if(page.owner!==owner){list.replaceChildren();throw Error('Account changed. Reopen this page.');}
      entries.push(...page.items);
      if(page.items.length<100)break;
      after=page.items.at(-1).sequence_id;
    }
    list.replaceChildren();
    for(const entry of entries.reverse()){
      if(entry.kind!==kind||(facility&&entry.payload.facility!==facility))continue;
      const li=document.createElement('li'),v=entry.payload;
      li.textContent=kind==='review'?v.rating+'/5 · '+v.feedback:v.date+' · '+v.facility+' · '+v.condition+' · '+v.notes;
      list.append(li);
    }
    status.textContent='Synced with your account.';
  }
  const update=()=>refresh().catch(e=>{status.textContent=e.message+' Queued items stay on this device until sync succeeds.';});
  form.onsubmit=async e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    if(facility)data.facility=facility;
    const content=String(kind==='review'?data.feedback:data.notes).trim();
    if(!content){status.textContent='Enter some text before saving.';return;}
    try{queue(owner,crypto.randomUUID(),kind,data);}catch{status.textContent='Device storage unavailable. Your form is still open.';return;}
    form.reset();status.textContent='Saved on this device. Syncing…';await update();
  };
  upload.onclick=async()=>{
    try{
      const key=kind==='review'?'js-ratings-v1':'js-assessments-v1';
      const records=JSON.parse(localStorage.getItem(key)||'[]').filter(r=>!facility||r.facility===facility);
      for(const r of records)queue(owner,await legacyId(kind,r),kind,r);
      await update();
    }catch(e){status.textContent=e.message;}
  };
  visibleForm={form,update};
  await update();
}
export async function resumeAccountSync(){
  if(visibleForm?.form.isConnected)return visibleForm.update();
  visibleForm=null;
  try{const session=await request('/auth/session');if(session.user?.role==='CITIZEN')await flush(session);}catch{/* Pending entries remain until an authenticated retry. */}
}

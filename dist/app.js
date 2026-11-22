import {connectRecordForm,resumeAccountSync} from './account-records.js';
import {busStopDetails} from './bus-stops.js';
import {isAccountRoute,renderAccount,cancelAccountRender} from './account.js';
import {setupWalking} from './walking.js';
import {createFacilityMap} from './facility-map.js';
import {languages,normalizeLanguage,translate,localize} from './language.js';
import {facilities,wards,photoUrl,statusLabels,score,filterFacilities} from './data.js';
let facilityMap,searchTimer;
const $=s=>document.querySelector(s), main=$('#main'), dialog=$('#detail');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
let language=normalizeLanguage(read('js-language-v1','en'));
const refreshLanguage=(root=document.body)=>{document.documentElement.lang=language;localize(root,language)};
const currentRecords=items=>Array.isArray(items)?items.filter(item=>facilities.some(f=>f.id===item.facility)):[];
let assessments=currentRecords(read('js-assessments-v1',[])),ratings=currentRecords(read('js-ratings-v1',[]));
function save(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true}catch{toast('Storage is unavailable. This change lasts only for this session.');return false}}
function toast(message){$('#toast').textContent=message;refreshLanguage();$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4200)}
const date=s=>s?`<time datetime="${esc(s)}">${new Date(s).toLocaleDateString(`${language}-IN`,{day:'numeric',month:'short',year:'numeric'})}</time>`:'Not assessed';
const badge=f=>`<span class="badge ${f.status}">${statusLabels[f.status]}</span>`;
const options=(items,current)=>items.map(x=>`<option ${x===current?'selected':''}>${esc(x)}</option>`).join('');
const facilityOptions=id=>facilities.map(f=>`<option value="${f.id}" ${id===f.id?'selected':''}>${esc(f.name)}</option>`).join('');
function intro(kicker,title,description,action=''){return `<section class="intro"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action}</section>`}
function stats(items){return `<div class="stats">${items.map(([label,value,note,color=''])=>`<div class="stat"><span class="dot ${color}"></span><div class="label">${label}</div><strong>${value}</strong><small>${note}</small></div>`).join('')}</div>`}
function mapPage(){main.innerHTML=intro('YOUR NEIGHBOURHOOD, BETTER UNDERSTOOD','Find a place that works for you.','Explore civic amenities, see verified conditions, and help your community.',`<a class="button primary" href="#complaints/new">＋ Report a problem</a>`)+stats([['Listed amenities',facilities.length,'Thane dataset'],['Verified amenities',facilities.filter(f=>f.verified).length,'Confirmed by project owner'],['Needs attention',facilities.filter(f=>['partial','unusable'].includes(f.status)).length,'Partly usable or not usable','amber'],['Awaiting verification',facilities.filter(f=>!f.verified).length,'Amenity verification pending','grey']])+`<div class="toolbar"><input class="search" id="search" aria-label="Search facilities or wards" placeholder="⌕  Search an amenity or ward…"><details class="emergency-contact" id="emergency-contact"><summary>Emergency contact</summary><ul class="emergency-list" aria-label="Emergency helplines"><li><span>Women helpline</span><a href="tel:1091" aria-label="Call women helpline 1091" translate="no">1091</a></li><li><span>Police helpline</span><a href="tel:100" aria-label="Call police helpline 100" translate="no">100</a></li><li><span>National ambulance service</span><div><a href="tel:102" aria-label="Call national ambulance service 102" translate="no">102</a><a href="tel:108" aria-label="Call national ambulance service 108" translate="no">108</a></div></li><li><span>Integrated helpline</span><a href="tel:112" aria-label="Call integrated helpline 112" translate="no">112</a></li><li><span>Fire helpline</span><a href="tel:101" aria-label="Call fire helpline 101" translate="no">101</a></li></ul></details></div><div class="chips" aria-label="Amenity types">${['All amenities',...new Set(facilities.map(f=>f.type))].map((t,i)=>`<button class="chip ${i?'':'selected'}" data-type="${t}" aria-pressed="${!i}">${t}</button>`).join('')}</div><div class="explorer"><section class="street-map-panel"><div class="map-actions"><strong>Thane street map</strong><button class="button" id="city-view">Entire Thane</button><button class="button" id="facility-view">Show facilities</button></div><div class="map street-map" id="thane-map" aria-label="Interactive street map of Thane" translate="no"></div><section id="walking-controls" aria-label="Directions"><div class="map-actions"><button class="button" id="my-location">My location</button><button class="button" id="stop-location" hidden>Stop live location</button><button class="button" id="manual-start">Use map centre as start</button></div><p class="note">For a manual start, pan the map until the starting street is at the centre. Walking and driving directions send both endpoints to the routing provider. The key-free FOSSGIS service logs route requests.</p><p id="location-status" role="status"></p><p id="route-status" role="status"></p><p id="arrival" role="status" hidden>You appear to have arrived. <button class="button" id="arrival-end">End directions</button></p><div id="walk-actions" hidden><button class="button route-close" id="close-route" aria-label="Close directions">×</button><label>Travel mode <select id="route-mode"><option value="walk">Walk</option><option value="bus">Bus</option><option value="drive">Drive</option></select></label><label id="along-option" hidden><input type="checkbox" id="along-route"> Show amenities within 150 m of route</label><button class="button" id="update-walk">Update route</button> <button class="button" id="clear-walk">End directions</button> <small>Road routes by Valhalla / openrouteservice · Bus data by Aayush Rai · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Fix the map</a></small></div></section><p class="note" id="map-message" role="status">Loading street map. Internet is required for roads and buildings.</p><div class="map-legend category-legend" aria-label="Map symbols"><span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-6 -5 L0 -3 L6 -5 L6 5 L0 7 L-6 5 Z M0 -3 V7"/></svg>Libraries</span><span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-2 -6 H2 V-2 H6 V2 H2 V6 H-2 V2 H-6 V-2 H-2 Z"/></svg>Medical facilities</span><span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -7 L-5 -1 H-3 L-6 4 H6 L3 -1 H5 Z M0 4 V8"/></svg>Parks</span><span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -7 C-2 -3 -6 0 -6 3 A6 6 0 0 0 6 3 C6 0 2 -3 0 -7 Z"/></svg>Drinking water</span><span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-5 -6 A1 1 0 1 0 -5 -4 A1 1 0 1 0 -5 -6 M-5 -2 V6 M-7 1 H-3 M0 -6 V7 M4 -6 A1 1 0 1 0 4 -4 A1 1 0 1 0 4 -6 M4 -2 L1 3 H7 Z M3 3 V7 M5 3 V7"/></svg>Public toilets</span><span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-6 -6 H6 V5 H-6 Z M-6 0 H6 M-3 5 V7 M3 5 V7 M-3 3 H-2 M2 3 H3"/></svg>Bus stops</span></div><div class="map-legend"><span><i class="dot"></i>Verified</span><span><i class="dot"></i>Usable</span><span><i class="dot amber"></i>Partly usable</span><span><i class="dot red"></i>Not usable</span><span><i class="dot grey"></i>Unverified</span><span><i class="dot bus-highway"></i>Bus stop near highway</span><span><i class="dot bus-local"></i>Other bus stop</span></div></section><section id="amenity-results"><div class="list-head"><h2>Explore amenities</h2><span id="count"></span></div><div class="facility-list" id="facilities"></div><div class="list-pagination"><button class="button" id="list-prev">Previous</button><span id="list-page" role="status" aria-live="polite"></span><button class="button" id="list-next">Next</button></div></section></div><div class="callout"><div><h3>A listing is only the beginning.</h3><p>Field assessments show whether a facility is actually accessible, available and usable.</p></div><a class="button" href="#analytics">Explore the index ↗</a></div>`;
facilityMap=createFacilityMap($('#thane-map'),$('#map-message'),facilityDetail,setupWalking);$('#city-view').onclick=()=>facilityMap.cityView();$('#facility-view').onclick=()=>facilityMap.showFacilities();
let type='All amenities', page=0, found=[], indexedLanguage, searchText;
const pageSize=40;
function drawList(){
  const visible=found.slice(page*pageSize,(page+1)*pageSize);
  $('#facilities').innerHTML=visible.map(f=>`<button class="facility" data-facility="${f.id}"><div class="facility-top"><div><h3>${esc(f.name)}</h3><p>${esc(f.type)}${f.type==='Bus stops'?'':' · '+esc(f.ward??'Ward unknown')}</p></div><span class="score" aria-label="Illustrative CAAUI score">${score(f.scores)??'—'}</span></div>${f.type==='Bus stops'?busStopDetails(f,esc,true):badge(f)}${Number.isFinite(f.latitude)&&Number.isFinite(f.longitude)?'':'<span class="note">Location pending</span>'}<span class="verified">${f.verified?date(f.verified):'Not yet verified'}</span></button>`).join('')||'<div class="empty">No matching amenities.<br>Try another filter or search.</div>';
  $('#facilities').scrollTop=0;
  $('#list-page').textContent=found.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,found.length)} / ${found.length}`:'0 / 0';
  $('#list-prev').disabled=page===0;
  $('#list-next').disabled=(page+1)*pageSize>=found.length;
  main.querySelectorAll('[data-facility]').forEach(b=>b.onclick=()=>{facilityMap.focus(b.dataset.facility);facilityDetail(b.dataset.facility)});
  refreshLanguage($('#amenity-results'));
}
function update(){
  if(indexedLanguage!==language){
    searchText=new Map(facilities.map(f=>[f.id,`${f.address??''} ${f.name} ${f.ward??''} ${f.locality} ${f.facility_id} ${f.amenity_subtype.replaceAll('_',' ')} ${f.type} ${translate(f.name,language)} ${translate(f.ward??'',language)}`.toLocaleLowerCase()]));
    indexedLanguage=language;
  }
  const query=$('#search').value.toLocaleLowerCase();
  found=filterFacilities({query:'',type}).filter(f=>searchText.get(f.id).includes(query));
  page=0;
  $('#count').textContent=`${found.length} facilities · ${found.filter(f=>Number.isFinite(f.latitude)&&Number.isFinite(f.longitude)).length} mapped`;
  facilityMap.update(found);
  drawList();
}
$('#list-prev').onclick=()=>{if(page>0){page--;drawList();}};
$('#list-next').onclick=()=>{if((page+1)*pageSize<found.length){page++;drawList();}};
$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(update,180);});
main.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{
  clearTimeout(searchTimer);type=b.dataset.type;
  main.querySelectorAll('[data-type]').forEach(c=>{c.classList.toggle('selected',c===b);c.setAttribute('aria-pressed',c===b)});
  update();
});
update();}

function show(content){$('#detail-content').innerHTML=`<button class="close" aria-label="Close dialog">×</button>${content}`;$('.close').onclick=()=>dialog.close();refreshLanguage();dialog.showModal()}
function facilityDetail(id){
  const f=facilities.find(f=>f.id===id);
  if(!f)return;
  show(`<h1>${esc(f.name)}</h1>
    ${Number.isFinite(f.latitude)&&Number.isFinite(f.longitude)?'<label>Travel mode <select id="facility-mode"><option value="walk">Walk</option><option value="bus">Bus</option><option value="drive">Drive</option></select></label><button class="button primary" id="walk-here">Directions</button><p class="note">Walking and driving directions send both endpoints to the routing provider. The key-free FOSSGIS service logs route requests.</p>':''}
    ${f.type==='Bus stops'?busStopDetails(f,esc):`<div class="facility-photos">${[f.cover_photo_path,...f.photos.filter(p=>p!==f.cover_photo_path)].filter(Boolean).map((p,i)=>`<a href="${esc(photoUrl(p))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(photoUrl(p))}" alt="${esc(f.name)} — Photo ${i+1}"></a>`).join('')}</div>`}
    <section class="panel"><h2>Report a problem</h2><p>Something wrong with this amenity? Let us know.</p><a class="button primary" id="report-link" href="#complaints/new/${id}">Report a problem</a></section>
    <form id="rating-form"><h2>Share feedback</h2><label>Your rating<select name="rating">${options(['5','4','3','2','1'])}</select></label><label>Feedback<textarea name="feedback" maxlength="500" required></textarea></label><button class="button primary">Submit feedback</button></form>
    <section class="amenity-reviews" aria-labelledby="reviews-heading"><h2 id="reviews-heading">Reviews</h2><div id="amenity-reviews" aria-live="polite"></div></section>`);
  if ($('#walk-here')) {
    if (facilityMap.walking.active) $('#walk-here').textContent = 'Switch destination';
    $('#facility-mode').value = $('#route-mode').value;
    $('#walk-here').onclick=()=>{const mode=$('#facility-mode').value;dialog.close();facilityMap.walking.select(f,mode);};
  }
  $('#report-link').onclick=()=>dialog.close();
  function renderReviews(){
    const reviews=ratings.filter(r=>r.facility===id).slice().reverse();
    $('#amenity-reviews').innerHTML=reviews.length?reviews.map(r=>`<article class="audit"><strong>${esc(r.rating)} / 5 ★</strong><small>${date(r.at)}</small><p translate="no">${esc(r.feedback)}</p></article>`).join(''):'<p class="note">No reviews yet. Be the first to share feedback.</p>';
    refreshLanguage();
  }
  connectRecordForm($('#rating-form'),'review',id);
  renderReviews();
  $('#rating-form').onsubmit=e=>{
    e.preventDefault();
    const d=new FormData(e.target), feedback=String(d.get('feedback')??'').trim(), rating=Number(d.get('rating'));
    if(!feedback||feedback.length>500||!Number.isInteger(rating)||rating<1||rating>5){toast('Please enter feedback and a rating from 1 to 5.');return}
    ratings.push({facility:id,rating,feedback,at:new Date().toISOString()});
    const persisted=save('js-ratings-v1',ratings);
    e.target.reset();
    renderReviews();
    $('#amenity-reviews').scrollIntoView({block:'nearest'});
    if(persisted)toast('Feedback added to reviews and saved on this device.');
  };
}
function analytics(){const scores=facilities.map(f=>score(f.scores)).filter(x=>x!==null);main.innerHTML=intro('EVIDENCE FOR BETTER DECISIONS','Look beyond the number of facilities.','Review Thane facility coverage and verification gaps.',`<button class="button" id="export">↓ Export facility CSV</button>`)+stats([['Illustrative mean CAAUI',score(scores)??'Insufficient data','No scores without assessments'],['Verified amenities',facilities.filter(f=>f.verified).length+' / '+facilities.length,'Confirmed by project owner'],['Fully usable',facilities.filter(f=>f.status==='usable').length+' / '+facilities.length,'Unknown is not unusable'],['Facility photos',facilities.reduce((n,f)=>n+f.photos.length,0),'Source documentation','amber']])+`<div class="two-col"><section class="panel"><h2>Facility score comparison</h2><p>CAAUI · 0–100 · illustrative equal weights</p>${facilities.filter(f=>score(f.scores)!==null).map(f=>`<div class="bar-row"><span>${esc(f.name)}</span><div class="bar"><i style="width:${score(f.scores)??0}%"></i></div><strong>${score(f.scores)??'—'}</strong></div>`).join('')||'<p class="note">No assessed scores are available yet.</p>'}</section><section class="panel"><h2>Provision–usability gap</h2><p>Imported listings compared with verified usable facilities.</p><div class="table-wrap"><table><thead><tr><th>WARD</th><th>LISTED</th><th>USABLE</th><th>PARTLY</th></tr></thead><tbody>${wards.map(w=>{const fs=facilities.filter(f=>(f.ward??'Ward unknown')===w);return `<tr><td>${esc(w)}</td><td>${fs.length}</td><td>${fs.filter(f=>f.status==='usable').length}</td><td>${fs.filter(f=>f.status==='partial').length}</td></tr>`}).join('')}</tbody></table></div><h3 style="margin-top:28px">Where to start</h3><p>Confirm entrance locations, wards and service conditions on site before assigning scores. Photo timestamps are not assessment dates.</p><p class="note">Ward coverage-adjusted scores need population and geographic data. They are not calculated in this skeleton.</p></section></div><section class="panel"><h2>A transparent starting point</h2><p>Each available dimension contributes equally to the demo facility score. Missing values are excluded, never scored as zero. Research weights, normalisation, score version history and regional coverage metrics remain to be defined.</p></section>`;$('#export').onclick=()=>{const rows=[['facility_id','facility','ward','type','field_status','last_verified','illustrative_caaui'],...facilities.map(f=>[f.id,f.name,f.ward,f.type,f.status,f.verified??'',score(f.scores)??''])];const csv=rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='jansuvidha-thane-facilities.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};}
function assessment(){main.innerHTML=intro('FIELDWORK','Better evidence starts on the ground.','A structured assessment form for the first survey workflow.')+`<div class="two-col"><section class="panel"><h2>Save an assessment draft</h2><p>Sign in to sync private drafts across devices. Guest drafts are saved on this device.</p><form id="assessment-form"><label>Facility<select name="facility">${facilityOptions()}</select></label><label>Assessment date<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Observed condition<select name="condition">${options(['Usable','Partly usable','Not usable','Unable to assess'])}</select></label><div class="checks"><label><input type="checkbox" name="water"> Water available</label><label><input type="checkbox" name="accessible"> Step-free access</label><label><input type="checkbox" name="clean"> Clean</label></div><label>Field notes<textarea name="notes" required maxlength="1500"></textarea></label><button class="button primary">Save local draft</button><span class="support">GPS, timestamped photos and surveyor verification are required before a draft can become field evidence.</span></form></section><section class="panel"><h2>Assessment drafts</h2><div id="drafts"></div></section></div>`;function update(){$('#drafts').innerHTML=assessments.length?assessments.map(a=>`<div class="audit"><strong>${esc(facilities.find(f=>f.id===a.facility)?.name)}</strong><small>${esc(a.date)} · ${esc(a.condition)} · Draft only</small><p translate="no">${esc(a.notes)}</p></div>`).join(''):'<div class="empty">No drafts yet.<br>Your first fieldwork starts here.</div>';refreshLanguage()}update();$('#assessment-form').onsubmit=e=>{e.preventDefault();const d=new FormData(e.target);if(!String(d.get('notes')).trim()){toast('Please add field notes.');return}assessments.unshift({...Object.fromEntries(d),created:new Date().toISOString()});save('js-assessments-v1',assessments);update();toast('Assessment draft saved locally.');};connectRecordForm($('#assessment-form'),'assessment');}
function render(){clearTimeout(searchTimer);cancelAccountRender();facilityMap?.destroy();facilityMap=null;const [page='map',action,id]=location.hash.slice(1).split('/');const names={map:'Suvidha Map',complaints:'My complaints',government:'Government portal',analytics:'Analytics',assessment:'Field assessment'};$('#breadcrumb').textContent=names[page]??names.map;document.querySelectorAll('nav a').forEach(a=>{const active=a.hash==='#'+page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});if(isAccountRoute(page)){renderAccount(page,action,id);return;}else if(page==='analytics')analytics();else if(page==='assessment')assessment();else mapPage();refreshLanguage();}
const languageSelect=$('#language');
const themeSelect=$('#theme');
themeSelect.value=document.documentElement.dataset.theme;
themeSelect.onchange=()=>{
  document.documentElement.dataset.theme=themeSelect.value;
  save('js-theme-v1',themeSelect.value);
};
languageSelect.innerHTML=Object.entries(languages).map(([code,label])=>`<option value="${code}" lang="${code}">${label}</option>`).join('');
languageSelect.value=language;
languageSelect.onchange=()=>{language=normalizeLanguage(languageSelect.value);save('js-language-v1',language);refreshLanguage()};
document.addEventListener('click',event=>{const menu=$('#emergency-contact');if(menu?.open&&!menu.contains(event.target))menu.open=false;});
document.addEventListener('keydown',event=>{const menu=$('#emergency-contact');if(event.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary').focus();}});
window.addEventListener('online',resumeAccountSync);
window.addEventListener('pageshow',resumeAccountSync);
window.addEventListener('hashchange',render);render();

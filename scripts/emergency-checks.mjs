import {busStopDetails} from '../dist/bus-stops.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {facilities,filterFacilities,score} from '../dist/data.js';
import {translate} from '../dist/language.js';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const batch=JSON.parse(readFileSync(new URL('../public/data/thane/import-2026-11-19.json',import.meta.url),'utf8'));
const seen=new Set();
for(const r of batch.records){
 const f=facilities.find(f=>f.id===r.facility_id);assert.ok(f);
 if(r.action==='new_record'){
  assert.equal(f.status,'unverified');assert.equal(f.verified,null);
  assert.equal(f.latitude===null||f.longitude===null,r.location_pending);
  if(r.coordinates)assert.deepEqual([f.latitude,f.longitude],r.coordinates);
 }
 for(const p of r.pages){const k=`${r.source_pdf}:${p}`;assert.ok(!seen.has(k));seen.add(k);}
}
assert.equal(seen.size,195);assert.equal(batch.source_pages,195);
assert.equal(batch.records.filter(r=>r.action==='new_record').length,92);
assert.equal(batch.records.filter(r=>r.action==='existing_record_photos_added').length,2);
const elements=new Map();let mapped=[];
for(const id of ['#thane-map','#map-message','#city-view','#facility-view','#count','#facilities','#search','#list-prev','#list-next','#list-page','#amenity-results'])elements.set(id,{value:'',textContent:'',innerHTML:'',addEventListener(){}});
const main={innerHTML:'',querySelectorAll:()=>[]};
const ctx={main,setTimeout:fn=>{fn();return 1;},clearTimeout(){},busStopDetails,$:id=>{assert.ok(elements.has(id),`Unexpected removed control ${id}`);return elements.get(id);},intro:()=>'',stats:()=>'',facilities,filterFacilities,score,translate,language:'en',esc:s=>s??'',badge:()=>'',date:s=>s,refreshLanguage(){},facilityDetail(){},createFacilityMap:()=>({update:items=>{mapped=items},cityView(){},showFacilities(){}})};
runInNewContext(source.slice(source.indexOf('function mapPage()'),source.indexOf('function show('))+';mapPage();',ctx);
assert.equal(mapped.length,facilities.length);
const toolbar=main.innerHTML.split('<div class="toolbar">')[1].split('<div class="chips"')[0];
assert.doesNotMatch(toolbar,/id="(?:ward|usable|accessible)"/);
assert.match(toolbar,/<details[^>]*id="emergency-contact"/);
assert.equal((toolbar.match(/<li>/g)||[]).length,5);
assert.deepEqual([...toolbar.matchAll(/href="tel:(\d+)"/g)].map(m=>m[1]),['1091','100','102','108','112','101']);
for(const label of ['Emergency contact','Women helpline','Police helpline','National ambulance service','Integrated helpline','Fire helpline'])for(const lang of ['hi','mr'])assert.notEqual(translate(label,lang),label);
console.log('Passed: 195 source pages, 92 new amenities, retained records, coordinates, map render without removed filters, five emergency rows and six dialer links.');

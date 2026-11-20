import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {facilities,filterFacilities,score,busStops} from '../dist/data.js';
import {parseBusStops} from './import-bus.mjs';
import {busStopDetails} from '../dist/bus-stops.js';
import {translate} from '../dist/language.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const geo=JSON.parse(read('../public/data/bus/thane_bus_stops.geojson'));
assert.deepEqual(parseBusStops(geo),busStops);
assert.equal(busStops.length,geo.features.length-2);
assert.ok(!busStops.some(s=>['OSM-BUS-13195950511','OSM-BUS-13195950512'].includes(s.id)));
for(const stop of busStops){
 const original=geo.features.find(f=>f.properties.id===stop.id).properties;
 const expected=Boolean(original.name?.trim()||original.routes_known);
 assert.equal(Boolean(stop.verified),expected);
 assert.equal(stop.status,expected?'verified':'unverified');
 assert.equal(stop.verification_basis,expected?'project_owner_rule':'unnamed_and_no_route_association');
}
// Exercise all four combinations, regardless of current OSM coverage.
for(const name of ['', 'Named stop'])for(const routes of [[],['1']]){
 const feature=structuredClone(geo.features[0]);
 Object.assign(feature.properties,{name,routes,routes_known:routes.length>0});
 const [stop]=parseBusStops({type:'FeatureCollection',features:[feature]});
 assert.equal(Boolean(stop.verified),Boolean(name||routes.length));
}
assert.equal(filterFacilities({type:'Bus stops'}).length,busStops.length);
const known=busStops.find(s=>s.routes_known),unknown=busStops.find(s=>!s.routes_known);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const stop of [known,unknown])assert.doesNotMatch(busStopDetails(stop,esc),/Buses:|Bus routes not known yet|Destination:|bus-route-list/);
const hostile={...known,address:'<img src=x onerror=alert(1)>',routes:['<script>bad</script>'],route_details:[{ref:'<b>1</b>',operator:'<img>',destination:'<svg>'}]};
assert.doesNotMatch(busStopDetails(hostile,esc),/<(?:img|script|svg|b)>/);
assert.match(busStopDetails(hostile,esc),/&lt;img/);
assert.throws(()=>parseBusStops({...geo,features:[geo.features[0],geo.features[0]]}));
const wrong=structuredClone(geo.features[0]);wrong.geometry.coordinates[0]=NaN;
assert.throws(()=>parseBusStops({type:'FeatureCollection',features:[wrong]}));
let mapped=[], mapUpdates=0;
const pending=new Map();let timerId=0;
const flushSearch=()=>{const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn());};
const elements=new Map();
for(const id of ['#thane-map','#map-message','#city-view','#facility-view','#count','#facilities','#search','#list-prev','#list-next','#list-page','#amenity-results'])elements.set(id,{value:'',innerHTML:'',hidden:true,addEventListener(name,fn){this[name]=fn;}});
const chips=['All amenities','Bus stops','Parks'].map(type=>({dataset:{type},classList:{toggle(){}},setAttribute(){}}));
const main={innerHTML:'',querySelectorAll(selector){return selector==='[data-type]'?chips:selector==='input,select'?[elements.get('#search')]:[];}};
const ctx={setupWalking(){},main,searchTimer:undefined,setTimeout:fn=>{pending.set(++timerId,fn);return timerId;},clearTimeout:id=>pending.delete(id),$:id=>{assert.ok(elements.has(id),id);return elements.get(id);},intro:()=>'',stats:()=>'',facilities,filterFacilities,score,translate,language:'en',esc,badge:()=>'',date:s=>s,busStopDetails,refreshLanguage(){},facilityDetail(){},createFacilityMap:()=>({update:items=>{mapped=items;mapUpdates++},cityView(){},showFacilities(){}})};
const source=read('../dist/app.js');
runInNewContext(source.slice(source.indexOf('function mapPage()'),source.indexOf('function show('))+';mapPage();',ctx);
chips[1].onclick();assert.equal(mapped.length,busStops.length);
const visibleIds=()=>[...elements.get('#facilities').innerHTML.matchAll(/data-facility="([^"]+)"/g)].map(m=>m[1]);
assert.equal(visibleIds().length,40);
const seenIds=new Set(visibleIds()), initialMapUpdates=mapUpdates;
while(!elements.get('#list-next').disabled){elements.get('#list-next').onclick();visibleIds().forEach(id=>seenIds.add(id));assert.ok(visibleIds().length<=40);}
assert.equal(seenIds.size,busStops.length,'Pagination must retain access to every bus stop');
assert.equal(mapUpdates,initialMapUpdates,'Changing list page must not redraw the map');
assert.equal(elements.get('#list-next').disabled,true);
const beforeTyping=mapUpdates;
for(const query of ['W','Wa','Wag']){elements.get('#search').value=query;elements.get('#search').input();}
assert.equal(mapUpdates,beforeTyping,'Typing must wait for the debounce');
assert.equal(pending.size,1,'Only the latest search may remain scheduled');
flushSearch();assert.equal(mapUpdates,beforeTyping+1);assert.equal(elements.get('#list-prev').disabled,true);
elements.get('#search').value='';chips[1].onclick();
assert.ok(busStops.every(f=>!Object.hasOwn(f,'routes')&&!Object.hasOwn(f,'route_details')),'Browser payload must omit research route arrays');

assert.doesNotMatch(main.innerHTML,/bus-route-filter|id="bus-route"/);
assert.doesNotMatch(elements.get('#facilities').innerHTML,/Buses:|Bus routes not known yet/);
elements.get('#search').value=known.name;elements.get('#search').input();flushSearch();assert.ok(mapped.some(s=>s.id===known.id));
elements.get('#search').value='';chips[2].onclick();assert.ok(mapped.length>0&&mapped.every(s=>s.type==='Parks'));
elements.get('#search').value='IMPOSSIBLE-SEARCH-NO-RESULT';elements.get('#search').input();flushSearch();assert.equal(mapped.length,0);
// Detail dialog must show bus information, without an empty photo gallery.
let detail='';const detailNodes={'#report-link':{},'#rating-form':{},'#amenity-reviews':{}};
const detailCtx={facilities,busStopDetails,esc,show:html=>{detail=html},$:id=>detailNodes[id],ratings:[],refreshLanguage(){},photoUrl:s=>s,options:()=>'',date:s=>s,dialog:{close(){}}};
runInNewContext(source.slice(source.indexOf('function facilityDetail('),source.indexOf('function analytics('))+`;facilityDetail('${known.id}');`,detailCtx);
assert.match(detail,/Address:/);assert.doesNotMatch(detail,/Buses:|Bus routes not known yet|bus-route-list/);assert.doesNotMatch(detail,/facility-photos/);
console.log('Passed: bus import, 40-card pagination, debounced search, smaller bus payload, stop-only cards, name search, category switching, empty search, safe OSM text and photo-free bus details.');

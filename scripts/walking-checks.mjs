import assert from 'node:assert/strict';
import {setupWalking} from '../dist/walking.js';
import {walkingRoute} from './walking-route.mjs';
import {facilities} from '../dist/data.js';

const facility = facilities.find(f => f.type === 'Public toilets' && Number.isFinite(f.longitude));
const body = {origin:{latitude:19.2,longitude:72.99}, facilityId:facility.id};
const geometry = {type:'LineString',coordinates:[[72.99,19.2],[facility.longitude,facility.latitude]]};
const success = await walkingRoute(body,'test-key',async (url, options) => {
  assert.equal(new URL(url).pathname,'/v2/directions/foot-walking/geojson');
  assert.equal(options.headers.Authorization,'test-key');
  const request = JSON.parse(options.body);
  assert.deepEqual(request.coordinates,geometry.coordinates);
  assert.equal(request.preference,'shortest');
  return Response.json({features:[{geometry,properties:{summary:{distance:600,duration:510}}}]});
});
assert.deepEqual(success,{status:200,geometry,distanceMeters:600,durationSeconds:510});
const publicRoute = await walkingRoute(body,'',async url => {
  assert.match(url,/routed-foot\/route\/v1\/foot\/72.99,19.2;/);
  return Response.json({routes:[{geometry,distance:600,duration:510}]});
});
assert.deepEqual(publicRoute,success);
assert.equal((await walkingRoute({...body,origin:{latitude:null,longitude:73}},'test')).status,400);
assert.equal((await walkingRoute({...body,facilityId:'missing'},'test')).status,404);
for (const [upstream, expected] of [[Response.json({error:{code:2010}},{status:404}),422],
  [Response.json({},{status:429}),429],[Response.json({features:[]}),502]]) {
  assert.equal((await walkingRoute(body,'test',async () => upstream)).status,expected);
}
console.log('Passed: shortest walking request, coordinate order, route geometry, errors and key handling.');

// Exercise the map controls with a moving GPS fix and delayed directions response.
const controls = new Map();
const control = id => {
  if (!controls.has(id)) controls.set(id,{});
  return controls.get(id);
};
globalThis.document = {querySelector:() => ({querySelector:control,scrollIntoView(){}})};
let fix, cleared, drawn, sent;
Object.defineProperty(navigator,'geolocation',{value:{
  watchPosition(fn){ fix=fn; return 7; }, clearWatch(id){ cleared=id; }
}});
const layer = () => ({addTo(){return this;},setLatLng(){return this;},setRadius(){},bringToFront(){},
  bringToBack(){},getBounds(){return [];},remove(){}});
const pane = {style:{}};
const map = {createPane:()=>pane,distance:()=>430,getCenter:()=>({lat:19.2,lng:73}),getZoom:()=>15,on(){},fitBounds(){},setView(){}};
let removed = 0;
const locationLayer = () => ({...layer(),remove(){removed++;}});
const walking = setupWalking(map,{svg:()=>({}),polyline:layer,circle:locationLayer,circleMarker:locationLayer,geoJSON:g=>{drawn=g;return layer();}});
assert.equal(pane.style.pointerEvents,'none');
let respond;
globalThis.fetch = async (url,opts) => {
  if (url.endsWith('/session')) return Response.json({csrf:'test'});
  sent = JSON.parse(opts.body);
  return new Promise(resolve => {respond=() => resolve(Response.json(success));});
};
walking.select(facility);
assert.match(control('#route-status').textContent,/choose a starting point/);
control('#my-location').onclick();
fix({coords:{...body.origin,accuracy:15},timestamp:Date.now()});
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(sent,body);
respond();
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(drawn,geometry);
assert.match(control('#route-status').textContent,/600 m on foot/);
control('#stop-location').onclick();
assert.equal(removed,2);
assert.equal(control('#route-status').textContent,'');
fix({coords:{...body.origin,accuracy:15},timestamp:Date.now()});
walking.select(facility);
assert.match(control('#route-status').textContent,/choose a starting point/);
control('#manual-start').onclick();
assert.match(control('#route-status').textContent,/430 m straight-line/);
assert.equal(cleared,7);
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(sent.origin,{latitude:19.2,longitude:73});
control('#clear-walk').onclick();
respond();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(control('#route-status').textContent,'');
assert.equal(control('#walk-actions').hidden,true);
walking.destroy();
console.log('Passed: live fix, manual start, walk preview, watch cleanup and cancellation of stale responses.');

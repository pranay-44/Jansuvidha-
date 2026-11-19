import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { facilities } from '../dist/data.js';

const serverSource=readFileSync(new URL('./api.mjs',import.meta.url),'utf8');
const mapSource=readFileSync(new URL('../dist/facility-map.js',import.meta.url),'utf8');
const tileOrigin=new URL(mapSource.match(/L\.tileLayer\('([^']+)'/)[1]).origin;
const imagePolicy=serverSource.match(/img-src ([^;]+);/)[1].split(' ');
assert.ok(imagePolicy.includes(tileOrigin),'CSP must permit the exact map tile origin');

// Exercise our map adapter without downloading map tiles during automated tests.
const calls = { markers: [], bounds: [], handlers: {}, allocations: 0 };
const map = {
  fitBounds: bounds => calls.bounds.push(bounds),
  setView: (point, zoom) => { calls.focus = { point, zoom }; },
  invalidateSize() {}, remove: () => { calls.removed = true; },
};
const layer = { addTo() { return this; }, clearLayers() { calls.markers = []; }, removeLayer(marker) { calls.markers=calls.markers.filter(m=>m!==marker); } };
const tiles = { addTo() { return this; }, on(event, handler) { calls.handlers[event] = handler; return this; } };
let canvasMethods;
const L = {
  Canvas:{prototype:{_updateCircle(){}},extend(methods){canvasMethods=methods;return class {};}},
  map: (container,options) => {assert.equal(options.preferCanvas,true);return map;}, layerGroup: () => layer, latLngBounds: points => points,
  tileLayer: (url, options) => { calls.tiles = { url, options }; return tiles; },
  divIcon: options => options,
  circleMarker(point, options) {
    calls.allocations++;
    const marker = { point, options, getLatLng: () => point,
      bindTooltip() { return this; },
      on(event, callback) { this[event] = callback; return this; },
      addTo() { calls.markers.push(this); return this; },
    };
    return marker;
  },
};
const context = { L, Path2D:class {constructor(path){this.path=path;}}, document: { createElement: () => ({}) }, ResizeObserver: class {
  observe() {} disconnect() { calls.disconnected = true; }
} };
const code = readFileSync(new URL('../dist/facility-map.js', import.meta.url),'utf8').replace(/^import .*;\r?\n/, '').replace('export function', 'function');
runInNewContext(code, context);
const message = {};
const controller = context.createFacilityMap({}, message, id => { calls.selected = id; });
controller.update(facilities);
const located = facilities.filter(f => Number.isFinite(f.latitude) && Number.isFinite(f.longitude));
assert.equal(calls.markers.length, located.length);
located.forEach((f, i) => {
  assert.equal(calls.markers[i].point[0], f.latitude);
  assert.equal(calls.markers[i].point[1], f.longitude);
});
const typeIcons=new Map();
located.forEach((f,i)=>{
  const options=calls.markers[i].options;
  assert.ok(options.renderer);
  assert.ok(options.amenityIcon.path);
  typeIcons.set(f.type,options.amenityIcon.path);
  if(f.type==='Bus stops')assert.equal(options.fillColor,f.on_highway?'#dc2626':'#2563eb');
});
assert.equal(new Set(typeIcons.values()).size,6,'Each category needs a distinct symbol');
let draws=0,saves=0,restores=0;
const canvas={_drawing:true,_ctx:{save(){saves++},restore(){restores++},translate(){},stroke(){draws++}}};
const point={_empty:()=>false,_point:{x:10,y:20},options:calls.markers[0].options};
canvasMethods._updateCircle.call(canvas,point);
assert.equal(draws,1);assert.equal(saves,restores);
canvas._drawing=false;canvasMethods._updateCircle.call(canvas,point);assert.equal(draws,1);
canvas._drawing=true;point._empty=()=>true;canvasMethods._updateCircle.call(canvas,point);assert.equal(draws,1);
const firstMarker=calls.markers[0];
const allocated=calls.allocations;
controller.update(facilities);
assert.equal(calls.allocations,allocated,'Unchanged results must reuse markers');
assert.equal(calls.markers.length,located.length);
calls.markers[0].click();
assert.equal(calls.selected, located[0].facility_id);
controller.focus(located[0].id);
assert.equal(calls.focus.zoom, 18);
controller.update([facilities[0], { ...facilities[1], latitude: null }]);
assert.equal(calls.markers.length, 1);
controller.showFacilities();
assert.equal(calls.bounds.at(-1).length, 1);
controller.update(facilities);
assert.equal(calls.allocations,allocated,'Clearing a filter must reuse the cached markers');
assert.equal(calls.markers.find(m=>m===firstMarker),firstMarker);
controller.update([]);
const previous = calls.bounds.length;
controller.showFacilities();
assert.equal(calls.bounds.length, previous);
calls.handlers.tileerror();
assert.match(message.textContent, /could not load/);
calls.handlers.loading(); calls.handlers.load();
assert.match(message.textContent, /Zoom in/);
assert.equal(calls.tiles.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
assert.match(calls.tiles.options.attribution, /OpenStreetMap contributors/);
controller.destroy();
assert.ok(calls.removed && calls.disconnected);
console.log('Passed: real marker coordinates, filter refresh, missing locations, selection, focus, empty results, tile failure/recovery and map cleanup.');

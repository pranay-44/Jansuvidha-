import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { facilities } from './dist/data.js';

const serverSource=readFileSync(new URL('./api.mjs',import.meta.url),'utf8');
const mapSource=readFileSync(new URL('./dist/facility-map.js',import.meta.url),'utf8');
const tileOrigin=new URL(mapSource.match(/L\.tileLayer\('([^']+)'/)[1]).origin;
const imagePolicy=serverSource.match(/img-src ([^;]+);/)[1].split(' ');
assert.ok(imagePolicy.includes(tileOrigin),'CSP must permit the exact map tile origin');

// Exercise our map adapter without downloading map tiles during automated tests.
const calls = { markers: [], bounds: [], handlers: {} };
const map = {
  fitBounds: bounds => calls.bounds.push(bounds),
  setView: (point, zoom) => { calls.focus = { point, zoom }; },
  invalidateSize() {}, remove: () => { calls.removed = true; },
};
const layer = { addTo() { return this; }, clearLayers() { calls.markers = []; } };
const tiles = { addTo() { return this; }, on(event, handler) { calls.handlers[event] = handler; return this; } };
const L = {
  map: () => map, layerGroup: () => layer, latLngBounds: points => points,
  tileLayer: (url, options) => { calls.tiles = { url, options }; return tiles; },
  divIcon: options => options,
  marker(point, options) {
    const marker = { point, options, getLatLng: () => point,
      bindTooltip() { return this; },
      on(event, callback) { this[event] = callback; return this; },
      addTo() { calls.markers.push(this); return this; },
    };
    return marker;
  },
};
const context = { L, document: { createElement: () => ({}) }, ResizeObserver: class {
  observe() {} disconnect() { calls.disconnected = true; }
} };
const code = readFileSync(new URL('./dist/facility-map.js', import.meta.url),'utf8').replace(/^import .*;\r?\n/, '').replace('export function', 'function');
runInNewContext(code, context);
const message = {};
const controller = context.createFacilityMap({}, message, id => { calls.selected = id; });
controller.update(facilities);
assert.equal(calls.markers.length, facilities.length);
facilities.forEach((f, i) => {
  assert.equal(calls.markers[i].point[0], f.latitude);
  assert.equal(calls.markers[i].point[1], f.longitude);
});
calls.markers[0].click();
assert.equal(calls.selected, facilities[0].facility_id);
controller.focus(facilities[0].id);
assert.equal(calls.focus.zoom, 18);
controller.update([facilities[0], { ...facilities[1], latitude: null }]);
assert.equal(calls.markers.length, 1);
controller.showFacilities();
assert.equal(calls.bounds.at(-1).length, 1);
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

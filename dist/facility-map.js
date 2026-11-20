import * as L from './vendor/leaflet/leaflet-src.esm.js';

// Initial city-wide viewport, not an administrative boundary.
const thaneBounds = [[19.10, 72.90], [19.34, 73.10]];
const colors = { verified: '#267852', usable: '#267852', partial: '#ac721c', unusable: '#b64b3b', unverified: '#536b82' };
const located = f => Number.isFinite(f.latitude) && Number.isFinite(f.longitude);

// Small vector pictograms drawn on the shared canvas, without per-pin DOM elements.
const iconPaths = {
  'Libraries':'M-6 -5 L0 -3 L6 -5 L6 5 L0 7 L-6 5 Z M0 -3 V7',
  'Medical facilities':'M-2 -6 H2 V-2 H6 V2 H2 V6 H-2 V2 H-6 V-2 H-2 Z',
  'Parks':'M0 -7 L-5 -1 H-3 L-6 4 H6 L3 -1 H5 Z M0 4 V8',
  'Drinking water':'M0 -7 C-2 -3 -6 0 -6 3 A6 6 0 0 0 6 3 C6 0 2 -3 0 -7 Z',
  'Public toilets':'M-5 -6 A1 1 0 1 0 -5 -4 A1 1 0 1 0 -5 -6 M-5 -2 V6 M-7 1 H-3 M0 -6 V7 M4 -6 A1 1 0 1 0 4 -4 A1 1 0 1 0 4 -6 M4 -2 L1 3 H7 Z M3 3 V7 M5 3 V7',
  'Bus stops':'M-6 -6 H6 V5 H-6 Z M-6 0 H6 M-3 5 V7 M3 5 V7 M-3 3 H-2 M2 3 H3',
};
// Leaflet 1.9.4 canvas hook keeps its existing hit-testing, clipping and redraw lifecycle.
const AmenityCanvas=L.Canvas.extend({
  _updateCircle(layer){
    L.Canvas.prototype._updateCircle.call(this,layer);
    if(!this._drawing||layer._empty()||!layer.options.amenityIcon)return;
    const ctx=this._ctx;
    ctx.save();
    ctx.translate(layer._point.x,layer._point.y);
    ctx.strokeStyle='#fff';ctx.lineWidth=1.4;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.stroke(layer.options.amenityIcon);
    ctx.restore();
  },
});

export function createFacilityMap(container, message, onSelect, setupWalking) {
  const map = L.map(container, { minZoom: 9, maxZoom: 19, scrollWheelZoom: false, preferCanvas: true });
  const cityView = () => map.fitBounds(thaneBounds, { padding: [12, 12] });
  cityView();
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    referrerPolicy: 'strict-origin-when-cross-origin',
  }).addTo(map);
  let failedTiles = false;
  tiles.on('loading', () => { failedTiles = false; });
  tiles.on('tileerror', () => {
    failedTiles = true;
    message.textContent = 'Street tiles could not load. Check your internet connection. Facility details remain available.';
  });
  tiles.on('load', () => {
    if (!failedTiles) message.textContent = 'Zoom in for roads and buildings. Facility pins use photo coordinates or OpenStreetMap locations; field verification is needed.';
  });
  const renderer=new AmenityCanvas({padding:.5});
  const icons=Object.fromEntries(Object.entries(iconPaths).map(([type,path])=>[type,new Path2D(path)]));
  const layer = L.layerGroup().addTo(map);
  const markers = new Map();
  let activeIds = new Set();
  const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  observer.observe(container);
  const walking = setupWalking?.(map, L);
  return {
    walking,
    update(facilities) {
      const wanted=facilities.filter(located);
      const nextIds=new Set(wanted.map(f=>f.id));
      for(const id of activeIds)if(!nextIds.has(id))layer.removeLayer(markers.get(id));
      for(const f of wanted){
        let marker=markers.get(f.id);
        if(!marker){
          const color=f.type==='Bus stops'?(f.on_highway?'#dc2626':'#2563eb'):(colors[f.status]??colors.unverified);
          // Canvas avoids a separate DOM icon for every stop. Keyboard access is provided by the paginated list.
          marker=L.circleMarker([f.latitude,f.longitude],{renderer,amenityIcon:icons[f.type],radius:12,color:'#fff',weight:1.5,fillColor:color,fillOpacity:.9});
          marker.bindTooltip(()=>{const label=document.createElement('span');label.textContent=`${f.name} · ${f.facility_id}`;return label;});
          marker.on('click',()=>{walking?.pauseFollow();onSelect(f.id);});
          markers.set(f.id,marker);
        }
        if(!activeIds.has(f.id))marker.addTo(layer);
      }
      activeIds=nextIds;
    },
    focus(id) {
      walking?.pauseFollow();
      const marker = markers.get(id);
      if (marker && activeIds.has(id)) map.setView(marker.getLatLng(), 18);
    },
    cityView() { walking?.pauseFollow(); cityView(); },
    showFacilities() {
      walking?.pauseFollow();
      const points = [...activeIds].map(id => markers.get(id).getLatLng());
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
    },
    destroy() { walking?.destroy(); observer.disconnect(); map.remove(); markers.clear(); activeIds.clear(); },
  };
}

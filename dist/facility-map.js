import * as L from './vendor/leaflet/leaflet-src.esm.js';

// Initial city-wide viewport, not an administrative boundary.
const thaneBounds = [[19.10, 72.90], [19.34, 73.10]];
const colors = { verified: '#267852', usable: '#267852', partial: '#ac721c', unusable: '#b64b3b', unverified: '#536b82' };
const located = f => Number.isFinite(f.latitude) && Number.isFinite(f.longitude);

export function createFacilityMap(container, message, onSelect) {
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
  const layer = L.layerGroup().addTo(map);
  const markers = new Map();
  let activeIds = new Set();
  const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  observer.observe(container);
  return {
    update(facilities) {
      const wanted=facilities.filter(located);
      const nextIds=new Set(wanted.map(f=>f.id));
      for(const id of activeIds)if(!nextIds.has(id))layer.removeLayer(markers.get(id));
      for(const f of wanted){
        let marker=markers.get(f.id);
        if(!marker){
          const color=f.type==='Bus stops'?(f.on_highway?'#b45309':'#2563eb'):(colors[f.status]??colors.unverified);
          // Canvas avoids a separate DOM icon for every stop. Keyboard access is provided by the paginated list.
          marker=L.circleMarker([f.latitude,f.longitude],{radius:7,color:'#fff',weight:1.5,fillColor:color,fillOpacity:.9});
          marker.bindTooltip(()=>{const label=document.createElement('span');label.textContent=`${f.name} · ${f.facility_id}`;return label;});
          marker.on('click',()=>onSelect(f.id));
          markers.set(f.id,marker);
        }
        if(!activeIds.has(f.id))marker.addTo(layer);
      }
      activeIds=nextIds;
    },
    focus(id) {
      const marker = markers.get(id);
      if (marker && activeIds.has(id)) map.setView(marker.getLatLng(), 18);
    },
    cityView,
    showFacilities() {
      const points = [...activeIds].map(id => markers.get(id).getLatLng());
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
    },
    destroy() { observer.disconnect(); map.remove(); markers.clear(); activeIds.clear(); },
  };
}

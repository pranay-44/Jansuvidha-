import * as L from './vendor/leaflet/leaflet-src.esm.js';

// Initial city-wide viewport, not an administrative boundary.
const thaneBounds = [[19.10, 72.90], [19.34, 73.10]];
const colors = { usable: '#267852', partial: '#ac721c', unusable: '#b64b3b', unverified: '#536b82' };
const located = f => Number.isFinite(f.latitude) && Number.isFinite(f.longitude);

export function createFacilityMap(container, message, onSelect) {
  const map = L.map(container, { minZoom: 9, maxZoom: 19, scrollWheelZoom: false });
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
    if (!failedTiles) message.textContent = 'Zoom in for roads and buildings. Facility pins use unconfirmed photo coordinates.';
  });
  const layer = L.layerGroup().addTo(map);
  const markers = new Map();
  const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  observer.observe(container);
  return {
    update(facilities) {
      layer.clearLayers();
      markers.clear();
      facilities.filter(located).forEach(f => {
        const icon = L.divIcon({
          className: 'facility-marker',
          html: `<span style="background:${colors[f.status] ?? colors.unverified}"></span>`,
          iconSize: [28, 36], iconAnchor: [14, 34],
        });
        const marker = L.marker([f.latitude, f.longitude], { icon, title: f.name, alt: f.name, keyboard: true });
        const label = document.createElement('span');
        label.textContent = `${f.name} · ${f.facility_id}`;
        marker.bindTooltip(label).on('click', () => onSelect(f.id)).addTo(layer);
        markers.set(f.id, marker);
      });
    },
    focus(id) {
      const marker = markers.get(id);
      if (marker) map.setView(marker.getLatLng(), 18);
    },
    cityView,
    showFacilities() {
      const points = [...markers.values()].map(marker => marker.getLatLng());
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
    },
    destroy() { observer.disconnect(); map.remove(); },
  };
}

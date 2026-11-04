import { cp, mkdir } from 'node:fs/promises';

const source = new URL('./node_modules/leaflet/', import.meta.url);
const target = new URL('./dist/vendor/leaflet/', import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ['leaflet-src.esm.js', 'leaflet.css', 'images']) {
  await cp(new URL('dist/' + file, source), new URL(file, target), { recursive: true });
}
await cp(new URL('LICENSE', source), new URL('LICENSE', target));

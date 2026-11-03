import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { parseFacilities, upsertFacilities } from './import-thane.mjs';
import { facilities, filterFacilities, score } from './dist/data.js';

const csv = await readFile(new URL('./public/data/thane/Thane_facilities.csv', import.meta.url), 'utf8');
const incoming = parseFacilities(csv);
const imported = JSON.parse(await readFile(new URL('./public/data/thane/facilities.json', import.meta.url), 'utf8'));
assert.deepEqual(upsertFacilities(imported, incoming), imported);
assert.deepEqual(upsertFacilities(imported, incoming), upsertFacilities(upsertFacilities(imported, incoming), incoming));
const changed = { ...incoming[0], name: 'Updated name, with a comma' };
const updated = upsertFacilities(imported, [changed]);
assert.equal(updated.length, imported.length);
assert.equal(updated.find(f => f.facility_id === changed.facility_id).name, changed.name);
assert.equal(updated.find(f => f.facility_id === changed.facility_id).id, changed.facility_id);
const header = 'facility_id,name,amenity_type,field_status,photo_count,latitude,longitude,photo_01_path\r\n';
const row = 'TEST-001,"Name, with a comma",park,unverified,0,19,72,\r\n';
assert.throws(() => parseFacilities(header + row + row), /duplicate facility_id/);
assert.throws(() => parseFacilities(header + row.replace('0,19,72,', '1,19,72,../photo.jpg')), /Unsafe photo path/);
assert.throws(() => parseFacilities(header + row.replace(',19,', ',not-a-number,')), /Invalid latitude/);
assert.equal(parseFacilities(header + row.replace('Name, with a comma', 'Name\nwith a comma'))[0].name, 'Name\nwith a comma');
assert.equal(facilities.length, imported.length);
assert.ok(facilities.every(f => f.id === f.facility_id && !/^F\d+$/.test(f.id)));
assert.equal(filterFacilities({query: incoming[0].facility_id}).length, 1);
for (const f of facilities) {
  for (const path of f.photos) {
    assert.ok((await stat(new URL('./public/data/thane/' + path, import.meta.url))).isFile());
    assert.ok((await stat(new URL('./dist/data/thane/' + path, import.meta.url))).isFile());
  }
  if (!f.verified_at) assert.equal(f.verified, null);
  assert.equal(score(f.scores), null);
  assert.equal(f.accessible, null);
}
console.log('Passed: repeat import, ID-based updates, retained records, quoted CSV, invalid input rejection, unknown values and every photo path.');

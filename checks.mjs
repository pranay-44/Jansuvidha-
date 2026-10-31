import assert from 'node:assert/strict';
import {score,filterFacilities,facilities} from './dist/data.js';
assert.equal(score([]),null);
assert.equal(score([100,null,undefined,0]),50);
assert.equal(filterFacilities({ward:'Ward 01',usable:true}).length,1);
assert.equal(filterFacilities({query:'NONEXISTENT'}).length,0);
assert.ok(filterFacilities({accessible:true}).every(f=>f.accessible));
assert.equal(new Set(facilities.map(f=>f.id)).size,facilities.length);
console.log('Passed: missing scores, averages, combined filters, empty results, accessibility, unique facility IDs.');

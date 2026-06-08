import assert from 'node:assert/strict';
import { surfaceOptionKeys } from './Surface';
import { surfaceOptionFieldKeys } from './surfaceValidate';

assert.deepEqual(
  [...surfaceOptionKeys].sort(),
  [...surfaceOptionFieldKeys].sort(),
  'surface host prop keys must carry every validated SurfaceOptions key',
);
assert.ok(surfaceOptionKeys.includes('edgeWear'));

console.log('Surface host tests passed');

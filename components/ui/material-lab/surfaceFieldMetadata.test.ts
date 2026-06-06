import assert from 'node:assert/strict';
import { surfaceFieldDefinitionByKey, surfaceFieldDefinitions } from './surfaceFieldMetadata';
import { surfaceOptionFieldKeys } from './surfaceValidate';

const metadataKeys = surfaceFieldDefinitions.map((definition) => definition.key);
const uniqueMetadataKeys = new Set(metadataKeys);

assert.equal(uniqueMetadataKeys.size, metadataKeys.length, 'surface field metadata must not contain duplicate keys');
assert.deepEqual(
  [...uniqueMetadataKeys].sort(),
  [...surfaceOptionFieldKeys].sort(),
  'surface field metadata must cover every validated SurfaceOptions key exactly once',
);

assert.equal(surfaceFieldDefinitionByKey.surfaceLayerBrightness.editMode, 'rest-and-state');
assert.equal(surfaceFieldDefinitionByKey.surfaceFilterBrightness.editMode, 'rest-and-state');
assert.equal(surfaceFieldDefinitionByKey.textY.editMode, 'rest-and-state');
assert.equal(surfaceFieldDefinitionByKey.stateVars.editMode, 'renderer-internal');
assert.equal(surfaceFieldDefinitionByKey.visualState.editMode, 'renderer-internal');

console.log('Surface field metadata tests passed');

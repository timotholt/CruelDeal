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
assert.equal(surfaceFieldDefinitionByKey.glassBlur.max, 24);
assert.equal(surfaceFieldDefinitionByKey.glassBlur.step, 0.25);
assert.equal(surfaceFieldDefinitionByKey.material.label, 'Base');
assert.equal(surfaceFieldDefinitionByKey.material.optionLabels?.black, 'pure black');
assert.equal(surfaceFieldDefinitionByKey.materialColor.label, 'Color');
assert.equal(surfaceFieldDefinitionByKey.bevelCorners.control, 'multi-toggle');
assert.equal(surfaceFieldDefinitionByKey.bevelCorners.label, 'Bevel');
assert.equal(surfaceFieldDefinitionByKey.bevelCorners.optionLabels?.['top-left'], 'TL');
assert.equal(surfaceFieldDefinitionByKey.radius.max, 30);
assert.equal(surfaceFieldDefinitionByKey.bevelSize.max, 30);
assert.ok(surfaceFieldDefinitionByKey.texture.options?.includes('silver01'));
assert.equal(surfaceFieldDefinitionByKey.texture.optionLabels?.silver01, 'Silver 01');
assert.equal(surfaceFieldDefinitionByKey.textureStrength.label, 'Tex Opacity');
assert.equal(surfaceFieldDefinitionByKey.textureScale.label, 'Tex Scale');
assert.deepEqual(surfaceFieldDefinitionByKey.textureScale.valueStops, [128, 256, 512, 1024]);
assert.equal(surfaceFieldDefinitionByKey.borderEnabled.label, 'Enabled');
assert.equal(surfaceFieldDefinitionByKey.borderColor.label, 'Color');
assert.equal(surfaceFieldDefinitionByKey.borderColor.optionLabels?.black, 'pure black');
assert.equal(surfaceFieldDefinitionByKey.borderCustomColor.label, 'Color Pick');
assert.equal(surfaceFieldDefinitionByKey.borderLit.label, 'Lit');
assert.equal(surfaceFieldDefinitionByKey.border.control, 'multi-toggle');
assert.ok(surfaceFieldDefinitionByKey.border.options?.includes('top'));
assert.equal(surfaceFieldDefinitionByKey.border.label, 'Sides');
assert.equal(surfaceFieldDefinitionByKey.borderOpacity.label, 'Alpha');
assert.equal(surfaceFieldDefinitionByKey.tint.label, 'Tint');
assert.ok(surfaceFieldDefinitionByKey.tint.options?.includes('gold'));
assert.equal(surfaceFieldDefinitionByKey.tintStrength.label, 'Tint Power');
assert.equal(surfaceFieldDefinitionByKey.gradient.label, 'Mode');
assert.equal(surfaceFieldDefinitionByKey.gradient.optionLabels?.['top-light'], 'top');
assert.equal(surfaceFieldDefinitionByKey.corners.control, 'multi-toggle');
assert.equal(surfaceFieldDefinitionByKey.corners.optionLabels?.['top-left'], 'TL');
assert.equal(surfaceFieldDefinitionByKey.edgeHighlight.control, 'multi-toggle');
assert.ok(surfaceFieldDefinitionByKey.edgeHighlight.options?.includes('bottom'));
assert.equal(surfaceFieldDefinitionByKey.glow.label, 'Glow');
assert.ok(surfaceFieldDefinitionByKey.glow.options?.includes('gold'));
assert.equal(surfaceFieldDefinitionByKey.lightStrength.label, 'White');
assert.equal(surfaceFieldDefinitionByKey.darkStrength.label, 'Dark');
assert.equal(surfaceFieldDefinitionByKey.sheen.label, 'Side Sheen');
assert.equal(surfaceFieldDefinitionByKey.emission.label, 'Type');
assert.equal(surfaceFieldDefinitionByKey.emission.optionLabels?.['center-blip'], 'blip');
assert.equal(surfaceFieldDefinitionByKey.emission.optionLabels?.['rail-and-blip'], 'rail + blip');
assert.deepEqual(surfaceFieldDefinitionByKey.emissionEdge.options, ['bottom']);
assert.ok(surfaceFieldDefinitionByKey.emissionTone.options?.includes('cyan'));
assert.equal(surfaceFieldDefinitionByKey.emissionStrength.label, 'Power');
assert.equal(surfaceFieldDefinitionByKey.emissionLength.min, 10);
assert.equal(surfaceFieldDefinitionByKey.emissionThickness.max, 8);
assert.equal(surfaceFieldDefinitionByKey.emissionBlipSize.max, 44);
assert.equal(surfaceFieldDefinitionByKey.glass.label, 'Enabled');
assert.equal(surfaceFieldDefinitionByKey.glassOpacity.label, 'Alpha');
assert.equal(surfaceFieldDefinitionByKey.glassOpacity.min, 1);
assert.equal(surfaceFieldDefinitionByKey.glassShine.label, 'Shine');
assert.equal(surfaceFieldDefinitionByKey.glassReflectionOpacity.label, 'Reflection');
assert.equal(surfaceFieldDefinitionByKey.glassReflectionOpacity.min, 1);
assert.equal(surfaceFieldDefinitionByKey.glassHighlightWidth.label, 'Shine Width');
assert.equal(surfaceFieldDefinitionByKey.glassHighlightHeight.label, 'Shine Height');
assert.equal(surfaceFieldDefinitionByKey.glassHighlightY.label, 'Shine Y');
assert.equal(surfaceFieldDefinitionByKey.edgeWear.control, 'toggle');
assert.ok(surfaceFieldDefinitionByKey.edgeWearTexture.options?.includes('edge-bw-noise-dense'));
assert.equal(surfaceFieldDefinitionByKey.edgeWearTexture.optionLabels?.['edge-bw-noise-dense'], 'Edge B/W Noise Dense');
assert.deepEqual(surfaceFieldDefinitionByKey.edgeWearScale.valueStops, [64, 128, 256, 512, 1024, 2048, 4096]);

console.log('Surface field metadata tests passed');

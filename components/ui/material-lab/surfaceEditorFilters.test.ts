import { strict as assert } from 'node:assert';
import {
  clearSurfaceField,
  patchSurfaceField,
  patchSurfaceFieldWithContext,
  surfaceFieldDisabledByCapabilities,
  visibleSurfaceFieldDefinitions,
} from './surfaceEditorFilters';
import { surfaceFieldDefinitionByKey } from './surfaceFieldMetadata';

const keys = (fields: ReturnType<typeof visibleSurfaceFieldDefinitions>) => fields.map((field) => field.key);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', groups: ['shadow'] })),
  ['dropShadow', 'shadowOpacity', 'shadowBlur', 'shadowX', 'shadowY', 'shadowSpread'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'state', groups: ['motion'] })),
  ['stateScale', 'stateTranslateY'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', groups: ['edgeWear'] })),
  ['edgeWear', 'edgeWearTexture', 'edgeWearOpacity', 'edgeWearWidth', 'edgeWearScale', 'edgeWearLayer'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', fields: ['glassBlurEnabled', 'glassBlur'] })),
  ['glassBlurEnabled', 'glassBlur'],
);

assert.equal(
  visibleSurfaceFieldDefinitions({ mode: 'rest', groups: ['renderer'] }).length,
  0,
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({
    mode: 'rest',
    groups: ['shadow'],
    capabilities: { hiddenFields: ['shadowBlur'] },
  })),
  ['dropShadow', 'shadowOpacity', 'shadowX', 'shadowY', 'shadowSpread'],
);

assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.edgeWearTexture, { disabledFields: ['edgeWearWidth'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.edgeWearWidth, { disabledFields: ['edgeWearWidth'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.edgeWearWidth, { disabledGroups: ['edgeWear'] }),
  true,
);

assert.deepEqual(patchSurfaceField('shadowBlur', 24), { shadowBlur: 24 });
assert.deepEqual(patchSurfaceFieldWithContext('texture', 'silver01', { textureStrength: 0 }), {
  texture: 'silver01',
  textureStrength: 100,
});
assert.deepEqual(patchSurfaceFieldWithContext('texture', 'stone04', { textureStrength: 38 }), {
  texture: 'stone04',
  textureStrength: 38,
});
assert.deepEqual(patchSurfaceFieldWithContext('texture', 'none', { textureStrength: 38 }), {
  texture: 'none',
  textureStrength: 0,
});
assert.deepEqual(patchSurfaceFieldWithContext('edgeWear', true, { edgeWearTexture: 'none', edgeWearOpacity: 0 }), {
  edgeWear: true,
  edgeWearTexture: 'edge-bw-noise-dense',
  edgeWearOpacity: 45,
  edgeWearWidth: 5,
  edgeWearScale: 256,
  edgeWearLayer: 'below-highlights',
});
assert.deepEqual(patchSurfaceFieldWithContext('edgeWear', false, { edgeWearTexture: 'edge-bw-chips-fine', edgeWearOpacity: 42 }), {
  edgeWear: false,
});
assert.deepEqual(patchSurfaceFieldWithContext('edgeWearTexture', 'none', { edgeWear: true, edgeWearOpacity: 42 }), {
  edgeWearTexture: 'none',
  edgeWear: false,
});
assert.deepEqual(patchSurfaceFieldWithContext('edgeWearTexture', 'edge-bw-chips-fine', { edgeWearOpacity: 0 }), {
  edgeWear: true,
  edgeWearTexture: 'edge-bw-chips-fine',
  edgeWearOpacity: 45,
});
assert.deepEqual(clearSurfaceField('shadowBlur'), { shadowBlur: undefined });

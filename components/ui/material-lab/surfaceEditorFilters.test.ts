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
  keys(visibleSurfaceFieldDefinitions({
    mode: 'state',
    fields: [
      'corners',
      'edgeHighlight',
      'glow',
      'glowStrength',
      'cornerSize',
    ],
  })),
  [
    'corners',
    'edgeHighlight',
    'glow',
    'glowStrength',
    'cornerSize',
  ],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({
    mode: 'state',
    fields: [
      'contentTone',
      'iconTone',
      'contentGlowStrength',
      'iconGlowStrength',
      'textEmboss',
      'fontWeight',
      'fontStyle',
      'textTransform',
      'letterSpacing',
    ],
  })),
  [
    'contentTone',
    'iconTone',
    'contentGlowStrength',
    'iconGlowStrength',
    'textEmboss',
    'fontWeight',
    'fontStyle',
    'textTransform',
    'letterSpacing',
  ],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({
    mode: 'state',
    fields: [
      'emission',
      'emissionEdge',
      'emissionTone',
      'emissionStrength',
      'emissionLength',
      'emissionThickness',
      'emissionBlipSize',
    ],
  })),
  [
    'emission',
    'emissionEdge',
    'emissionTone',
    'emissionStrength',
    'emissionLength',
    'emissionThickness',
    'emissionBlipSize',
  ],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', groups: ['base'] })),
  ['material', 'materialColor'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', fields: ['bevelCorners', 'radius', 'bevelSize'] })),
  ['bevelCorners', 'radius', 'bevelSize'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', fields: ['tint', 'tintStrength'] })),
  ['tint', 'tintStrength'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', fields: ['texture', 'textureStrength', 'textureScale'] })),
  ['texture', 'textureStrength', 'textureScale'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({
    mode: 'rest',
    fields: ['borderEnabled', 'borderColor', 'borderCustomColor', 'borderLit', 'border', 'borderOpacity'],
  })),
  ['borderEnabled', 'borderColor', 'borderCustomColor', 'borderLit', 'border', 'borderOpacity'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({
    mode: 'rest',
    fields: ['borderEnabled', 'borderColor', 'borderCustomColor', 'borderLit', 'border', 'borderOpacity'],
    capabilities: { hiddenFields: ['borderCustomColor'] },
  })),
  ['borderEnabled', 'borderColor', 'borderLit', 'border', 'borderOpacity'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', fields: ['gradient', 'lightStrength', 'darkStrength', 'sheen'] })),
  ['gradient', 'lightStrength', 'darkStrength', 'sheen'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({
    mode: 'rest',
    fields: [
      'glass',
      'glassOpacity',
      'glassShine',
      'glassReflectionOpacity',
      'glassHighlightWidth',
      'glassHighlightHeight',
      'glassHighlightY',
    ],
  })),
  [
    'glass',
    'glassOpacity',
    'glassShine',
    'glassReflectionOpacity',
    'glassHighlightWidth',
    'glassHighlightHeight',
    'glassHighlightY',
  ],
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
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.material, { disabledFields: ['materialColor'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.materialColor, { disabledFields: ['materialColor'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.bevelCorners, { disabledFields: ['bevelSize'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.bevelSize, { disabledFields: ['bevelSize'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.tint, { disabledFields: ['tintStrength'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.tintStrength, { disabledFields: ['tintStrength'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.texture, { disabledFields: ['textureStrength', 'textureScale'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.textureStrength, { disabledFields: ['textureStrength'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.textureScale, { disabledFields: ['textureScale'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.borderEnabled, { disabledFields: ['borderColor', 'border'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.borderColor, { disabledFields: ['borderColor'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.border, { disabledFields: ['border'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.borderOpacity, { disabledFields: ['borderOpacity'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.gradient, { disabledFields: ['lightStrength', 'darkStrength', 'sheen'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.lightStrength, { disabledFields: ['lightStrength'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.darkStrength, { disabledFields: ['darkStrength'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.sheen, { disabledFields: ['sheen'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.glass, { disabledFields: ['glassOpacity', 'glassShine'] }),
  false,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.glassOpacity, { disabledFields: ['glassOpacity'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.glassShine, { disabledFields: ['glassShine'] }),
  true,
);
assert.equal(
  surfaceFieldDisabledByCapabilities(surfaceFieldDefinitionByKey.glassReflectionOpacity, { disabledFields: ['glassReflectionOpacity'] }),
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

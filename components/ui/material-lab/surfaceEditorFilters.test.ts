import { strict as assert } from 'node:assert';
import {
  clearSurfaceField,
  patchSurfaceField,
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
  ['edgeWearTexture', 'edgeWearOpacity', 'edgeWearWidth', 'edgeWearScale', 'edgeWearLayer'],
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
assert.deepEqual(clearSurfaceField('shadowBlur'), { shadowBlur: undefined });

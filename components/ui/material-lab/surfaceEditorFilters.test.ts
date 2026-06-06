import { strict as assert } from 'node:assert';
import {
  clearSurfaceField,
  patchSurfaceField,
  visibleSurfaceFieldDefinitions,
} from './surfaceEditorFilters';

const keys = (fields: ReturnType<typeof visibleSurfaceFieldDefinitions>) => fields.map((field) => field.key);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'rest', groups: ['shadow'] })),
  ['dropShadow', 'shadowOpacity', 'shadowBlur', 'shadowX', 'shadowY', 'shadowSpread'],
);

assert.deepEqual(
  keys(visibleSurfaceFieldDefinitions({ mode: 'state', groups: ['motion'] })),
  ['stateScale', 'stateTranslateY'],
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

assert.deepEqual(patchSurfaceField('shadowBlur', 24), { shadowBlur: 24 });
assert.deepEqual(clearSurfaceField('shadowBlur'), { shadowBlur: undefined });

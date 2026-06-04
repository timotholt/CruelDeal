import assert from 'node:assert/strict';
import { AppFault, configureLogging } from '../../../utils/logger';
import { MATERIAL_SCHEMA_VERSION, validateSkinManifest } from './skinManifest';

configureLogging({ level: 'silent' });

const valid = {
  id: 'earned.gold',
  version: '1.0.0',
  displayName: 'Earned Gold',
  compatibility: {
    minClientVersion: '1.0.0',
    materialSchemaVersion: MATERIAL_SCHEMA_VERSION,
  },
  assets: [{ id: 'trim', url: '/art/textures/trim.png', kind: 'texture' }],
  recipePatches: {
    'cta-primary': { tint: 'gold', tintStrength: 30, glowStrength: 200 },
  },
};

configureLogging({ policy: 'continue' });

const parsed = validateSkinManifest(valid);
assert.ok(parsed);
assert.equal(parsed.recipePatches['cta-primary'].tint, 'gold');
assert.equal(parsed.recipePatches['cta-primary'].glowStrength, 100);

assert.equal(validateSkinManifest({ ...valid, recipePatches: { cta: { madeUp: 1 } } }), null);
assert.equal(validateSkinManifest({ ...valid, assets: [{ id: 'remote', url: 'https://example.com/a.png' }] }), null);

configureLogging({ policy: 'throw' });

assert.throws(() => validateSkinManifest({ ...valid, id: 'bad id!' }), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'skin.manifest.invalid');
  return true;
});
assert.doesNotThrow(() => validateSkinManifest(valid));

console.log('Skin manifest validation tests passed');

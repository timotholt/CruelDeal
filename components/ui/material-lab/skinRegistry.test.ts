import assert from 'node:assert/strict';
import { AppFault, configureLogging } from '../../../utils/logger';
import { MATERIAL_SCHEMA_VERSION } from './skinManifest';
import {
  clearDownloadedSkinsForTest,
  registerDownloadedSkin,
  resolveSurfaceForMaterial,
} from './skinRegistry';

configureLogging({ level: 'silent' });
configureLogging({ policy: 'continue' });
clearDownloadedSkinsForTest();

const downloaded = registerDownloadedSkin({
  id: 'earned.gold',
  version: '1.0.0',
  compatibility: {
    minClientVersion: '1.0.0',
    materialSchemaVersion: MATERIAL_SCHEMA_VERSION,
  },
  recipePatches: {
    'cta-primary': {
      material: 'custom',
      materialColor: '#332711',
      tint: 'gold',
      tintStrength: 34,
    },
  },
});

assert.ok(downloaded);

assert.equal(resolveSurfaceForMaterial({ materialId: 'cta-primary', skinId: 'earned.gold' })?.materialColor, '#332711');
assert.equal(resolveSurfaceForMaterial({ materialId: 'cta-primary', skinId: 'missing.skin' })?.materialColor, '#332711');
assert.equal(resolveSurfaceForMaterial({ materialId: 'cta-secondary', skinId: 'missing.skin' })?.materialColor, '#151a21');
assert.equal(resolveSurfaceForMaterial({ materialId: 'unknown-material', skinId: 'missing.skin' })?.material, 'white');

clearDownloadedSkinsForTest();
registerDownloadedSkin({
  id: 'future.skin',
  version: '1.0.0',
  compatibility: {
    minClientVersion: '99.0.0',
    materialSchemaVersion: MATERIAL_SCHEMA_VERSION,
  },
  recipePatches: {
    'cta-secondary': { materialColor: '#ff0000' },
  },
});

assert.equal(resolveSurfaceForMaterial({ materialId: 'cta-secondary', skinId: 'future.skin' })?.materialColor, '#151a21');

configureLogging({ policy: 'throw' });

assert.throws(() => registerDownloadedSkin({
  id: 'bad.skin',
  version: '1.0.0',
  compatibility: {
    minClientVersion: '1.0.0',
    materialSchemaVersion: MATERIAL_SCHEMA_VERSION,
  },
  recipePatches: {
    cta: { madeUp: 1 },
  },
}), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'skin.manifest.invalid');
  return true;
});

console.log('Skin registry tests passed');

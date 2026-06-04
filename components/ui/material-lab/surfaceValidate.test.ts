import assert from 'node:assert/strict';
import * as v from 'valibot';
import { AppFault, configureLogging } from '../../../utils/logger';
import { surfaceStatesSchema, validateSurfaceOptions } from './surfaceValidate';

configureLogging({ level: 'silent' });

// --- continue mode: log + coerce, never throw -------------------------------
configureLogging({ policy: 'continue' });

// Valid input passes through unchanged.
assert.deepEqual(
  validateSurfaceOptions({ material: 'custom', materialColor: '#707275', glowStrength: 50, tint: 'gold' }),
  { material: 'custom', materialColor: '#707275', glowStrength: 50, tint: 'gold' },
);

// Out-of-range numbers clamp to their bounds.
assert.equal(validateSurfaceOptions({ glowStrength: 200 }).glowStrength, 100);
assert.equal(validateSurfaceOptions({ glowStrength: -5 }).glowStrength, 0);

// Invalid enums drop to undefined (removed from output).
assert.equal('tint' in validateSurfaceOptions({ tint: 'banana' }), false);

// Malformed hex drops.
assert.equal('materialColor' in validateSurfaceOptions({ materialColor: 'red' }), false);

// Font-family with CSS-injection chars drops; clean family survives.
assert.equal('textFontFamily' in validateSurfaceOptions({ textFontFamily: 'url(evil)' }), false);
assert.equal(validateSurfaceOptions({ textFontFamily: 'DIN Condensed, sans-serif' }).textFontFamily, 'DIN Condensed, sans-serif');

// Unknown keys are stripped.
assert.equal('madeUp' in validateSurfaceOptions({ madeUp: 1, radius: 7 } as Record<string, unknown>), false);
assert.equal(validateSurfaceOptions({ madeUp: 1, radius: 7 } as Record<string, unknown>).radius, 7);

// Texture allowlist: a real id passes, a fake one drops.
assert.equal(validateSurfaceOptions({ texture: 'road012a' }).texture, 'road012a');
assert.equal('texture' in validateSurfaceOptions({ texture: 'definitely-not-a-texture' }), false);

// Non-object input yields an empty surface, no throw.
assert.deepEqual(validateSurfaceOptions(null), {});

// State overlays use strict keys with lenient surface values.
assert.deepEqual(
  v.parse(surfaceStatesSchema, { hover: { tint: 'gold', tintStrength: 28 } }),
  { hover: { tint: 'gold', tintStrength: 28 } },
);
assert.deepEqual(
  v.parse(surfaceStatesSchema, { hover: { tint: 'banana', tintStrength: 200 } }),
  { hover: { tintStrength: 100 } },
);
assert.throws(() => v.parse(surfaceStatesSchema, { hover: { tintStrength: 10, madeUp: 1 } }));

// --- throw mode: any issue faults -------------------------------------------
configureLogging({ policy: 'throw' });
assert.throws(() => validateSurfaceOptions({ tint: 'banana' }), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'surface.validate.invalid');
  return true;
});
assert.throws(() => validateSurfaceOptions({ glowStrength: 200 }), AppFault);
// Clean input does not fault even in throw mode.
assert.doesNotThrow(() => validateSurfaceOptions({ material: 'white', radius: 7 }));

console.log('Surface validation tests passed');

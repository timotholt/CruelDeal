import assert from 'node:assert/strict';
import { AppFault, configureLogging } from '../../../utils/logger';
import { validateUiNode } from './uiNodeValidate';

configureLogging({ level: 'silent' });

// --- continue mode: invalid -> null (fail closed), valid -> typed payload ---
configureLogging({ policy: 'continue' });

// A full, valid node tree round-trips.
const valid = {
  id: 'cta',
  type: 'button',
  variant: 'contract',
  surface: { material: 'custom', materialColor: '#707275', glowStrength: 50 },
  layout: { display: 'flex', direction: 'row', gap: 8, width: '100%', position: { inset: '0' } },
  contentBinding: 'contractCtaLabel',
  stateModel: 'momentary',
  action: { id: 'openContract', params: { contractId: 'c1', urgent: true } },
  children: [{ id: 'label', type: 'text', text: 'View Contract' }],
};
const parsed = validateUiNode(valid);
assert.ok(parsed);
assert.equal(parsed?.type, 'button');
assert.equal(parsed?.children?.[0]?.text, 'View Contract');
assert.equal(parsed?.action?.params?.urgent, true);

// Embedded surface clamps (glowStrength 200 -> 100) without failing the node.
assert.equal(validateUiNode({ id: 'a', type: 'panel', surface: { glowStrength: 200 } })?.surface?.glowStrength, 100);

// Structural failures fail closed -> null.
assert.equal(validateUiNode({ id: 'a', type: 'not-a-type' }), null); // bad enum
assert.equal(validateUiNode({ type: 'panel' }), null);               // missing id
assert.equal(validateUiNode({ id: 'a', type: 'panel', bogus: 1 }), null); // unknown key
assert.equal(validateUiNode({ id: 'a', type: 'panel', layout: { width: 'url(x)' } }), null); // bad dimension
assert.equal(validateUiNode('nope'), null);                          // not an object
// Nested invalid child fails the whole tree.
assert.equal(validateUiNode({ id: 'a', type: 'panel', children: [{ id: 'b', type: 'nope' }] }), null);

// --- throw mode: invalid faults --------------------------------------------
configureLogging({ policy: 'throw' });
assert.throws(() => validateUiNode({ id: 'a', type: 'not-a-type' }), (err: unknown) => {
  assert.ok(err instanceof AppFault);
  assert.equal((err as AppFault).code, 'ui.node.invalid');
  return true;
});
assert.doesNotThrow(() => validateUiNode({ id: 'a', type: 'panel' }));

console.log('UI node validation tests passed');

/**
 * Bridge tests (Step 8a).
 *
 * Builds a fake "old MatchState" in the demo shape, mounts a bridge
 * against it, and verifies:
 *   - translation preserves card ids and counts
 *   - stage/unstage/endTurn produce coherent engine events
 *   - parity assertions don't fire on in-sync operations
 *   - parity assertions DO fire when we intentionally diverge the two
 *
 * Run:
 *   npx tsx services/playgame/engine/adapter/bridge.test.ts
 */

import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import { mountBridge } from './bridge';
import { checkParity } from './parity';
import { liftMatchState, nameToDefId } from './translate';
import type {
  CardInstance as OldCardInstance,
  MatchState as OldMatchState,
} from '../../types';

// ---- Assertion shim --------------------------------------------------------

let failures = 0;
const pass = (label: string) => { console.log(`PASS: ${label}`); };
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail, null, 2) : ''}`);
};
const eq = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(label);
  else fail(label, { actual, expected });
};
const truthy = (cond: boolean, label: string) => cond ? pass(label) : fail(label);

// ---- Fixture builders ------------------------------------------------------

let idCounter = 0;
const nextId = () => `old-${++idCounter}`;

function oldCard(name: string, cost: number, power: number): OldCardInstance {
  return {
    id: nextId(),
    name,
    cost,
    power,
    basePower: power,
    type: 'striker',
    art: '#fff',
    text: '',
  };
}

function emptyOldState(): OldMatchState {
  return {
    turn: 3,
    energy: 3,
    energyMax: 3,
    hand: [],
    lanes: [[], [], []],
    enemyLanes: [[], [], []],
    locations: [
      { name: 'X', desc: '', art: '#000', revealed: false },
      { name: 'Y', desc: '', art: '#000', revealed: false },
      { name: 'Z', desc: '', art: '#000', revealed: false },
    ],
    selectedCardId: null,
    targeting: null,
    auras: {},
    pending: [],
    playedThisTurn: [],
    enemyPlayedThisTurn: [],
    incoming: [],
    history: [],
    resolving: false,
    playerHasPriority: true,
  };
}

// ============================================================================
// Tests
// ============================================================================

// -- nameToDefId: launch card names map correctly --------------------------

{
  eq(nameToDefId('HEX WITCH'),    'hex-witch',    'HEX WITCH → hex-witch');
  eq(nameToDefId('SKY MARSHAL'),  'sky-marshal',  'SKY MARSHAL → sky-marshal');
  eq(nameToDefId('DUNE SAPPER'),  'dune-sapper',  'DUNE SAPPER → dune-sapper');
  eq(nameToDefId('Sentinel'),     'sentinel',     'Sentinel → sentinel (case-insensitive)');
  eq(nameToDefId('  Blade Runner  '), 'blade-runner', 'leading/trailing whitespace trimmed');
}

// -- liftMatchState: populated hand survives translation --------------------

{
  idCounter = 0;
  const old = emptyOldState();
  old.hand = [oldCard('HEX WITCH', 2, 2), oldCard('SENTINEL', 3, 5)];
  const engine = liftMatchState(old, BOOTSTRAP_MANIFEST, 'test-seed');
  truthy(engine !== null, 'liftMatchState: returns non-null for known cards');
  eq(engine!.hand.PLAYER.length, 2, 'liftMatchState: 2 cards in engine hand');
  eq(engine!.hand.PLAYER[0].defId, 'hex-witch', 'liftMatchState: defId assigned');
  eq(engine!.hand.PLAYER[0].zone, 'HAND', 'liftMatchState: zone = HAND');
  eq(engine!.energy.PLAYER, 3, 'liftMatchState: energy carried over');
  eq(engine!.turn, 3, 'liftMatchState: turn carried over');
  eq(engine!.priority, 'PLAYER', 'liftMatchState: priority carried over');
}

// -- liftMatchState: unknown card → null (bridge goes inactive) ------------

{
  idCounter = 0;
  const old = emptyOldState();
  old.hand = [oldCard('TOTALLY UNKNOWN CARD', 1, 1)];
  const engine = liftMatchState(old, BOOTSTRAP_MANIFEST, 'test');
  eq(engine, null, 'liftMatchState: unknown defId → null');
}

// -- Bridge stage → engine sees CARD_STAGED + ENERGY_CHANGED ----------------

{
  idCounter = 0;
  const old = emptyOldState();
  const hex = oldCard('HEX WITCH', 2, 2);
  old.hand = [hex];
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'bridge-stage' });
  truthy(bridge.active, 'bridge mounted active');
  const events = bridge.stage(hex.id, 1);
  eq(events.length, 2, 'stage emits 2 events');
  eq(events[0].type, 'CARD_STAGED', 'stage[0] = CARD_STAGED');
  eq(events[1].type, 'ENERGY_CHANGED', 'stage[1] = ENERGY_CHANGED');
  const es = bridge.getState();
  eq(es.energy.PLAYER, 1, 'engine energy: 3 - 2 = 1');
  eq(es.lanes[1].cards.PLAYER.length, 1, 'engine lane 1 has 1 card');
  eq(es.stagingOrder.length, 1, 'stagingOrder tracks it');
}

// -- Bridge unstage → engine refunds ----------------------------------------

{
  idCounter = 0;
  const old = emptyOldState();
  const hex = oldCard('HEX WITCH', 2, 2);
  old.hand = [hex];
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'bridge-un' });
  bridge.stage(hex.id, 0);
  bridge.unstage(hex.id);
  const es = bridge.getState();
  eq(es.energy.PLAYER, 3, 'energy refunded after unstage');
  eq(es.lanes[0].cards.PLAYER.length, 0, 'lane 0 empty after unstage');
  eq(es.stagingOrder.length, 0, 'stagingOrder cleared');
}

// -- Bridge endTurn → full cascade emitted ---------------------------------

{
  idCounter = 0;
  const old = emptyOldState();
  old.turn = 2;
  const sen = oldCard('SENTINEL', 3, 5);
  old.hand = [sen];
  old.energy = 3;
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'bridge-end' });
  bridge.stage(sen.id, 0);
  const events = bridge.endTurn();
  truthy(events.some(e => e.type === 'CARD_FLIPPED'),  'endTurn: CARD_FLIPPED');
  truthy(events.some(e => e.type === 'TURN_ENDED'),    'endTurn: TURN_ENDED');
  truthy(events.some(e => e.type === 'TURN_STARTED'),  'endTurn: TURN_STARTED');
  const es = bridge.getState();
  eq(es.turn, 3, 'engine turn advanced to 3');
}

// -- Parity in sync: no mismatches when old and engine agree ---------------

{
  idCounter = 0;
  const old = emptyOldState();
  const sen = oldCard('SENTINEL', 3, 5);
  old.hand = [sen];
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'parity' });
  const report1 = checkParity(old, bridge.getState(), BOOTSTRAP_MANIFEST);
  eq(report1.ok, true, 'parity: initial state in sync');
}

// -- Parity divergence: UI-only mutation fails parity ----------------------

{
  idCounter = 0;
  const old = emptyOldState();
  const sen = oldCard('SENTINEL', 3, 5);
  old.hand = [sen];
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'parity-bad' });
  // Simulate UI-only mutation: adjust turn WITHOUT telling the engine.
  old.turn = 5;
  const report = checkParity(old, bridge.getState(), BOOTSTRAP_MANIFEST);
  eq(report.ok, false, 'parity: UI-only mutation detected');
  truthy(
    report.mismatches.some(m => m.field === 'turn'),
    'parity: reports the turn mismatch',
  );
}

// -- Parity lane-power: engine-added Ongoings are FINE (old can't know) ---

{
  // Put a Sentinel in PLAYER lane 0 (revealed) and a grunt next to it.
  // Old state reports raw power (5 + 3 = 8). Engine reports 5+1 + 3+1 = 10
  // (Sentinel's self-lane-buff Ongoing). Engine should be >= old, which
  // our checkParity tolerates.
  idCounter = 0;
  const old = emptyOldState();
  const sen = oldCard('SENTINEL', 3, 5);
  const grunt = oldCard('BLADE RUNNER', 2, 3);
  old.lanes[0] = [sen, grunt];
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'parity-onc' });
  const report = checkParity(old, bridge.getState(), BOOTSTRAP_MANIFEST);
  eq(report.ok, true, 'parity: engine-adds-Ongoing is NOT a mismatch');
}

// -- Inactive bridge: methods return empty arrays, never throw -------------

{
  idCounter = 0;
  const old = emptyOldState();
  old.hand = [oldCard('UNKNOWN', 1, 1)];
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'inactive' });
  eq(bridge.active, false, 'bridge inactive for unknown card');
  eq(bridge.stage('anything', 0).length, 0, 'stage on inactive: []');
  eq(bridge.endTurn().length, 0, 'endTurn on inactive: []');
  // assertParity must not throw.
  bridge.assertParity(old, 'noop');
  pass('inactive bridge: assertParity is a no-op');
}

// -- syncHandCard: UI draws get projected into engine hand -----------------

{
  idCounter = 0;
  const old = emptyOldState();
  const bridge = mountBridge(old, BOOTSTRAP_MANIFEST, { seed: 'sync' });
  bridge.syncHandCard('fresh-1', 'HEX WITCH', 'PLAYER');
  const es = bridge.getState();
  eq(es.hand.PLAYER.length, 1, 'syncHandCard: engine hand has 1');
  eq(es.hand.PLAYER[0].defId, 'hex-witch', 'syncHandCard: correct defId');
  eq(es.cards['fresh-1' as never]?.zone, 'HAND', 'syncHandCard: zone=HAND');
}

// ---- Exit -----------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll bridge tests passed.');
}

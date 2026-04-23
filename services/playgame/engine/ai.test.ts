/**
 * Engine AI tests.
 *
 * Run: npx tsx services/playgame/engine/ai.test.ts
 */

import { createRng } from './rng';
import { planEnemyTurnFromPool, planEnemyTurnFromHand } from './ai';
import type { CardDef, Manifest } from './manifest/types';
import type { CardInstance, LaneState, MatchState } from './types/state';
import type { CardId, LaneIdx, Owner } from './types/ids';

// ── Shim ────────────────────────────────────────────────────────────────────
let failures = 0;
const pass = (label: string) => console.log(`PASS: ${label}`);
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail, null, 2) : ''}`);
};
const eq = <T>(a: T, b: T, label: string) =>
  JSON.stringify(a) === JSON.stringify(b) ? pass(label) : fail(label, { actual: a, expected: b });
const truthy = (c: boolean, label: string) => (c ? pass(label) : fail(label));

// ── Fixtures ────────────────────────────────────────────────────────────────
const mkCard = (defId: string, basePower: number, cost: number): CardDef => ({
  defId, version: 1, name: defId, basePower, cost, tribes: [], abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
});

const mkManifest = (cards: CardDef[], disabled: string[] = []): Manifest => ({
  version: 1,
  protocolVersion: 1,
  constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12 },
  cards: Object.fromEntries(cards.map((c) => [c.defId, c])),
  locations: {},
  disabled: { cards: disabled, locations: [] },
});

const blankLane = (i: LaneIdx): LaneState => ({
  idx: i, location: null, locationRevealed: false, cards: { P0: [], P1: [] },
});

interface CardSpec {
  id?: string;
  def: string;
  owner: Owner;
  lane: LaneIdx | null;
  zone?: CardInstance['zone'];
}

let idCounter = 0;
const buildState = (
  specs: CardSpec[],
  opts: { energy?: Record<Owner, number> } = {},
): MatchState => {
  idCounter = 0;
  const cards: Record<CardId, CardInstance> = {};
  const hand: Record<Owner, CardInstance[]> = { P0: [], P1: [] };
  const deck: Record<Owner, CardInstance[]> = { P0: [], P1: [] };
  const lanes: [LaneState, LaneState, LaneState] = [blankLane(0), blankLane(1), blankLane(2)];
  for (const s of specs) {
    const id = (s.id ?? `c${++idCounter}`) as CardId;
    const zone = s.zone ?? 'HAND';
    const inst: CardInstance = {
      id, defId: s.def, version: 1, owner: s.owner,
      lane: zone === 'LANE' ? s.lane : null, zone,
      revealed: zone === 'LANE',
      powerDelta: 0, costDelta: 0, powerLog: [], costLog: [], tags: [], textOverride: null, counters: {},
      spawnSource: { kind: 'DECK_CREATION' },
    };
    cards[id] = inst;
    if (zone === 'LANE' && s.lane !== null) (lanes[s.lane].cards[s.owner] as CardId[]).push(id);
    else if (zone === 'HAND') hand[s.owner].push(inst);
    else if (zone === 'DECK') deck[s.owner].push(inst);
  }
  const eMap = opts.energy ?? { P0: 3, P1: 3 };
  return {
    turn: 3, maxEnergy: { P0: 3, P1: 3 }, nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT', seed: 'test', priority: 'P0',
    energy: eMap, deck, hand, cards, lanes,
    pending: [], stagingOrder: [], pendingEffects: [], log: [],
    lastPlayedBy: { P0: null, P1: null }, result: null,
    energyLog: { P0: [], P1: [] },
  };
};

// ════════════════════════════════════════════════════════════════════════════
// planEnemyTurnFromPool
// ════════════════════════════════════════════════════════════════════════════

// -- Respects energy budget -------------------------------------------------
{
  const manifest = mkManifest([mkCard('cheap', 2, 1), mkCard('mid', 3, 2), mkCard('big', 8, 5)]);
  const state = buildState([], { energy: { P0: 0, P1: 3 } });
  const plays = planEnemyTurnFromPool(state, 'P1', manifest, createRng('budget'));
  const total = plays.reduce((s, p) => s + p.cost, 0);
  truthy(total <= 3, `pool: total cost <= energy (got ${total})`);
  truthy(plays.length > 0, 'pool: at least one play with budget');
}

// -- Skips unaffordable cards -----------------------------------------------
{
  const manifest = mkManifest([mkCard('big', 8, 5)]); // only a 5-cost
  const state = buildState([], { energy: { P0: 0, P1: 3 } });
  const plays = planEnemyTurnFromPool(state, 'P1', manifest, createRng('nope'));
  eq(plays.length, 0, 'pool: no plays when everything is unaffordable');
}

// -- No plays when energy is 0 ----------------------------------------------
{
  const manifest = mkManifest([mkCard('cheap', 1, 0), mkCard('mid', 2, 1)]);
  const state = buildState([], { energy: { P0: 0, P1: 0 } });
  const plays = planEnemyTurnFromPool(state, 'P1', manifest, createRng('noenergy'));
  // With cost-0 cards allowed, maxPlays still caps it. Accept either 0 or maxPlays.
  truthy(plays.length === 0 || plays.every((p) => p.cost === 0), 'pool: 0-energy → only cost-0 plays');
}

// -- Respects lane capacity -------------------------------------------------
{
  const manifest = mkManifest([mkCard('cheap', 2, 1)]);
  // Fill lane 0 and 1 to cap. Only lane 2 has room for P1.
  const specs: CardSpec[] = [];
  for (let i = 0; i < 4; i++) specs.push({ def: 'cheap', owner: 'P1', lane: 0, zone: 'LANE' });
  for (let i = 0; i < 4; i++) specs.push({ def: 'cheap', owner: 'P1', lane: 1, zone: 'LANE' });
  const state = buildState(specs, { energy: { P0: 0, P1: 6 } });
  const plays = planEnemyTurnFromPool(state, 'P1', manifest, createRng('cap'));
  // Only 4 plays max (lane 2 has 4 slots).
  truthy(plays.length <= 4, `pool: respects total remaining capacity (got ${plays.length})`);
  truthy(plays.every((p) => p.lane === 2), 'pool: all plays land in lane 2 (only lane with room)');
}

// -- Ignores disabled cards -------------------------------------------------
{
  const manifest = mkManifest(
    [mkCard('good', 2, 1), mkCard('bad', 2, 1)],
    ['bad'],  // bad is in manifest.disabled.cards
  );
  const state = buildState([], { energy: { P0: 0, P1: 6 } });
  const plays = planEnemyTurnFromPool(state, 'P1', manifest, createRng('disabled'));
  truthy(plays.every((p) => p.defId !== 'bad'), 'pool: disabled cards never picked');
}

// -- Determinism ------------------------------------------------------------
{
  const manifest = mkManifest([mkCard('a', 1, 1), mkCard('b', 2, 2), mkCard('c', 3, 3)]);
  const state = buildState([], { energy: { P0: 0, P1: 5 } });
  const a = planEnemyTurnFromPool(state, 'P1', manifest, createRng('same'));
  const b = planEnemyTurnFromPool(state, 'P1', manifest, createRng('same'));
  eq(a, b, 'pool: same seed → identical plan');
  const c = planEnemyTurnFromPool(state, 'P1', manifest, createRng('different'));
  truthy(JSON.stringify(a) !== JSON.stringify(c), 'pool: different seed → (likely) different plan');
}

// -- maxPlays cap -----------------------------------------------------------
{
  const manifest = mkManifest([mkCard('free', 1, 0)]); // cost 0!
  const state = buildState([], { energy: { P0: 0, P1: 100 } });
  const plays = planEnemyTurnFromPool(state, 'P1', manifest, createRng('cap'), { maxPlays: 3 });
  eq(plays.length, 3, 'pool: maxPlays cap honored');
}

// -- Custom fork tag changes stream -----------------------------------------
{
  const manifest = mkManifest([mkCard('a', 1, 1), mkCard('b', 2, 1), mkCard('c', 3, 1)]);
  const state = buildState([], { energy: { P0: 0, P1: 2 } });
  const rng = createRng('base');
  const p1 = planEnemyTurnFromPool(state, 'P1', manifest, rng, { forkTag: 'tag-1' });
  const p2 = planEnemyTurnFromPool(state, 'P1', manifest, rng, { forkTag: 'tag-2' });
  // Both are valid plans (same length likely), but sequences probably differ.
  truthy(p1.length > 0 && p2.length > 0, 'pool: fork tags produce valid plans');
}

// ════════════════════════════════════════════════════════════════════════════
// planEnemyTurnFromHand
// ════════════════════════════════════════════════════════════════════════════

// -- Plays cards from hand in cost order ------------------------------------
{
  const manifest = mkManifest([mkCard('cheap', 2, 1), mkCard('mid', 3, 2), mkCard('big', 8, 5)]);
  const state = buildState(
    [
      { id: 'h1', def: 'big',   owner: 'P1', lane: null, zone: 'HAND' },
      { id: 'h2', def: 'mid',   owner: 'P1', lane: null, zone: 'HAND' },
      { id: 'h3', def: 'cheap', owner: 'P1', lane: null, zone: 'HAND' },
    ],
    { energy: { P0: 0, P1: 3 } },
  );
  const plays = planEnemyTurnFromHand(state, 'P1', manifest, createRng('hand'));
  // Total cost <= energy
  const total = plays.reduce((s, p) => s + (manifest.cards[state.cards[p.cardId].defId]?.cost ?? 0), 0);
  truthy(total <= 3, `hand: total cost <= energy (got ${total})`);
  // Should play cheap + mid (1+2=3), skip big (5>3)
  const defIds = plays.map((p) => state.cards[p.cardId].defId).sort();
  eq(defIds, ['cheap', 'mid'], 'hand: plays cheap+mid, skips unaffordable big');
}

// -- Respects lane capacity -------------------------------------------------
{
  const manifest = mkManifest([mkCard('cheap', 2, 1)]);
  const specs: CardSpec[] = [
    { id: 'h1', def: 'cheap', owner: 'P1', lane: null, zone: 'HAND' },
  ];
  // Fill all 3 lanes for P1.
  for (let lane = 0; lane < 3; lane++) {
    for (let i = 0; i < 4; i++) specs.push({ def: 'cheap', owner: 'P1', lane: lane as LaneIdx, zone: 'LANE' });
  }
  const state = buildState(specs, { energy: { P0: 0, P1: 3 } });
  const plays = planEnemyTurnFromHand(state, 'P1', manifest, createRng('full'));
  eq(plays.length, 0, 'hand: no plays when all lanes are full');
}

// -- Determinism ------------------------------------------------------------
{
  const manifest = mkManifest([mkCard('a', 1, 1), mkCard('b', 2, 1), mkCard('c', 3, 1)]);
  const state = buildState(
    [
      { id: 'h1', def: 'a', owner: 'P1', lane: null, zone: 'HAND' },
      { id: 'h2', def: 'b', owner: 'P1', lane: null, zone: 'HAND' },
      { id: 'h3', def: 'c', owner: 'P1', lane: null, zone: 'HAND' },
    ],
    { energy: { P0: 0, P1: 3 } },
  );
  const a = planEnemyTurnFromHand(state, 'P1', manifest, createRng('same'));
  const b = planEnemyTurnFromHand(state, 'P1', manifest, createRng('same'));
  eq(a, b, 'hand: same seed → identical plan');
}

// -- Empty hand --------------------------------------------------------------
{
  const manifest = mkManifest([mkCard('a', 1, 1)]);
  const state = buildState([], { energy: { P0: 0, P1: 3 } });
  const plays = planEnemyTurnFromHand(state, 'P1', manifest, createRng('empty'));
  eq(plays.length, 0, 'hand: empty hand → no plays');
}

// ── Exit ────────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll AI tests passed.');
}

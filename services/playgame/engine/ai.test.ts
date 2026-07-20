import { getCardState } from './projections/cardRuntime';
/**
 * Engine AI tests.
 *
 * Run: npx tsx services/playgame/engine/ai.test.ts
 */

import { createRng } from './rng';
import { planEnemyTurnFromHand } from './ai';
import type { CardDef, Manifest } from './manifest/types';
import type { InternalCardRecord, LaneState, MatchState } from './types/state';
import { EMPTY_CARD_LIFECYCLE, EMPTY_TRACKED_VARIABLES } from './types/state';
import type { CardId, LaneId, Owner } from './types/ids';
import {
  emptyTestMatchState,
  testLaneRegistry,
  testLaneState,
} from './testkit/runtimeFixture';

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
  defId, version: 1, name: defId, basePower, cost, cardType: 'character', abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
});

const mkManifest = (cards: CardDef[]): Manifest => ({
  version: 1,
  protocolVersion: 1,
  constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12, startingHandSize: 3, turnStartDraw: 1 },
  rulesets: { standard: {
    rulesetId: 'standard',
    deckConstruction: { defaultCopyLimit: 1 },
    laneRules: { initialLaneCount: 3, maximumActiveLaneCount: 3 },
    locationDeck: { minimumReserveCount: 0, copyLimit: 1 },
  } },
  cards: Object.fromEntries(cards.map((c) => [c.defId, c])),
  locations: {},
  disabled: { cards: [], locations: [] },
});

const blankLane = (i: LaneId): LaneState => testLaneState(i);

interface CardSpec {
  id?: string;
  def: string;
  owner: Owner;
  lane: LaneId | null;
  zone?: InternalCardRecord['zone'];
}

let idCounter = 0;
const buildState = (
  specs: CardSpec[],
  opts: { energy?: Record<Owner, number> } = {},
): MatchState => {
  idCounter = 0;
  const cards: Record<CardId, InternalCardRecord> = {};
  const hand: Record<Owner, CardId[]> = { P0: [], P1: [] };
  const deck: Record<Owner, CardId[]> = { P0: [], P1: [] };
  const lanes: [LaneState, LaneState, LaneState] = [blankLane(0), blankLane(1), blankLane(2)];
  for (const s of specs) {
    const id = (s.id ?? `c${++idCounter}`) as CardId;
    const zone = s.zone ?? 'HAND';
    const inst: InternalCardRecord = {
      id, defId: s.def, version: 1, owner: s.owner,
      lane: zone === 'LANE' ? s.lane : null, zone,
      revealed: zone === 'LANE',
      revealTiming: null,
      lifecycle: { ...EMPTY_CARD_LIFECYCLE },
      powerLedger: [], costDelta: 0, costLog: [], tags: [], textOverride: null,
    textLog: [], counters: {},
      spawnSource: { kind: 'DECK_CREATION' },
    };
    cards[id] = inst;
    if (zone === 'LANE' && s.lane !== null) (lanes[s.lane].cards[s.owner] as CardId[]).push(id);
    else if (zone === 'HAND') hand[s.owner].push(id);
    else if (zone === 'DECK') deck[s.owner].push(id);
  }
  const eMap = opts.energy ?? { P0: 3, P1: 3 };
  return emptyTestMatchState({
    turn: 3, maxEnergy: { P0: 3, P1: 3 }, nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT', rngSeed: 'test', priority: 'P0',
    energy: eMap, deck, hand,
    lanesById: testLaneRegistry(lanes),
    activeLaneOrder: [0, 1, 2],
    nextLaneId: 3,
    nextPendingEffectSequence: 0,
    locationDeck: {
      drawPile: [], staging: [], discardPile: [], destroyed: [], banished: [],
    },
    pending: [], stagedPlays: [], pendingEffects: [],
    lastPlayedBy: { P0: null, P1: null }, result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: EMPTY_TRACKED_VARIABLES,
    cards,
  });
};

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
  const total = plays.reduce((s, p) => s + (manifest.cards[getCardState(state, p.cardId)!.defId]?.cost ?? 0), 0);
  truthy(total <= 3, `hand: total cost <= energy (got ${total})`);
  // Should play cheap + mid (1+2=3), skip big (5>3)
  const defIds = plays.map((p) => getCardState(state, p.cardId)!.defId).sort();
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
    for (let i = 0; i < 4; i++) specs.push({ def: 'cheap', owner: 'P1', lane: lane as LaneId, zone: 'LANE' });
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

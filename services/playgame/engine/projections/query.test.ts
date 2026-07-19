/**
 * Query system tests.
 *
 * Run: npx tsx services/playgame/engine/projections/query.test.ts
 */

import type { CardDef, Manifest } from '../manifest/types';
import type { InternalCardRecord, LaneState, MatchState } from '../types/state';
import { EMPTY_CARD_LIFECYCLE } from '../types/state';
import type { CardId, LaneId, Owner } from '../types/ids';
import {
  matchesNum,
  matchesString,
  matchesCard,
  matchesCardDef,
  matchesLane,
  findCards,
  findCard,
  countCards,
  hasCards,
  findCardDefs,
  findCardDef,
  countCardDefs,
  findLanes,
  findLane,
} from './query';
import {
  emptyTestMatchState,
  testPowerLedger,
  testLaneRegistry,
  testLaneState,
} from '../testkit/runtimeFixture';

// ── Tiny assertion shim ──────────────────────────────────────────────────────
let failures = 0;
const pass = (label: string) => console.log(`PASS: ${label}`);
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail, null, 2) : ''}`);
};
const eq = <T>(a: T, b: T, label: string) =>
  JSON.stringify(a) === JSON.stringify(b) ? pass(label) : fail(label, { actual: a, expected: b });
const truthy = (c: boolean, label: string) => (c ? pass(label) : fail(label));

// ── Fixture builders ─────────────────────────────────────────────────────────
const mkCard = (defId: string, basePower: number, cost: number, extra: Partial<CardDef> = {}): CardDef => ({
  defId, version: 1, name: defId, basePower, cost, cardType: 'character', abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  ...extra,
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

interface CardSpec {
  id?: string;
  def: string;
  owner: Owner;
  lane: LaneId | null;
  zone?: InternalCardRecord['zone'];
  revealed?: boolean;
  storedPowerDelta?: number;
  costDelta?: number;
  tags?: InternalCardRecord['tags'];
  counters?: Record<string, number>;
  spawnSource?: InternalCardRecord['spawnSource'];
}

let idCounter = 0;
const buildState = (specs: CardSpec[]): MatchState => {
  idCounter = 0;
  const cards: Record<CardId, InternalCardRecord> = {};
  const hand: Record<Owner, CardId[]> = { P0: [], P1: [] };
  const deck: Record<Owner, CardId[]> = { P0: [], P1: [] };
  const lanes: [LaneState, LaneState, LaneState] = [
    testLaneState(0),
    testLaneState(1),
    testLaneState(2),
  ];
  for (const s of specs) {
    const id = (s.id ?? `c${++idCounter}`) as CardId;
    const zone = s.zone ?? 'LANE';
    const revealed = s.revealed ?? (zone === 'LANE');
    const inst: InternalCardRecord = {
      id, defId: s.def, version: 1, owner: s.owner,
      lane: zone === 'LANE' ? s.lane : null, zone,
      revealed,
      revealTiming: !revealed && s.lane !== null
        ? { kind: 'TURN', turn: 1 }
        : null,
      lifecycle: { ...EMPTY_CARD_LIFECYCLE },
      powerLedger: testPowerLedger(
        id,
        s.storedPowerDelta === undefined
          ? []
          : [{ kind: 'ADD', delta: s.storedPowerDelta }],
      ),
      costDelta: s.costDelta ?? 0,
      costLog: [],
      tags: s.tags ?? [],
      textOverride: null,
    textLog: [],
      counters: s.counters ?? {},
      spawnSource: s.spawnSource ?? { kind: 'DECK_CREATION' },
    };
    cards[id] = inst;
    if (zone === 'LANE' && s.lane !== null) (lanes[s.lane].cards[s.owner] as CardId[]).push(id);
    else if (zone === 'HAND') hand[s.owner].push(id);
    else if (zone === 'DECK') deck[s.owner].push(id);
  }
  return emptyTestMatchState({
    turn: 1, maxEnergy: { P0: 1, P1: 1 }, nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT', seed: 'test', priority: 'P0',
    energy: { P0: 1, P1: 1 },
    deck, hand, cards,
    lanesById: testLaneRegistry(lanes),
  });
};

// ════════════════════════════════════════════════════════════════════════════
// NumComparison / StringComparison
// ════════════════════════════════════════════════════════════════════════════

// NumComparison
truthy(matchesNum(3, 3), 'num: shorthand equality match');
truthy(!matchesNum(3, 4), 'num: shorthand equality mismatch');
truthy(matchesNum(3, { eq: 3 }), 'num: eq');
truthy(matchesNum(3, { ne: 4 }), 'num: ne');
truthy(matchesNum(2, { lt: 3 }), 'num: lt');
truthy(matchesNum(3, { lte: 3 }), 'num: lte');
truthy(matchesNum(4, { gt: 3 }), 'num: gt');
truthy(matchesNum(3, { gte: 3 }), 'num: gte');
truthy(matchesNum(3, { in: [1, 2, 3] }), 'num: in');
truthy(!matchesNum(5, { in: [1, 2, 3] }), 'num: in miss');
truthy(matchesNum(5, { nin: [1, 2, 3] }), 'num: nin');
truthy(matchesNum(3, { between: [2, 5] }), 'num: between (middle)');
truthy(matchesNum(2, { between: [2, 5] }), 'num: between (lo inclusive)');
truthy(matchesNum(5, { between: [2, 5] }), 'num: between (hi inclusive)');
truthy(!matchesNum(6, { between: [2, 5] }), 'num: between (out)');
truthy(matchesNum(3, { gte: 2, lte: 5 }), 'num: combined gte+lte');
truthy(!matchesNum(6, { gte: 2, lte: 5 }), 'num: combined gte+lte miss');

try {
  matchesNum(3, { between: [5, 2] });
  fail('num: invalid between should throw');
} catch { pass('num: invalid between throws'); }

// StringComparison
truthy(matchesString('foo', 'foo'), 'str: shorthand');
truthy(matchesString('foo', { eq: 'foo' }), 'str: eq');
truthy(matchesString('foo', { in: ['foo', 'bar'] }), 'str: in');
truthy(matchesString('fooBar', { startsWith: 'foo' }), 'str: startsWith');
truthy(matchesString('fooBar', { endsWith: 'Bar' }), 'str: endsWith');
truthy(matchesString('fooBar', { contains: 'oB' }), 'str: contains');

// ════════════════════════════════════════════════════════════════════════════
// CardFilter: zone / owner / lane
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([mkCard('grunt', 2, 1), mkCard('mage', 3, 2)]);
  const state = buildState([
    { id: 'h1', def: 'grunt', owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'h2', def: 'mage',  owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'l1', def: 'grunt', owner: 'P0', lane: 0 },
    { id: 'e1', def: 'grunt', owner: 'P1',    lane: 0 },
    { id: 'd1', def: 'grunt', owner: 'P0', lane: null, zone: 'DISCARD' },
  ]);

  eq(findCards(state, manifest, { zone: 'HAND' }).length, 2, 'zone: HAND count');
  eq(findCards(state, manifest, { zone: 'LANE' }).length, 2, 'zone: LANE count');
  eq(findCards(state, manifest, { zone: ['HAND', 'LANE'] }).length, 4, 'zone: array');
  eq(findCards(state, manifest, { owner: 'P0' }).length, 4, 'owner: P0');
  eq(findCards(state, manifest, { owner: 'P1' }).length, 1, 'owner: P1');
  eq(findCards(state, manifest, { zone: 'LANE', owner: 'P0' }).length, 1, 'combined zone+owner');
  eq(findCards(state, manifest, { lane: 0 }).length, 2, 'lane: exact');
  eq(findCards(state, manifest, { lane: 'any' }).length, 2, 'lane: any (cards on board)');
  eq(findCards(state, manifest, { lane: 'none' }).length, 3, 'lane: none (off-board)');
}

// ════════════════════════════════════════════════════════════════════════════
// CardFilter: cost / basePower / power / card type
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([
    mkCard('cheap', 2, 1, { cardType: 'character' }),
    mkCard('mid',   4, 3, { cardType: 'device' }),
    mkCard('big',   8, 5, { cardType: 'spell' }),
  ]);
  const state = buildState([
    { id: 'c1', def: 'cheap', owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'c2', def: 'mid',   owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'c3', def: 'big',   owner: 'P0', lane: null, zone: 'HAND' },
  ]);

  eq(findCards(state, manifest, { cost: 1 }).length, 1, 'cost: eq');
  eq(findCards(state, manifest, { cost: { lte: 3 } }).length, 2, 'cost: lte');
  eq(findCards(state, manifest, { cost: { gt: 1 } }).length, 2, 'cost: gt');
  eq(findCards(state, manifest, { cost: { between: [2, 4] } }).length, 1, 'cost: between');
  eq(findCards(state, manifest, { basePower: { gte: 4 } }).length, 1, 'basePower: gte excludes non-power-bearing spells');
  eq(findCards(state, manifest, { cardType: 'character' }).length, 1, 'cardType: single');
  eq(findCards(state, manifest, { cardType: ['device', 'spell'] }).length, 2, 'cardType: array');
}

// ════════════════════════════════════════════════════════════════════════════
// CardFilter: ability flags
// ════════════════════════════════════════════════════════════════════════════

{
  const vanilla = mkCard('vanilla', 2, 1);
  const revealer = mkCard('revealer', 3, 2, {
    abilities: { onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }] },
  });
  const ongoing = mkCard('ongoing', 1, 1, {
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 }, stack: 'ADDITIVE',
      }],
    },
  });
  const manifest = mkManifest([vanilla, revealer, ongoing]);
  const state = buildState([
    { id: 'v', def: 'vanilla',  owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'r', def: 'revealer', owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'o', def: 'ongoing',  owner: 'P0', lane: null, zone: 'HAND' },
  ]);

  eq(findCards(state, manifest, { hasOnReveal: true }).length, 1, 'hasOnReveal: true');
  eq(findCards(state, manifest, { hasOnReveal: false }).length, 2, 'hasOnReveal: false');
  eq(findCards(state, manifest, { hasOngoing: true }).length, 1, 'hasOngoing: true');
  eq(findCards(state, manifest, { hasAnyAbility: true }).length, 2, 'hasAnyAbility: true');
  eq(findCards(state, manifest, { hasAnyAbility: false }).length, 1, 'hasAnyAbility: false');
}

// ════════════════════════════════════════════════════════════════════════════
// CardFilter: tags / counters / revealed
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([mkCard('grunt', 2, 1)]);
  const state = buildState([
    { id: 'a', def: 'grunt', owner: 'P0', lane: 0, revealed: true,  tags: [{ kind: 'MOVED_THIS_TURN' }], counters: { charges: 3 } },
    { id: 'b', def: 'grunt', owner: 'P0', lane: 0, revealed: false, tags: [] },
    { id: 'c', def: 'grunt', owner: 'P0', lane: 0, revealed: true,  tags: [{ kind: 'SHURI_DOUBLED' }] },
  ]);

  eq(findCards(state, manifest, { revealed: true }).length, 2, 'revealed: true');
  eq(findCards(state, manifest, { revealed: false }).length, 1, 'revealed: false');
  eq(findCards(state, manifest, { hasTag: 'MOVED_THIS_TURN' }).length, 1, 'hasTag: single');
  eq(findCards(state, manifest, { hasTag: ['MOVED_THIS_TURN', 'SHURI_DOUBLED'] }).length, 2, 'hasTag: array');
  eq(findCards(state, manifest, { noTag: 'MOVED_THIS_TURN' }).length, 2, 'noTag');
  eq(findCards(state, manifest, { hasCounter: 'charges' }).length, 1, 'hasCounter');
  eq(findCards(state, manifest, { counter: { name: 'charges', gte: 3 } }).length, 1, 'counter: gte');
  eq(findCards(state, manifest, { counter: { name: 'charges', gte: 5 } }).length, 0, 'counter: gte miss');
}

// ════════════════════════════════════════════════════════════════════════════
// CardFilter: provenance
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([mkCard('grunt', 2, 1)]);
  const state = buildState([
    { id: 'deck1', def: 'grunt', owner: 'P0', lane: null, zone: 'HAND', spawnSource: { kind: 'DECK_CREATION' } },
    { id: 'made1', def: 'grunt', owner: 'P0', lane: null, zone: 'HAND', spawnSource: { kind: 'CARD_CREATED', sourceCardId: 'src1' as CardId } },
    { id: 'made2', def: 'grunt', owner: 'P0', lane: null, zone: 'HAND', spawnSource: { kind: 'CARD_CREATED', sourceCardId: 'src2' as CardId } },
  ]);

  eq(findCards(state, manifest, { fromDeck: true }).length, 1, 'fromDeck: true');
  eq(findCards(state, manifest, { createdInGame: true }).length, 2, 'createdInGame: true');
  eq(findCards(state, manifest, { spawnKind: 'CARD_CREATED' }).length, 2, 'spawnKind: single');
  eq(findCards(state, manifest, { createdBy: 'src1' as CardId }).length, 1, 'createdBy');
}

// ════════════════════════════════════════════════════════════════════════════
// CardFilter: combinators (and / or / not / custom)
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([
    mkCard('cheap', 2, 1, { cardType: 'character' }),
    mkCard('mid',   4, 3, { cardType: 'device' }),
    mkCard('big',   8, 5, { cardType: 'spell' }),
  ]);
  const state = buildState([
    { id: 'c1', def: 'cheap', owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'c2', def: 'mid',   owner: 'P0', lane: null, zone: 'HAND' },
    { id: 'c3', def: 'big',   owner: 'P0', lane: null, zone: 'HAND' },
  ]);

  // AND: cheap AND character
  eq(findCards(state, manifest, { and: [{ cost: { lte: 2 } }, { cardType: 'character' }] }).length, 1, 'and');
  // OR: cheap OR device
  eq(findCards(state, manifest, { or: [{ cost: { lte: 1 } }, { cardType: 'device' }] }).length, 2, 'or');
  // NOT: not character
  eq(findCards(state, manifest, { not: { cardType: 'character' } }).length, 2, 'not');
  // Custom
  eq(findCards(state, manifest, { custom: (c, _, m) => m.cards[c.defId].basePower > 5 }).length, 1, 'custom');
  // Nested
  eq(findCards(state, manifest, {
    and: [
      { not: { cardType: 'device' } },
      { or: [{ cost: 1 }, { cost: 5 }] },
    ],
  }).length, 2, 'and+not+or nested');
}

// ════════════════════════════════════════════════════════════════════════════
// CardDefFilter
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([
    mkCard('a', 2, 1, { cardType: 'character' }),
    mkCard('b', 4, 3, { cardType: 'device' }),
    mkCard('c', 8, 5, { cardType: 'spell' }),
  ]);

  eq(findCardDefs(manifest, { cost: { lte: 3 } }).length, 2, 'CardDef: cost lte');
  eq(findCardDefs(manifest, { cardType: 'character' }).length, 1, 'CardDef: cardType');
  eq(findCardDefs(manifest, { cardType: ['device', 'spell'] }).length, 2, 'CardDef: cardType array');
  truthy(findCardDef(manifest, { cost: 5 })?.defId === 'c', 'CardDef: findCardDef');
  eq(countCardDefs(manifest, {}), 3, 'CardDef: countCardDefs empty filter');
}

// ════════════════════════════════════════════════════════════════════════════
// LaneFilter
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([mkCard('grunt', 2, 1)]);
  // Lane 0: empty. Lane 1: 4 P0 cards (full). Lane 2: 2 P1 cards.
  const state = buildState([
    { def: 'grunt', owner: 'P0', lane: 1 },
    { def: 'grunt', owner: 'P0', lane: 1 },
    { def: 'grunt', owner: 'P0', lane: 1 },
    { def: 'grunt', owner: 'P0', lane: 1 },
    { def: 'grunt', owner: 'P1',    lane: 2 },
    { def: 'grunt', owner: 'P1',    lane: 2 },
  ]);

  eq(findLanes(state, manifest, {}), [0, 1, 2], 'Lane: empty filter returns all');
  eq(findLanes(state, manifest, { hasCapacity: true }), [0, 1, 2], 'Lane: hasCapacity=true (any side has room)');
  eq(findLanes(state, manifest, { hasCapacity: 'P0' }), [0, 2], 'Lane: hasCapacity for P0');
  eq(findLanes(state, manifest, { hasCapacity: 'P1' }), [0, 1, 2], 'Lane: hasCapacity for P1');
  eq(findLanes(state, manifest, { isFull: 'P0' }), [1], 'Lane: isFull for P0');
  eq(findLanes(state, manifest, { isEmpty: true }), [0], 'Lane: isEmpty (globally)');
  eq(findLanes(state, manifest, { isEmpty: 'P0' }), [0, 2], 'Lane: isEmpty for P0');
  eq(findLanes(state, manifest, { cardCount: 0 }), [0], 'Lane: cardCount 0');
  eq(findLanes(state, manifest, { cardCount: { gte: 2 } }), [1, 2], 'Lane: cardCount gte');
  eq(findLanes(state, manifest, { cardCountFor: { owner: 'P0', eq: 4 } }), [1], 'Lane: cardCountFor');
  eq(findLanes(state, manifest, { containsCard: { owner: 'P1' } }), [2], 'Lane: containsCard');
  // Combinators
  eq(findLanes(state, manifest, { and: [{ hasCapacity: 'P0' }, { not: { isEmpty: true } }] }), [2], 'Lane: and+not');
  eq(findLanes(state, manifest, { or: [{ isEmpty: true }, { isFull: 'P0' }] }), [0, 1], 'Lane: or');

  // findLane
  truthy(findLane(state, manifest, { isEmpty: true }) === 0, 'Lane: findLane first match');
  truthy(findLane(state, manifest, { laneId: 99 as LaneId }) === null, 'Lane: findLane no match');
}

// ════════════════════════════════════════════════════════════════════════════
// Entry-point variants
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([mkCard('g', 2, 1)]);
  const state = buildState([
    { id: 'a', def: 'g', owner: 'P0', lane: 0 },
    { id: 'b', def: 'g', owner: 'P0', lane: 0 },
    { id: 'c', def: 'g', owner: 'P1',    lane: 0 },
  ]);

  eq(countCards(state, manifest, { owner: 'P0' }), 2, 'countCards');
  truthy(hasCards(state, manifest, { owner: 'P1' }), 'hasCards true');
  truthy(!hasCards(state, manifest, { owner: 'P1', cost: 5 }), 'hasCards false');
  truthy(findCard(state, manifest, { owner: 'P0' })?.id === 'a', 'findCard first');
  truthy(findCard(state, manifest, { cost: 99 }) === null, 'findCard null');
}

// ────────────────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll query tests passed.');
}

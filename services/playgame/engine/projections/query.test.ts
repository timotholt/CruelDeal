/**
 * Query system tests.
 *
 * Run: npx tsx services/playgame/engine/projections/query.test.ts
 */

import type { CardDef, Manifest } from '../manifest/types';
import type { CardInstance, LaneState, MatchState } from '../types/state';
import type { CardId, LaneIdx, Owner } from '../types/ids';
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
  defId, version: 1, name: defId, basePower, cost, tribes: [], abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  ...extra,
});

const mkManifest = (cards: CardDef[]): Manifest => ({
  version: 1,
  protocolVersion: 1,
  constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12 },
  cards: Object.fromEntries(cards.map((c) => [c.defId, c])),
  locations: {},
  disabled: { cards: [], locations: [] },
});

const blankLane = (i: LaneIdx): LaneState => ({
  idx: i, location: null, locationRevealed: false, cards: { PLAYER: [], OPP: [] },
});

interface CardSpec {
  id?: string;
  def: string;
  owner: Owner;
  lane: LaneIdx | null;
  zone?: CardInstance['zone'];
  revealed?: boolean;
  powerDelta?: number;
  tags?: CardInstance['tags'];
  counters?: Record<string, number>;
  spawnSource?: CardInstance['spawnSource'];
}

let idCounter = 0;
const buildState = (specs: CardSpec[]): MatchState => {
  idCounter = 0;
  const cards: Record<CardId, CardInstance> = {};
  const hand: Record<Owner, CardInstance[]> = { PLAYER: [], OPP: [] };
  const deck: Record<Owner, CardInstance[]> = { PLAYER: [], OPP: [] };
  const lanes: [LaneState, LaneState, LaneState] = [blankLane(0), blankLane(1), blankLane(2)];
  for (const s of specs) {
    const id = (s.id ?? `c${++idCounter}`) as CardId;
    const zone = s.zone ?? 'LANE';
    const inst: CardInstance = {
      id, defId: s.def, version: 1, owner: s.owner,
      lane: zone === 'LANE' ? s.lane : null, zone,
      revealed: s.revealed ?? (zone === 'LANE'),
      powerDelta: s.powerDelta ?? 0,
      tags: s.tags ?? [],
      textOverride: null,
      counters: s.counters ?? {},
      spawnSource: s.spawnSource ?? { kind: 'DECK_CREATION' },
    };
    cards[id] = inst;
    if (zone === 'LANE' && s.lane !== null) (lanes[s.lane].cards[s.owner] as CardId[]).push(id);
    else if (zone === 'HAND') hand[s.owner].push(inst);
    else if (zone === 'DECK') deck[s.owner].push(inst);
  }
  return {
    turn: 1, maxEnergy: { PLAYER: 1, OPP: 1 }, nextTurnEnergyBonus: { PLAYER: 0, OPP: 0 },
    phase: 'AWAITING_INTENT', seed: 'test', priority: 'PLAYER',
    energy: { PLAYER: 1, OPP: 1 },
    deck, hand, cards, lanes,
    pending: [], stagingOrder: [], pendingEffects: [], log: [],
    lastPlayedBy: { PLAYER: null, OPP: null }, result: null,
  };
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
    { id: 'h1', def: 'grunt', owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'h2', def: 'mage',  owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'l1', def: 'grunt', owner: 'PLAYER', lane: 0 },
    { id: 'e1', def: 'grunt', owner: 'OPP',    lane: 0 },
    { id: 'd1', def: 'grunt', owner: 'PLAYER', lane: null, zone: 'DISCARD' },
  ]);

  eq(findCards(state, manifest, { zone: 'HAND' }).length, 2, 'zone: HAND count');
  eq(findCards(state, manifest, { zone: 'LANE' }).length, 2, 'zone: LANE count');
  eq(findCards(state, manifest, { zone: ['HAND', 'LANE'] }).length, 4, 'zone: array');
  eq(findCards(state, manifest, { owner: 'PLAYER' }).length, 4, 'owner: PLAYER');
  eq(findCards(state, manifest, { owner: 'OPP' }).length, 1, 'owner: OPP');
  eq(findCards(state, manifest, { zone: 'LANE', owner: 'PLAYER' }).length, 1, 'combined zone+owner');
  eq(findCards(state, manifest, { lane: 0 }).length, 2, 'lane: exact');
  eq(findCards(state, manifest, { lane: 'any' }).length, 2, 'lane: any (cards on board)');
  eq(findCards(state, manifest, { lane: 'none' }).length, 3, 'lane: none (off-board)');
}

// ════════════════════════════════════════════════════════════════════════════
// CardFilter: cost / basePower / power / tribe
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([
    mkCard('cheap', 2, 1, { tribes: ['beast'] }),
    mkCard('mid',   4, 3, { tribes: ['mage'] }),
    mkCard('big',   8, 5, { tribes: ['beast', 'mage'] }),
  ]);
  const state = buildState([
    { id: 'c1', def: 'cheap', owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'c2', def: 'mid',   owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'c3', def: 'big',   owner: 'PLAYER', lane: null, zone: 'HAND' },
  ]);

  eq(findCards(state, manifest, { cost: 1 }).length, 1, 'cost: eq');
  eq(findCards(state, manifest, { cost: { lte: 3 } }).length, 2, 'cost: lte');
  eq(findCards(state, manifest, { cost: { gt: 1 } }).length, 2, 'cost: gt');
  eq(findCards(state, manifest, { cost: { between: [2, 4] } }).length, 1, 'cost: between');
  eq(findCards(state, manifest, { basePower: { gte: 4 } }).length, 2, 'basePower: gte');
  eq(findCards(state, manifest, { tribe: 'beast' }).length, 2, 'tribe: single');
  eq(findCards(state, manifest, { allTribes: ['beast', 'mage'] }).length, 1, 'allTribes');
  eq(findCards(state, manifest, { noTribe: 'beast' }).length, 1, 'noTribe');
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
    { id: 'v', def: 'vanilla',  owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'r', def: 'revealer', owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'o', def: 'ongoing',  owner: 'PLAYER', lane: null, zone: 'HAND' },
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
    { id: 'a', def: 'grunt', owner: 'PLAYER', lane: 0, revealed: true,  tags: [{ kind: 'MOVED_THIS_TURN' }], counters: { charges: 3 } },
    { id: 'b', def: 'grunt', owner: 'PLAYER', lane: 0, revealed: false, tags: [] },
    { id: 'c', def: 'grunt', owner: 'PLAYER', lane: 0, revealed: true,  tags: [{ kind: 'SHURI_DOUBLED' }] },
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
    { id: 'deck1', def: 'grunt', owner: 'PLAYER', lane: null, zone: 'HAND', spawnSource: { kind: 'DECK_CREATION' } },
    { id: 'made1', def: 'grunt', owner: 'PLAYER', lane: null, zone: 'HAND', spawnSource: { kind: 'CARD_CREATED', sourceCardId: 'src1' as CardId } },
    { id: 'made2', def: 'grunt', owner: 'PLAYER', lane: null, zone: 'HAND', spawnSource: { kind: 'CARD_CREATED', sourceCardId: 'src2' as CardId } },
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
    mkCard('cheap', 2, 1, { tribes: ['beast'] }),
    mkCard('mid',   4, 3, { tribes: ['mage'] }),
    mkCard('big',   8, 5, { tribes: ['beast'] }),
  ]);
  const state = buildState([
    { id: 'c1', def: 'cheap', owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'c2', def: 'mid',   owner: 'PLAYER', lane: null, zone: 'HAND' },
    { id: 'c3', def: 'big',   owner: 'PLAYER', lane: null, zone: 'HAND' },
  ]);

  // AND: cheap AND beast
  eq(findCards(state, manifest, { and: [{ cost: { lte: 2 } }, { tribe: 'beast' }] }).length, 1, 'and');
  // OR: cheap OR mage
  eq(findCards(state, manifest, { or: [{ cost: { lte: 1 } }, { tribe: 'mage' }] }).length, 2, 'or');
  // NOT: not beast
  eq(findCards(state, manifest, { not: { tribe: 'beast' } }).length, 1, 'not');
  // Custom
  eq(findCards(state, manifest, { custom: (c, _, m) => m.cards[c.defId].basePower > 5 }).length, 1, 'custom');
  // Nested
  eq(findCards(state, manifest, {
    and: [
      { not: { tribe: 'mage' } },
      { or: [{ cost: 1 }, { cost: 5 }] },
    ],
  }).length, 2, 'and+not+or nested');
}

// ════════════════════════════════════════════════════════════════════════════
// CardDefFilter
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([
    mkCard('a', 2, 1, { tribes: ['beast'] }),
    mkCard('b', 4, 3, { tribes: ['mage'] }),
    mkCard('c', 8, 5, { tribes: ['beast', 'mage'] }),
  ]);

  eq(findCardDefs(manifest, { cost: { lte: 3 } }).length, 2, 'CardDef: cost lte');
  eq(findCardDefs(manifest, { tribe: 'beast' }).length, 2, 'CardDef: tribe');
  eq(findCardDefs(manifest, { allTribes: ['beast', 'mage'] }).length, 1, 'CardDef: allTribes');
  truthy(findCardDef(manifest, { cost: 5 })?.defId === 'c', 'CardDef: findCardDef');
  eq(countCardDefs(manifest, {}), 3, 'CardDef: countCardDefs empty filter');
}

// ════════════════════════════════════════════════════════════════════════════
// LaneFilter
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([mkCard('grunt', 2, 1)]);
  // Lane 0: empty. Lane 1: 4 PLAYER cards (full). Lane 2: 2 OPP cards.
  const state = buildState([
    { def: 'grunt', owner: 'PLAYER', lane: 1 },
    { def: 'grunt', owner: 'PLAYER', lane: 1 },
    { def: 'grunt', owner: 'PLAYER', lane: 1 },
    { def: 'grunt', owner: 'PLAYER', lane: 1 },
    { def: 'grunt', owner: 'OPP',    lane: 2 },
    { def: 'grunt', owner: 'OPP',    lane: 2 },
  ]);

  eq(findLanes(state, manifest, {}), [0, 1, 2], 'Lane: empty filter returns all');
  eq(findLanes(state, manifest, { hasCapacity: true }), [0, 1, 2], 'Lane: hasCapacity=true (any side has room)');
  eq(findLanes(state, manifest, { hasCapacity: 'PLAYER' }), [0, 2], 'Lane: hasCapacity for PLAYER');
  eq(findLanes(state, manifest, { hasCapacity: 'OPP' }), [0, 1, 2], 'Lane: hasCapacity for OPP');
  eq(findLanes(state, manifest, { isFull: 'PLAYER' }), [1], 'Lane: isFull for PLAYER');
  eq(findLanes(state, manifest, { isEmpty: true }), [0], 'Lane: isEmpty (globally)');
  eq(findLanes(state, manifest, { isEmpty: 'PLAYER' }), [0, 2], 'Lane: isEmpty for PLAYER');
  eq(findLanes(state, manifest, { cardCount: 0 }), [0], 'Lane: cardCount 0');
  eq(findLanes(state, manifest, { cardCount: { gte: 2 } }), [1, 2], 'Lane: cardCount gte');
  eq(findLanes(state, manifest, { cardCountFor: { owner: 'PLAYER', eq: 4 } }), [1], 'Lane: cardCountFor');
  eq(findLanes(state, manifest, { containsCard: { owner: 'OPP' } }), [2], 'Lane: containsCard');
  // Combinators
  eq(findLanes(state, manifest, { and: [{ hasCapacity: 'PLAYER' }, { not: { isEmpty: true } }] }), [2], 'Lane: and+not');
  eq(findLanes(state, manifest, { or: [{ isEmpty: true }, { isFull: 'PLAYER' }] }), [0, 1], 'Lane: or');

  // findLane
  truthy(findLane(state, manifest, { isEmpty: true }) === 0, 'Lane: findLane first match');
  truthy(findLane(state, manifest, { idx: 99 as LaneIdx }) === null, 'Lane: findLane no match');
}

// ════════════════════════════════════════════════════════════════════════════
// Entry-point variants
// ════════════════════════════════════════════════════════════════════════════

{
  const manifest = mkManifest([mkCard('g', 2, 1)]);
  const state = buildState([
    { id: 'a', def: 'g', owner: 'PLAYER', lane: 0 },
    { id: 'b', def: 'g', owner: 'PLAYER', lane: 0 },
    { id: 'c', def: 'g', owner: 'OPP',    lane: 0 },
  ]);

  eq(countCards(state, manifest, { owner: 'PLAYER' }), 2, 'countCards');
  truthy(hasCards(state, manifest, { owner: 'OPP' }), 'hasCards true');
  truthy(!hasCards(state, manifest, { owner: 'OPP', cost: 5 }), 'hasCards false');
  truthy(findCard(state, manifest, { owner: 'PLAYER' })?.id === 'a', 'findCard first');
  truthy(findCard(state, manifest, { cost: 99 }) === null, 'findCard null');
}

// ────────────────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll query tests passed.');
}

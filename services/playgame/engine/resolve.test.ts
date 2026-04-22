/**
 * resolve() + resolveTurn() tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/resolve.test.ts
 */

import { resolve, resolveTurn } from './resolve';
import { apply } from './apply';
import { createRng } from './rng';
import { getCardPower, getLanePower } from './projections';
import type { CardDef, Manifest } from './manifest/types';
import type {
  CardInstance,
  LaneState,
  LocationInstance,
  MatchState,
} from './types/state';
import type { CardId, LaneIdx, LocationId, Owner } from './types/ids';

// ---- Tiny assertion shim ---------------------------------------------------

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

const mkCard = (defId: string, basePower: number, cost: number, extra: Partial<CardDef> = {}): CardDef => ({
  defId, version: 1, name: defId, basePower, cost, tribes: [], abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  ...extra,
});

const mkLoc = (defId: string, extra: Partial<LocationDef> = {}): LocationDef => ({
  defId, version: 1, name: defId, rarity: 1, abilities: {},
  cosmetic: { displayName: defId, description: '', art: { map: { path: '' } } },
  ...extra,
});

function mkManifest(cards: CardDef[], locations: LocationDef[] = []): Manifest {
  const byId = <T extends { defId: string }>(arr: T[]): Record<string, T> =>
    Object.fromEntries(arr.map(e => [e.defId, e]));
  return {
    version: 1,
    protocolVersion: 1,
    constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12 },
    cards: byId(cards),
    locations: byId(locations),
    disabled: { cards: [], locations: [] },
  };
}

let idCounter = 0;
const nextCardId = (): CardId => `r${++idCounter}` as CardId;

function blankLane(i: LaneIdx): LaneState {
  return { idx: i, location: null, locationRevealed: false, cards: { PLAYER: [], OPP: [] } };
}

function mkCardInstance(defId: string, owner: Owner = 'PLAYER'): CardInstance {
  return {
    id: nextCardId(),
    defId,
    version: 1,
    owner,
    lane: null,
    zone: 'DECK',
    revealed: false,
    powerDelta: 0,
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}

function baseState(opts: { turn?: number; priority?: Owner; seed?: string } = {}): MatchState {
  idCounter = 0;
  return {
    turn: opts.turn ?? 1,
    maxEnergy: opts.turn ?? 1,
    phase: 'AWAITING_INTENT',
    seed: opts.seed ?? 'resolve-test',
    priority: opts.priority ?? 'PLAYER',
    energy: { PLAYER: opts.turn ?? 1, OPP: opts.turn ?? 1 },
    deck: { PLAYER: [], OPP: [] },
    hand: { PLAYER: [], OPP: [] },
    cards: {},
    lanes: [blankLane(0), blankLane(1), blankLane(2)],
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { PLAYER: null, OPP: null },
    result: null,
  };
}

function withCardInHand(state: MatchState, defId: string, owner: Owner = 'PLAYER'): { state: MatchState; cardId: CardId } {
  const inst: CardInstance = { ...mkCardInstance(defId, owner), zone: 'HAND' };
  return {
    state: {
      ...state,
      cards: { ...state.cards, [inst.id]: inst },
      hand: { ...state.hand, [owner]: [...state.hand[owner], inst] },
    },
    cardId: inst.id,
  };
}

function withCardInDeck(state: MatchState, defId: string, owner: Owner = 'PLAYER'): { state: MatchState; cardId: CardId } {
  const inst = mkCardInstance(defId, owner);
  return {
    state: {
      ...state,
      cards: { ...state.cards, [inst.id]: inst },
      deck: { ...state.deck, [owner]: [...state.deck[owner], inst] },
    },
    cardId: inst.id,
  };
}

function withLocation(state: MatchState, lane: LaneIdx, defId: string, revealed: boolean = false): MatchState {
  const loc: LocationInstance = { id: `loc${lane}` as LocationId, defId, lane, tags: [] };
  const newLane = { ...state.lanes[lane], location: loc, locationRevealed: revealed };
  const lanes: [LaneState, LaneState, LaneState] = [
    lane === 0 ? newLane : state.lanes[0],
    lane === 1 ? newLane : state.lanes[1],
    lane === 2 ? newLane : state.lanes[2],
  ];
  return { ...state, lanes };
}

function runEvents(s: MatchState, events: readonly import('./types/events').MatchEvent[], manifest: Manifest): MatchState {
  return events.reduce((st, e) => apply(st, e, manifest), s);
}

// ============================================================================
// resolve() — intent handling
// ============================================================================

// -- STAGE_CARD happy path ---------------------------------------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 2)]);
  const { state, cardId } = withCardInHand(baseState({ turn: 3 }), 'grunt');
  const events = resolve(state, {
    type: 'STAGE_CARD', intentId: 'i1', owner: 'PLAYER', cardId, lane: 0,
  }, createRng('r'), manifest);
  eq(events.length, 2, 'STAGE_CARD: emits 2 events');
  eq(events[0].type, 'CARD_STAGED', 'STAGE_CARD[0]: CARD_STAGED');
  eq(events[1].type, 'ENERGY_CHANGED', 'STAGE_CARD[1]: ENERGY_CHANGED');
  eq((events[1] as { delta: number }).delta, -2, 'ENERGY_CHANGED: delta = -cost');
  const after = runEvents(state, events, manifest);
  eq(after.energy.PLAYER, 1, 'energy: 3 - 2 = 1');
  eq(after.lanes[0].cards.PLAYER.length, 1, 'card staged into lane 0');
}

// -- STAGE_CARD: insufficient energy → INTENT_REJECTED ---------------------

{
  const manifest = mkManifest([mkCard('expensive', 5, 5)]);
  const { state, cardId } = withCardInHand(baseState({ turn: 2 }), 'expensive');
  const events = resolve(state, {
    type: 'STAGE_CARD', intentId: 'i-rej', owner: 'PLAYER', cardId, lane: 0,
  }, createRng('r'), manifest);
  eq(events.length, 1, 'STAGE_CARD(over-cost): single event');
  eq(events[0].type, 'INTENT_REJECTED', 'STAGE_CARD(over-cost): INTENT_REJECTED');
}

// -- STAGE_CARD: lane full → INTENT_REJECTED --------------------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 1)]);
  let s = baseState({ turn: 5 });
  const h = withCardInHand(s, 'grunt');
  s = h.state;
  // Pre-fill lane 0 to capacity.
  for (let i = 0; i < manifest.constants.laneCapacity; i++) {
    const fill = mkCardInstance('grunt', 'PLAYER');
    s = {
      ...s,
      cards: { ...s.cards, [fill.id]: { ...fill, zone: 'LANE', lane: 0, revealed: true } },
      lanes: [
        { ...s.lanes[0], cards: { ...s.lanes[0].cards, PLAYER: [...s.lanes[0].cards.PLAYER, fill.id] } },
        s.lanes[1], s.lanes[2],
      ],
    };
  }
  const events = resolve(s, {
    type: 'STAGE_CARD', intentId: 'i-full', owner: 'PLAYER', cardId: h.cardId, lane: 0,
  }, createRng('r'), manifest);
  eq(events[0].type, 'INTENT_REJECTED', 'STAGE_CARD(lane full): rejected');
  truthy((events[0] as { reason: string }).reason.includes('full'), 'reason mentions "full"');
}

// -- UNSTAGE_CARD: refund + remove from stagingOrder ------------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 2)]);
  const { state: s0, cardId } = withCardInHand(baseState({ turn: 3 }), 'grunt');
  const staged = runEvents(s0, resolve(s0, {
    type: 'STAGE_CARD', intentId: 'stage', owner: 'PLAYER', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const events = resolve(staged, {
    type: 'UNSTAGE_CARD', intentId: 'unstage', owner: 'PLAYER', cardId,
  }, createRng('r'), manifest);
  eq(events.length, 2, 'UNSTAGE_CARD: 2 events (unstage + refund)');
  const after = runEvents(staged, events, manifest);
  eq(after.energy.PLAYER, 3, 'UNSTAGE_CARD: energy refunded back to 3');
  eq(after.stagingOrder.length, 0, 'UNSTAGE_CARD: removed from stagingOrder');
  eq(after.hand.PLAYER.length, 1, 'UNSTAGE_CARD: back in hand');
}

// -- UNDO_TURN: unstages ALL my staged cards in reverse order ---------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 1)]);
  let s = baseState({ turn: 5 });
  const a = withCardInHand(s, 'grunt'); s = a.state;
  const b = withCardInHand(s, 'grunt'); s = b.state;
  const c = withCardInHand(s, 'grunt'); s = c.state;
  // Stage all three.
  s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'sa', owner: 'PLAYER', cardId: a.cardId, lane: 0 }, createRng('r'), manifest), manifest);
  s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'sb', owner: 'PLAYER', cardId: b.cardId, lane: 1 }, createRng('r'), manifest), manifest);
  s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'sc', owner: 'PLAYER', cardId: c.cardId, lane: 2 }, createRng('r'), manifest), manifest);
  eq(s.energy.PLAYER, 2, 'after staging 3x cost-1: energy = 5-3 = 2');
  const events = resolve(s, { type: 'UNDO_TURN', intentId: 'undo', owner: 'PLAYER' }, createRng('r'), manifest);
  const after = runEvents(s, events, manifest);
  eq(after.energy.PLAYER, 5, 'UNDO_TURN: energy fully refunded');
  eq(after.stagingOrder.length, 0, 'UNDO_TURN: stagingOrder empty');
  eq(after.hand.PLAYER.length, 3, 'UNDO_TURN: all 3 cards back in hand');
}

// -- CONCEDE: emits MATCH_ENDED with opponent winning -----------------------

{
  const manifest = mkManifest([]);
  const s = baseState();
  const events = resolve(s, { type: 'CONCEDE', intentId: 'c', owner: 'PLAYER' }, createRng('r'), manifest);
  eq(events.length, 1, 'CONCEDE: single event');
  eq(events[0].type, 'MATCH_ENDED', 'CONCEDE: MATCH_ENDED');
  eq((events[0] as { result: { winner: string } }).result.winner, 'OPP', 'CONCEDE: opponent wins');
}

// ============================================================================
// resolveTurn() — full cascade
// ============================================================================

// -- Basic cascade: single card revealed, TURN_ENDED → TURN_STARTED ---------

{
  // Card with an onReveal ability so the OR window actually opens.
  const pyro = mkCard('pyro', 4, 1, {
    abilities: {
      onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
    },
  });
  const manifest = mkManifest([pyro]);
  let s = baseState({ turn: 3, priority: 'PLAYER' });
  const { state: s1, cardId } = withCardInHand(s, 'pyro');
  s = s1;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'PLAYER', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);

  const { events, state: after } = resolveTurn(s, manifest, createRng('rt'));

  truthy(events.some(e => e.type === 'CARD_FLIPPED'), 'cascade: CARD_FLIPPED present');
  truthy(events.some(e => e.type === 'OR_WINDOW_OPEN'), 'cascade: OR_WINDOW_OPEN present');
  truthy(events.some(e => e.type === 'OR_WINDOW_CLOSE'), 'cascade: OR_WINDOW_CLOSE present');
  truthy(events.some(e => e.type === 'TURN_ENDED'), 'cascade: TURN_ENDED');
  truthy(events.some(e => e.type === 'TURN_STARTED'), 'cascade: TURN_STARTED');
  const started = events.find(e => e.type === 'TURN_STARTED') as { turn: number };
  eq(started.turn, 4, 'TURN_STARTED: turn = 4');
  eq(after.turn, 4, 'state.turn advanced');
  eq(after.stagingOrder.length, 0, 'stagingOrder cleared by TURN_ENDED');
  eq(after.cards[cardId].revealed, true, 'card is revealed after reveal phase');
}

// -- Priority order: priority holder reveals FIRST --------------------------

{
  // Two cards, one per side. Record the order of CARD_FLIPPED events.
  const pyro = mkCard('pyro', 4, 3, {
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const manifest = mkManifest([pyro]);

  for (const prio of ['PLAYER', 'OPP'] as const) {
    let s = baseState({ turn: 3, priority: prio });
    const a = withCardInHand(s, 'pyro', 'PLAYER'); s = a.state;
    const b = withCardInHand(s, 'pyro', 'OPP');    s = b.state;
    s = runEvents(s, resolve(s, {
      type: 'STAGE_CARD', intentId: 'sa', owner: 'PLAYER', cardId: a.cardId, lane: 0,
    }, createRng('r'), manifest), manifest);
    s = runEvents(s, resolve(s, {
      type: 'STAGE_CARD', intentId: 'sb', owner: 'OPP', cardId: b.cardId, lane: 0,
    }, createRng('r'), manifest), manifest);
    const { events } = resolveTurn(s, manifest, createRng('prio'));
    const flipOrder = events
      .filter(e => e.type === 'CARD_FLIPPED')
      .map(e => (e as { cardId: CardId }).cardId);
    const expected = prio === 'PLAYER' ? [a.cardId, b.cardId] : [b.cardId, a.cardId];
    eq(flipOrder, expected, `priority=${prio}: reveal order ${expected.join(' → ')}`);
  }
}

// -- Draws + energy refill on turn transition -------------------------------

{
  const manifest = mkManifest([mkCard('grunt', 2, 1)]);
  let s = baseState({ turn: 2, priority: 'PLAYER' });
  // Give each side a 2-card deck so they can draw.
  for (const owner of ['PLAYER', 'OPP'] as const) {
    const d1 = withCardInDeck(s, 'grunt', owner); s = d1.state;
    const d2 = withCardInDeck(s, 'grunt', owner); s = d2.state;
  }
  // Simulate fully-spent energy to confirm refill.
  s = { ...s, energy: { PLAYER: 0, OPP: 0 } };

  const { events, state: after } = resolveTurn(s, manifest, createRng('rt-draws'));
  const draws = events.filter(e => e.type === 'CARD_DRAWN');
  eq(draws.length, 2, 'draws: one per owner');
  eq(after.hand.PLAYER.length, 1, 'PLAYER drew to hand');
  eq(after.hand.OPP.length, 1, 'OPP drew to hand');
  eq(after.deck.PLAYER.length, 1, 'PLAYER deck shrinks by 1');
  // Turn 3 energy curve entry = 3.
  eq(after.energy.PLAYER, 3, 'energy refilled to curve[2] = 3');
  eq(after.energy.OPP,    3, 'energy refilled to curve[2] = 3 (OPP)');
}

// -- Location reveal at start of turn 2 (for lane 1) ------------------------

{
  const manifest = mkManifest([], []);
  let s = baseState({ turn: 1, priority: 'PLAYER' });
  s = withLocation(s, 1, 'some-loc', false);
  const { events, state: after } = resolveTurn(s, manifest, createRng('loc'));
  truthy(
    events.some(e => e.type === 'LOCATION_REVEALED' && (e as { lane: LaneIdx }).lane === 1),
    'LOCATION_REVEALED for lane 1 at start of turn 2',
  );
  eq(after.lanes[1].locationRevealed, true, 'lane 1 location flipped face-up');
}

// -- Turn 6 → MATCH_ENDED instead of TURN_STARTED --------------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 1)]);
  let s = baseState({ turn: 6, priority: 'PLAYER' });
  // Give PLAYER two grunts on board; OPP one.
  for (let i = 0; i < 2; i++) {
    const inst = { ...mkCardInstance('grunt', 'PLAYER'), zone: 'LANE' as const, lane: 0 as LaneIdx, revealed: true };
    s = {
      ...s,
      cards: { ...s.cards, [inst.id]: inst },
      lanes: [
        { ...s.lanes[0], cards: { ...s.lanes[0].cards, PLAYER: [...s.lanes[0].cards.PLAYER, inst.id] } },
        s.lanes[1], s.lanes[2],
      ],
    };
  }
  const opp = { ...mkCardInstance('grunt', 'OPP'), zone: 'LANE' as const, lane: 0 as LaneIdx, revealed: true };
  s = {
    ...s,
    cards: { ...s.cards, [opp.id]: opp },
    lanes: [
      { ...s.lanes[0], cards: { ...s.lanes[0].cards, OPP: [...s.lanes[0].cards.OPP, opp.id] } },
      s.lanes[1], s.lanes[2],
    ],
  };

  const { events, state: after } = resolveTurn(s, manifest, createRng('end'));
  truthy(events.some(e => e.type === 'MATCH_ENDED'), 'turn 6: MATCH_ENDED emitted');
  truthy(!events.some(e => e.type === 'TURN_STARTED'), 'turn 6: NO TURN_STARTED');
  eq(after.phase, 'ENDED', 'phase=ENDED');
  eq(after.result?.winner, 'PLAYER', 'PLAYER wins (more power in lane 0)');
}

// -- Priority recompute: new priority reflects updated board ---------------

{
  // PLAYER goes in alone, so after reveal PLAYER has more lanes than OPP.
  // Next turn's priority should swing to OPP under "loser gets priority"…
  // wait, my spec uses "more lanes/power → priority", NOT "loser goes first".
  // So PLAYER keeps priority (they're winning). Verify that.
  const manifest = mkManifest([mkCard('grunt', 5, 1)]);
  let s = baseState({ turn: 2, priority: 'PLAYER' });
  const { state: s1, cardId } = withCardInHand(s, 'grunt');
  s = s1;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'PLAYER', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const { events } = resolveTurn(s, manifest, createRng('prio-recompute'));
  const started = events.find(e => e.type === 'TURN_STARTED') as
    { priority: Owner; priorityReason: string };
  eq(started.priority, 'PLAYER', 'PLAYER keeps priority (more lanes)');
  eq(started.priorityReason, 'MORE_LANES', 'priorityReason = MORE_LANES');
}

// -- Determinism: same seed → identical event stream -----------------------

{
  const hex = mkCard('hex', 2, 2, {
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER', exclude: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const grunt = mkCard('grunt', 3, 1);
  const manifest = mkManifest([hex, grunt]);

  const build = () => {
    let s = baseState({ turn: 3, priority: 'PLAYER' });
    const h = withCardInHand(s, 'hex');       s = h.state;
    const g1 = withCardInHand(s, 'grunt');    s = g1.state;
    const g2 = withCardInHand(s, 'grunt');    s = g2.state;
    s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'a', owner: 'PLAYER', cardId: g1.cardId, lane: 0 }, createRng('r'), manifest), manifest);
    s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'b', owner: 'PLAYER', cardId: g2.cardId, lane: 0 }, createRng('r'), manifest), manifest);
    s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'c', owner: 'PLAYER', cardId: h.cardId, lane: 0 }, createRng('r'), manifest), manifest);
    return s;
  };
  const rA = resolveTurn(build(), manifest, createRng('det-seed'));
  const rB = resolveTurn(build(), manifest, createRng('det-seed'));
  eq(JSON.stringify(rA.events), JSON.stringify(rB.events), 'determinism: same seed → identical events');
}

// -- END_TURN via resolve() dispatches to resolveTurn ----------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 1)]);
  let s = baseState({ turn: 2, priority: 'PLAYER' });
  const { state: s1, cardId } = withCardInHand(s, 'grunt');
  s = s1;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'PLAYER', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const events = resolve(s, { type: 'END_TURN', intentId: 'end', owner: 'PLAYER' }, createRng('end'), manifest);
  truthy(events.some(e => e.type === 'TURN_ENDED'), 'END_TURN intent: emits TURN_ENDED');
  truthy(events.some(e => e.type === 'TURN_STARTED'), 'END_TURN intent: emits TURN_STARTED');
}

// -- Projection integration: lane power reflects resolved state ------------

{
  const sentinel = mkCard('sentinel', 5, 3, {
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
  });
  const manifest = mkManifest([sentinel]);
  let s = baseState({ turn: 3, priority: 'PLAYER' });
  const h = withCardInHand(s, 'sentinel'); s = h.state;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'PLAYER', cardId: h.cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const { state: after } = resolveTurn(s, manifest, createRng('proj'));
  // Sentinel's Ongoing kicks in post-reveal: base 5 + self-buff 1 = 6.
  eq(getCardPower(after, h.cardId, manifest), 6, 'Sentinel post-reveal: 5+1=6');
  eq(getLanePower(after, 0, 'PLAYER', manifest), 6, 'lane 0 power = 6');
}

// ---- Exit ------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll resolve() tests passed.');
}

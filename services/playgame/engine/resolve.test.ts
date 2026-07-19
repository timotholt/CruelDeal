/**
 * resolve() + resolveCurrentTurn() tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/resolve.test.ts
 */

import { resolve, resolveTurn as resolveEngineTurn } from './resolve';
import { apply } from './apply';
import { createRng } from './rng';
import { getCardPower, getLanePower } from './projections';
import type { CardDef, LocationCardDef, Manifest } from './manifest/types';
import type {
  CardInstance,
  LaneState,
  LocationCardInstance,
  MatchState,
} from './types/state';
import { EMPTY_TRACKED_VARIABLES } from './types/state';
import type { CardId, LaneId, LocationCardInstanceId, Owner } from './types/ids';
import {
  emptyTestMatchState,
  testLaneState,
  withTestLocation,
} from './testkit/runtimeFixture';

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
  defId, version: 1, name: defId, basePower, cost, cardType: 'character', abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  ...extra,
});

function mkManifest(cards: CardDef[], locations: LocationCardDef[] = []): Manifest {
  const byId = <T extends { defId: string }>(arr: T[]): Record<string, T> =>
    Object.fromEntries(arr.map(e => [e.defId, e]));
  return {
    version: 1,
    protocolVersion: 1,
    constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12, startingHandSize: 3, turnStartDraw: 1 },
    rulesets: { standard: {
      rulesetId: 'standard',
      deckConstruction: { defaultCopyLimit: 1 },
      laneRules: { initialLaneCount: 3, maximumActiveLaneCount: 3 },
      locationDeck: { minimumReserveCount: 0, copyLimit: 1 },
    } },
    cards: byId(cards),
    locations: byId(locations),
    disabled: { cards: [], locations: [] },
  };
}

let idCounter = 0;
const nextCardId = (): CardId => `r${++idCounter}` as CardId;

function blankLane(i: LaneId): LaneState {
  return testLaneState(i);
}

function mkCardInstance(defId: string, owner: Owner = 'P0'): CardInstance {
  return {
    id: nextCardId(),
    defId,
    version: 1,
    owner,
    lane: null,
    zone: 'DECK',
    revealed: false,
    powerLedger: [],
    costDelta: 0,
    costLog: [],
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}

function baseState(opts: { turn?: number; priority?: Owner; seed?: string } = {}): MatchState {
  idCounter = 0;
  const t = opts.turn ?? 1;
  return emptyTestMatchState({
    turn: t,
    maxEnergy: { P0: t, P1: t },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed: opts.seed ?? 'resolve-test',
    priority: opts.priority ?? 'P0',
    energy: { P0: t, P1: t },
    deck: { P0: [], P1: [] },
    hand: { P0: [], P1: [] },
    cards: {},
  });
}

function withCardInHand(state: MatchState, defId: string, owner: Owner = 'P0'): { state: MatchState; cardId: CardId } {
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

function withCardInDeck(state: MatchState, defId: string, owner: Owner = 'P0'): { state: MatchState; cardId: CardId } {
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

function withLocation(state: MatchState, lane: LaneId, defId: string, revealed: boolean = false): MatchState {
  return withTestLocation(
    state,
    lane,
    defId,
    revealed,
    `loc${lane}` as LocationCardInstanceId,
  );
}

function runEvents(s: MatchState, events: readonly import('./types/events').MatchEvent[], manifest: Manifest): MatchState {
  return events.reduce((st, e) => apply(st, e, manifest), s);
}

function resolveCurrentTurn(
  state: MatchState,
  manifest: Manifest,
  rng: ReturnType<typeof createRng>,
) {
  const resolving = apply(
    state,
    { type: 'TURN_RESOLUTION_STARTED', turn: state.turn },
    manifest,
  );
  return resolveEngineTurn(resolving, manifest, rng);
}

// ============================================================================
// resolve() — intent handling
// ============================================================================

// -- STAGE_CARD happy path ---------------------------------------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 2)]);
  const { state, cardId } = withCardInHand(baseState({ turn: 3 }), 'grunt');
  const events = resolve(state, {
    type: 'STAGE_CARD', intentId: 'i1', owner: 'P0', cardId, lane: 0,
  }, createRng('r'), manifest);
  eq(events.length, 2, 'STAGE_CARD: emits 2 events');
  eq(events[0].type, 'CARD_STAGED', 'STAGE_CARD[0]: CARD_STAGED');
  eq(events[1].type, 'ENERGY_CHANGED', 'STAGE_CARD[1]: ENERGY_CHANGED');
  eq((events[1] as { delta: number }).delta, -2, 'ENERGY_CHANGED: delta = -cost');
  const after = runEvents(state, events, manifest);
  eq(after.energy.P0, 1, 'energy: 3 - 2 = 1');
  eq(after.lanesById[0].cards.P0.length, 1, 'card staged into lane 0');
}

// -- STAGE_CARD uses projected current cost, not manifest base cost ---------

{
  const manifest = mkManifest([
    mkCard('grunt', 3, 2),
    mkCard('discountLord', 2, 3, {
      abilities: {
        ongoing: [{
          kind: 'COST_ADD',
          target: { kind: 'HAND_OF', owner: 'P0' },
          delta: { kind: 'LIT', n: -1 },
          stack: 'ADDITIVE',
        }],
      },
    }),
  ]);
  let s = baseState({ turn: 1 });
  const aura = mkCardInstance('discountLord', 'P0');
  s = {
    ...s,
    energy: { P0: 1, P1: 1 },
    cards: { ...s.cards, [aura.id]: { ...aura, zone: 'LANE', lane: 0, revealed: true } },
    lanesById: {
      ...s.lanesById,
      0: { ...s.lanesById[0], cards: { ...s.lanesById[0].cards, P0: [...s.lanesById[0].cards.P0, aura.id] } },
    },
  };
  const hand = withCardInHand(s, 'grunt');
  s = hand.state;
  const events = resolve(s, {
    type: 'STAGE_CARD', intentId: 'i-cost', owner: 'P0', cardId: hand.cardId, lane: 0,
  }, createRng('r'), manifest);
  eq(events.length, 2, 'STAGE_CARD(projected cost): emits 2 events');
  eq((events[0] as { cost: number }).cost, 1, 'CARD_STAGED carries reduced cost');
  eq((events[1] as { delta: number }).delta, -1, 'ENERGY_CHANGED uses reduced cost');
}

// -- STAGE_CARD: insufficient energy → INTENT_REJECTED ---------------------

{
  const manifest = mkManifest([mkCard('expensive', 5, 5)]);
  const { state, cardId } = withCardInHand(baseState({ turn: 2 }), 'expensive');
  const events = resolve(state, {
    type: 'STAGE_CARD', intentId: 'i-rej', owner: 'P0', cardId, lane: 0,
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
    const fill = mkCardInstance('grunt', 'P0');
    s = {
      ...s,
      cards: { ...s.cards, [fill.id]: { ...fill, zone: 'LANE', lane: 0, revealed: true } },
      lanesById: {
        ...s.lanesById,
        0: { ...s.lanesById[0], cards: { ...s.lanesById[0].cards, P0: [...s.lanesById[0].cards.P0, fill.id] } },
      },
    };
  }
  const events = resolve(s, {
    type: 'STAGE_CARD', intentId: 'i-full', owner: 'P0', cardId: h.cardId, lane: 0,
  }, createRng('r'), manifest);
  eq(events[0].type, 'INTENT_REJECTED', 'STAGE_CARD(lane full): rejected');
  truthy((events[0] as { reason: string }).reason.includes('full'), 'reason mentions "full"');
}

// -- UNSTAGE_CARD: refund + remove from stagingOrder ------------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 2)]);
  const { state: s0, cardId } = withCardInHand(baseState({ turn: 3 }), 'grunt');
  const staged = runEvents(s0, resolve(s0, {
    type: 'STAGE_CARD', intentId: 'stage', owner: 'P0', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const events = resolve(staged, {
    type: 'UNSTAGE_CARD', intentId: 'unstage', owner: 'P0', cardId,
  }, createRng('r'), manifest);
  eq(events.length, 2, 'UNSTAGE_CARD: 2 events (unstage + refund)');
  const after = runEvents(staged, events, manifest);
  eq(after.energy.P0, 3, 'UNSTAGE_CARD: energy refunded back to 3');
  eq(after.stagingOrder.length, 0, 'UNSTAGE_CARD: removed from stagingOrder');
  eq(after.hand.P0.length, 1, 'UNSTAGE_CARD: back in hand');
}

// -- UNDO_TURN: unstages ALL my staged cards in reverse order ---------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 1)]);
  let s = baseState({ turn: 5 });
  const a = withCardInHand(s, 'grunt'); s = a.state;
  const b = withCardInHand(s, 'grunt'); s = b.state;
  const c = withCardInHand(s, 'grunt'); s = c.state;
  // Stage all three.
  s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'sa', owner: 'P0', cardId: a.cardId, lane: 0 }, createRng('r'), manifest), manifest);
  s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'sb', owner: 'P0', cardId: b.cardId, lane: 1 }, createRng('r'), manifest), manifest);
  s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'sc', owner: 'P0', cardId: c.cardId, lane: 2 }, createRng('r'), manifest), manifest);
  eq(s.energy.P0, 2, 'after staging 3x cost-1: energy = 5-3 = 2');
  const events = resolve(s, { type: 'UNDO_TURN', intentId: 'undo', owner: 'P0' }, createRng('r'), manifest);
  const after = runEvents(s, events, manifest);
  eq(after.energy.P0, 5, 'UNDO_TURN: energy fully refunded');
  eq(after.stagingOrder.length, 0, 'UNDO_TURN: stagingOrder empty');
  eq(after.hand.P0.length, 3, 'UNDO_TURN: all 3 cards back in hand');
}

// -- CONCEDE: emits MATCH_ENDED with opponent winning -----------------------

{
  const manifest = mkManifest([]);
  const s = baseState();
  const events = resolve(s, { type: 'CONCEDE', intentId: 'c', owner: 'P0' }, createRng('r'), manifest);
  eq(events.length, 1, 'CONCEDE: single event');
  eq(events[0].type, 'MATCH_ENDED', 'CONCEDE: MATCH_ENDED');
  eq((events[0] as { result: { winner: string } }).result.winner, 'P1', 'CONCEDE: opponent wins');
}

// ============================================================================
// resolveCurrentTurn() — full cascade
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
  let s = baseState({ turn: 3, priority: 'P0' });
  const { state: s1, cardId } = withCardInHand(s, 'pyro');
  s = s1;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'P0', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);

  const { events, state: after } = resolveCurrentTurn(s, manifest, createRng('rt'));

  truthy(events.some(e => e.type === 'CARD_FLIPPED'), 'cascade: CARD_FLIPPED present');
  truthy(events.some(e => e.type === 'OR_WINDOW_OPEN'), 'cascade: OR_WINDOW_OPEN present');
  truthy(events.some(e => e.type === 'OR_WINDOW_CLOSE'), 'cascade: OR_WINDOW_CLOSE present');
  truthy(events.some(e => e.type === 'TURN_ENDED'), 'cascade: TURN_ENDED');
  truthy(events.some(e => e.type === 'TURN_STARTED'), 'cascade: TURN_STARTED');
  const endedIndex = events.findIndex(e => e.type === 'TURN_ENDED');
  const startedIndex = events.findIndex(e => e.type === 'TURN_STARTED');
  const rampIndex = events.findIndex(e => e.type === 'MAX_ENERGY_CHANGED');
  truthy(
    endedIndex < startedIndex && startedIndex < rampIndex,
    'turn boundary order: TURN_ENDED < TURN_STARTED < start bookkeeping',
  );
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

  for (const prio of ['P0', 'P1'] as const) {
    let s = baseState({ turn: 3, priority: prio });
    const a = withCardInHand(s, 'pyro', 'P0'); s = a.state;
    const b = withCardInHand(s, 'pyro', 'P1');    s = b.state;
    s = runEvents(s, resolve(s, {
      type: 'STAGE_CARD', intentId: 'sa', owner: 'P0', cardId: a.cardId, lane: 0,
    }, createRng('r'), manifest), manifest);
    s = runEvents(s, resolve(s, {
      type: 'STAGE_CARD', intentId: 'sb', owner: 'P1', cardId: b.cardId, lane: 0,
    }, createRng('r'), manifest), manifest);
    const { events } = resolveCurrentTurn(s, manifest, createRng('prio'));
    const flipOrder = events
      .filter(e => e.type === 'CARD_FLIPPED')
      .map(e => (e as { cardId: CardId }).cardId);
    const expected = prio === 'P0' ? [a.cardId, b.cardId] : [b.cardId, a.cardId];
    eq(flipOrder, expected, `priority=${prio}: reveal order ${expected.join(' → ')}`);
  }
}

// -- Draws + energy refill on turn transition -------------------------------

{
  const manifest = mkManifest([mkCard('grunt', 2, 1)]);
  let s = baseState({ turn: 2, priority: 'P0' });
  // Give each side a 2-card deck so they can draw.
  for (const owner of ['P0', 'P1'] as const) {
    const d1 = withCardInDeck(s, 'grunt', owner); s = d1.state;
    const d2 = withCardInDeck(s, 'grunt', owner); s = d2.state;
  }
  // Simulate fully-spent energy to confirm refill.
  s = { ...s, energy: { P0: 0, P1: 0 } };

  const { events, state: after } = resolveCurrentTurn(s, manifest, createRng('rt-draws'));
  const draws = events.filter(e => e.type === 'CARD_DRAWN');
  eq(draws.length, 2, 'draws: one per owner');
  eq(after.hand.P0.length, 1, 'P0 drew to hand');
  eq(after.hand.P1.length, 1, 'P1 drew to hand');
  eq(after.deck.P0.length, 1, 'P0 deck shrinks by 1');
  // Turn 3 energy curve entry = 3.
  eq(after.energy.P0, 3, 'energy refilled to curve[2] = 3');
  eq(after.energy.P1,    3, 'energy refilled to curve[2] = 3 (P1)');
}

// -- Location reveal at start of turn 2 (for lane 1) ------------------------

{
  const manifest = mkManifest([]);
  let s = baseState({ turn: 1, priority: 'P0' });
  s = withLocation(s, 1, 'some-loc', false);
  const { events, state: after } = resolveCurrentTurn(s, manifest, createRng('loc'));
  truthy(
    events.some(e => e.type === 'LOCATION_REVEALED' && (e as { lane: LaneId }).lane === 1),
    'LOCATION_REVEALED for lane 1 at start of turn 2',
  );
  const locationId = after.lanesById[1].locationSlot.locationCardId!;
  eq(after.locationCards[locationId].face, 'FACE_UP', 'lane 1 location flipped face-up');
}

// -- Location reveal fires the location onReveal effects --------------------

{
  const grunt = mkCard('grunt', 1, 1);
  const rallyPoint: LocationCardDef = {
    defId: 'rally-point',
    version: 1,
    name: 'Rally Point',
    rarity: 1,
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        delta: { kind: 'LIT', n: 2 },
      }],
    },
    cosmetic: {
      displayName: 'RALLY POINT',
      description: 'When revealed, cards here gain +2 Power.',
      art: { map: { path: '/art/maps/RallyPoint.png' } },
    },
  };
  let s = baseState({ turn: 1, priority: 'P0' });
  s = withLocation(s, 1, 'rally-point', false);
  const inst = { ...mkCardInstance('grunt', 'P0'), zone: 'LANE' as const, lane: 1 as LaneId, revealed: true };
  s = {
    ...s,
    cards: { ...s.cards, [inst.id]: inst },
    lanesById: {
      ...s.lanesById,
      1: { ...s.lanesById[1], cards: { ...s.lanesById[1].cards, P0: [inst.id] } },
    },
  };

  const { events, state: after } = resolveCurrentTurn(s, mkManifest([grunt], [rallyPoint]), createRng('loc-reveal-fires'));
  truthy(events.some(e => e.type === 'CARD_POWER_CHANGED'), 'location onReveal emits CARD_POWER_CHANGED');
  eq(getCardPower(after, inst.id, mkManifest([grunt], [rallyPoint])), 3, 'location onReveal buff applied');
}

// -- Turn 6 → MATCH_ENDED instead of TURN_STARTED --------------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 1)]);
  let s = baseState({ turn: 6, priority: 'P0' });
  // Give P0 two grunts on board; P1 one.
  for (let i = 0; i < 2; i++) {
    const inst = { ...mkCardInstance('grunt', 'P0'), zone: 'LANE' as const, lane: 0 as LaneId, revealed: true };
    s = {
      ...s,
      cards: { ...s.cards, [inst.id]: inst },
      lanesById: {
        ...s.lanesById,
        0: { ...s.lanesById[0], cards: { ...s.lanesById[0].cards, P0: [...s.lanesById[0].cards.P0, inst.id] } },
      },
    };
  }
  const opp = { ...mkCardInstance('grunt', 'P1'), zone: 'LANE' as const, lane: 0 as LaneId, revealed: true };
  s = {
    ...s,
    cards: { ...s.cards, [opp.id]: opp },
    lanesById: {
      ...s.lanesById,
      0: { ...s.lanesById[0], cards: { ...s.lanesById[0].cards, P1: [...s.lanesById[0].cards.P1, opp.id] } },
    },
  };

  const { events, state: after } = resolveCurrentTurn(s, manifest, createRng('end'));
  truthy(events.some(e => e.type === 'MATCH_ENDED'), 'turn 6: MATCH_ENDED emitted');
  truthy(!events.some(e => e.type === 'TURN_STARTED'), 'turn 6: NO TURN_STARTED');
  eq(after.phase, 'ENDED', 'phase=ENDED');
  eq(after.result?.winner, 'P0', 'P0 wins (more power in lane 0)');
}

// -- Priority recompute: new priority reflects updated board ---------------

{
  // P0 goes in alone, so after reveal P0 has more lanes than P1.
  // Next turn's priority should swing to P1 under "loser gets priority"…
  // wait, my spec uses "more lanes/power → priority", NOT "loser goes first".
  // So P0 keeps priority (they're winning). Verify that.
  const manifest = mkManifest([mkCard('grunt', 5, 1)]);
  let s = baseState({ turn: 2, priority: 'P0' });
  const { state: s1, cardId } = withCardInHand(s, 'grunt');
  s = s1;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'P0', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const { events } = resolveCurrentTurn(s, manifest, createRng('prio-recompute'));
  const started = events.find(e => e.type === 'TURN_STARTED') as
    { priority: Owner; priorityReason: string };
  eq(started.priority, 'P0', 'P0 keeps priority (more lanes)');
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
    let s = baseState({ turn: 3, priority: 'P0' });
    const h = withCardInHand(s, 'hex');       s = h.state;
    const g1 = withCardInHand(s, 'grunt');    s = g1.state;
    const g2 = withCardInHand(s, 'grunt');    s = g2.state;
    s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'a', owner: 'P0', cardId: g1.cardId, lane: 0 }, createRng('r'), manifest), manifest);
    s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'b', owner: 'P0', cardId: g2.cardId, lane: 0 }, createRng('r'), manifest), manifest);
    s = runEvents(s, resolve(s, { type: 'STAGE_CARD', intentId: 'c', owner: 'P0', cardId: h.cardId, lane: 0 }, createRng('r'), manifest), manifest);
    return s;
  };
  const rA = resolveCurrentTurn(build(), manifest, createRng('det-seed'));
  const rB = resolveCurrentTurn(build(), manifest, createRng('det-seed'));
  eq(JSON.stringify(rA.events), JSON.stringify(rB.events), 'determinism: same seed → identical events');
}

// -- END_TURN via resolve() dispatches to resolveTurn ----------------------

{
  const manifest = mkManifest([mkCard('grunt', 3, 1)]);
  let s = baseState({ turn: 2, priority: 'P0' });
  const { state: s1, cardId } = withCardInHand(s, 'grunt');
  s = s1;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'P0', cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const events = resolve(s, { type: 'END_TURN', intentId: 'end', owner: 'P0' }, createRng('end'), manifest);
  eq(events[0], { type: 'TURN_RESOLUTION_STARTED', turn: 2 }, 'END_TURN intent: starts resolution first');
  truthy(events.some(e => e.type === 'TURN_ENDED'), 'END_TURN intent: emits TURN_ENDED');
  truthy(events.some(e => e.type === 'TURN_STARTED'), 'END_TURN intent: emits TURN_STARTED');
}

// -- Projection integration: lane power reflects resolved state ------------

{
  const sentinel = mkCard('sentinel', 5, 3, {
    abilities: {
      ongoing: [{
        kind: 'LANE_POWER_ADD',
        laneScope: { laneOf: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
  });
  const manifest = mkManifest([sentinel]);
  let s = baseState({ turn: 3, priority: 'P0' });
  const h = withCardInHand(s, 'sentinel'); s = h.state;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'P0', cardId: h.cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const { state: after } = resolveCurrentTurn(s, manifest, createRng('proj'));
  eq(getCardPower(after, h.cardId, manifest), 5, 'Sentinel post-reveal: card power stays 5');
  eq(getLanePower(after, 0, 'P0', manifest), 6, 'lane 0 power = 6');
}

// -- onEndOfTurn trigger: Kraven-style +2 at end of every turn -------------

{
  // Card in lane 0 that gains +2 power at the END of each turn. After
  // staging + resolveTurn, the card should be base(3) + endOfTurn(+2) = 5.
  const kraven = mkCard('kraven', 3, 2, {
    abilities: {
      onEndOfTurn: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 2 },
      }],
    },
  });
  const manifest = mkManifest([kraven]);
  let s = baseState({ turn: 2, priority: 'P0' });
  const h = withCardInHand(s, 'kraven'); s = h.state;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'P0', cardId: h.cardId, lane: 0,
  }, createRng('r'), manifest), manifest);
  const { state: after, events } = resolveCurrentTurn(s, manifest, createRng('kraven'));
  // Power: base(3) + onEndOfTurn(+2) = 5. Kraven was staged this turn, so
  // the reveal fires first (no onReveal ability), then onEndOfTurn ticks.
  eq(getCardPower(after, h.cardId, manifest), 5, 'onEndOfTurn: 3 + 2 = 5');
  // Ordering: the +2 event must fire BEFORE TURN_ENDED (the cleanup event).
  const idxBuff = events.findIndex(
    (e) => e.type === 'CARD_POWER_CHANGED'
      && e.cardId === h.cardId
      && e.mutation.kind === 'ADD'
      && e.mutation.delta === 2,
  );
  const idxEnded = events.findIndex((e) => e.type === 'TURN_ENDED');
  truthy(idxBuff >= 0 && idxBuff < idxEnded, 'onEndOfTurn fires BEFORE TURN_ENDED');
}

// -- SCHEDULED pending: "next turn +1 energy" (Psylocke-like) --------------

{
  // Card's On Reveal ADD_PENDINGs a SCHEDULED(START_OF_NEXT_TURN, ADJUST_ENERGY +1).
  // After resolveTurn, during the next turn's start-of-turn cascade, that
  // scheduled effect fires and the owner's current energy ticks up one more
  // than the vanilla refill would grant.
  const psy = mkCard('psy', 2, 2, {
    abilities: {
      onReveal: [{
        kind: 'ADD_PENDING',
        effect: {
          kind: 'SCHEDULED',
          when: 'START_OF_NEXT_TURN',
          effect: { kind: 'ADJUST_ENERGY', owner: 'SELF_OWNER', delta: { kind: 'LIT', n: 1 } },
        },
      }],
    },
  });
  const manifest = mkManifest([psy]);
  let s = baseState({ turn: 2, priority: 'P0' });
  const h = withCardInHand(s, 'psy'); s = h.state;
  s = runEvents(s, resolve(s, {
    type: 'STAGE_CARD', intentId: 'stg', owner: 'P0', cardId: h.cardId, lane: 0,
  }, createRng('r'), manifest), manifest);

  // Before resolveTurn, P0 energy = turn(2) - 2(cost) = 0.
  eq(s.energy['P0'], 0, 'pre-resolveTurn: P0 energy spent on psy');

  const { state: after, events } = resolveCurrentTurn(s, manifest, createRng('sched'));
  // Turn advanced to 3. Vanilla refill would land energy at maxEnergy=3.
  // SCHEDULED effect adds +1 on top → 4.
  eq(after.turn, 3, 'resolveTurn advanced to turn 3');
  eq(after.maxEnergy['P0'], 3, 'maxEnergy ramped to 3');
  eq(after.energy['P0'], 4, 'SCHEDULED fired: energy = maxEnergy + 1');

  // Pending queue must be empty — PENDING_EFFECT_REMOVED fires alongside.
  eq(after.pendingEffects.length, 0, 'SCHEDULED consumed from pending queue');

  // Event ordering: TURN_STARTED precedes the SCHEDULED effect's ENERGY_CHANGED(EFFECT),
  // which precedes PENDING_EFFECT_REMOVED.
  const idxStarted = events.findIndex((e) => e.type === 'TURN_STARTED');
  const idxEffect = events.findIndex(
    (e) => e.type === 'ENERGY_CHANGED' && e.reason === 'EFFECT',
  );
  const idxRemoved = events.findIndex((e) => e.type === 'PENDING_EFFECT_REMOVED');
  truthy(idxStarted < idxEffect && idxEffect < idxRemoved,
    'SCHEDULED order: TURN_STARTED < EFFECT < PENDING_EFFECT_REMOVED');
}

// ---- Exit ------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll resolve() tests passed.');
}

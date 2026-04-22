/**
 * apply() reducer tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/apply.test.ts
 *
 * Each test builds a starting MatchState, applies one or more MatchEvents,
 * and verifies the resulting state. Since apply is pure, tests can chain
 * events without resetting fixtures.
 */

import { apply } from './apply';
import { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';
import type { MatchEvent } from './types/events';
import type { CardId, LaneIdx, LocationId, Owner } from './types/ids';
import type { CardInstance, LaneState, MatchState } from './types/state';
import { getCardPower } from './projections';

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

function blankLane(i: LaneIdx): LaneState {
  return { idx: i, location: null, locationRevealed: false, cards: { PLAYER: [], OPP: [] } };
}

function mkCardInstance(id: string, defId: string, owner: Owner = 'PLAYER'): CardInstance {
  return {
    id: id as CardId,
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

function emptyState(): MatchState {
  return {
    turn: 1,
    maxEnergy: 1,
    phase: 'AWAITING_INTENT',
    seed: 'test-seed',
    priority: 'PLAYER',
    energy: { PLAYER: 1, OPP: 1 },
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

/** Seed a state with one Sentinel in hand (already deck-drawn). */
function stateWithSentinelInHand(): MatchState {
  const s = emptyState();
  const sentinel: CardInstance = {
    ...mkCardInstance('s1', 'sentinel', 'PLAYER'),
    zone: 'HAND',
  };
  return {
    ...s,
    energy: { PLAYER: 5, OPP: 0 },
    cards: { s1: sentinel } as Record<CardId, CardInstance>,
    hand: { PLAYER: [sentinel], OPP: [] },
  };
}

// ---- Helper: run a list of events through apply ---------------------------

function run(s: MatchState, ...events: MatchEvent[]): MatchState {
  return events.reduce((st, e) => apply(st, e, BOOTSTRAP_MANIFEST), s);
}

// ============================================================================
// Tests
// ============================================================================

// -- CARD_STAGED: moves from hand to lane; face-down; stagingOrder + lastPlayedBy

{
  const s0 = stateWithSentinelInHand();
  const s1 = run(s0, {
    type: 'CARD_STAGED',
    intentId: 'i1',
    cardId: 's1' as CardId,
    lane: 0,
    owner: 'PLAYER',
    cost: 3,
  });
  const c = s1.cards['s1' as CardId]!;
  eq(c.zone, 'LANE', 'CARD_STAGED: zone becomes LANE');
  eq(c.lane, 0, 'CARD_STAGED: lane set');
  eq(c.revealed, false, 'CARD_STAGED: not revealed (face-down pre-reveal)');
  eq(s1.hand.PLAYER.length, 0, 'CARD_STAGED: hand drained');
  eq(s1.lanes[0].cards.PLAYER, ['s1'] as CardId[], 'CARD_STAGED: card in lane 0 player');
  eq(s1.stagingOrder, ['s1'] as CardId[], 'CARD_STAGED: pushed onto stagingOrder');
  eq(s1.lastPlayedBy.PLAYER, 's1' as CardId, 'CARD_STAGED: updates lastPlayedBy.PLAYER');
  eq(s1.log.length, 1, 'CARD_STAGED: appended to log');
}

// -- CARD_UNSTAGED: inverse of CARD_STAGED

{
  const s0 = stateWithSentinelInHand();
  const s2 = run(
    s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'PLAYER', cost: 3 },
    { type: 'CARD_UNSTAGED', intentId: 'i2', cardId: 's1' as CardId },
  );
  const c = s2.cards['s1' as CardId]!;
  eq(c.zone, 'HAND', 'CARD_UNSTAGED: zone back to HAND');
  eq(c.lane, null, 'CARD_UNSTAGED: lane cleared');
  eq(s2.hand.PLAYER.length, 1, 'CARD_UNSTAGED: hand restored');
  eq(s2.lanes[0].cards.PLAYER.length, 0, 'CARD_UNSTAGED: removed from lane');
  eq(s2.stagingOrder.length, 0, 'CARD_UNSTAGED: removed from stagingOrder');
}

// -- ENERGY_CHANGED: additive

{
  const s0 = emptyState();
  const s1 = run(s0, { type: 'ENERGY_CHANGED', owner: 'PLAYER', delta: -3, reason: 'CARD_PLAYED' });
  eq(s1.energy.PLAYER, -2, 'ENERGY_CHANGED: delta -3 from 1 = -2');
  eq(s1.energy.OPP, 1, 'ENERGY_CHANGED: opponent unchanged');
}

// -- CARD_FLIPPED: revealed := true

{
  const s0 = stateWithSentinelInHand();
  const s2 = run(
    s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'PLAYER', cost: 3 },
    { type: 'CARD_FLIPPED', cardId: 's1' as CardId },
  );
  eq(s2.cards['s1' as CardId]!.revealed, true, 'CARD_FLIPPED: revealed=true');
}

// -- CARD_POWER_CHANGED: accumulates in powerDelta and affects getCardPower

{
  const s0 = stateWithSentinelInHand();
  const staged = run(s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'PLAYER', cost: 3 },
    { type: 'CARD_FLIPPED', cardId: 's1' as CardId },
  );
  // Sentinel base = 5 (per BOOTSTRAP_MANIFEST). Sentinel's own Ongoing
  // adds +1 to itself (same-lane self-owner). So baseline projected power = 6.
  eq(getCardPower(staged, 's1' as CardId, BOOTSTRAP_MANIFEST), 6, 'pre-delta: Sentinel power = 6');
  const bumped = run(
    staged,
    { type: 'CARD_POWER_CHANGED', cardId: 's1' as CardId, delta: 3,
      cause: { sourceId: 's1' as CardId, effectKind: 'SYSTEM' } },
  );
  eq(bumped.cards['s1' as CardId]!.powerDelta, 3, 'CARD_POWER_CHANGED: powerDelta = 3');
  eq(getCardPower(bumped, 's1' as CardId, BOOTSTRAP_MANIFEST), 9, 'projected power picks up delta: 6+3=9');

  // Stacks additively.
  const bumpedAgain = run(
    bumped,
    { type: 'CARD_POWER_CHANGED', cardId: 's1' as CardId, delta: -2,
      cause: { sourceId: 's1' as CardId, effectKind: 'SYSTEM' } },
  );
  eq(bumpedAgain.cards['s1' as CardId]!.powerDelta, 1, 'CARD_POWER_CHANGED: deltas stack (3 + -2 = 1)');
}

// -- CARD_DESTROYED: zone=DISCARD, removed from lane, tagged

{
  const s0 = stateWithSentinelInHand();
  const destroyed = run(
    s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'PLAYER', cost: 3 },
    { type: 'CARD_DESTROYED', cardId: 's1' as CardId,
      cause: { sourceId: 's1' as CardId, effectKind: 'SYSTEM' } },
  );
  const c = destroyed.cards['s1' as CardId]!;
  eq(c.zone, 'DESTROYED', 'CARD_DESTROYED: zone=DESTROYED (separate from DISCARD)');
  eq(c.lane, null, 'CARD_DESTROYED: lane cleared');
  eq(destroyed.lanes[0].cards.PLAYER.length, 0, 'CARD_DESTROYED: removed from lane');
  truthy(c.tags.some(t => t.kind === 'DESTROYED_THIS_TURN'), 'CARD_DESTROYED: tagged DESTROYED_THIS_TURN');
}

// -- CARD_MOVED: swaps lane membership and tags MOVED_THIS_TURN

{
  const s0 = stateWithSentinelInHand();
  const moved = run(
    s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'PLAYER', cost: 3 },
    { type: 'CARD_MOVED', cardId: 's1' as CardId, fromLane: 0, toLane: 2,
      cause: { sourceId: 's1' as CardId, effectKind: 'ON_REVEAL' } },
  );
  eq(moved.lanes[0].cards.PLAYER.length, 0, 'CARD_MOVED: gone from lane 0');
  eq(moved.lanes[2].cards.PLAYER, ['s1'] as CardId[], 'CARD_MOVED: arrived at lane 2');
  eq(moved.cards['s1' as CardId]!.lane, 2, 'CARD_MOVED: card.lane updated');
  truthy(moved.cards['s1' as CardId]!.tags.some(t => t.kind === 'MOVED_THIS_TURN'), 'CARD_MOVED: tagged MOVED_THIS_TURN');
}

// -- CARD_TAG_ADDED / REMOVED: uniqueness + removal

{
  const s0 = stateWithSentinelInHand();
  const s1 = run(s0, { type: 'CARD_TAG_ADDED', cardId: 's1' as CardId, tag: { kind: 'SHURI_DOUBLED' } });
  truthy(s1.cards['s1' as CardId]!.tags.some(t => t.kind === 'SHURI_DOUBLED'), 'CARD_TAG_ADDED: tag present');
  // Adding the same tag again should be idempotent.
  const s2 = run(s1, { type: 'CARD_TAG_ADDED', cardId: 's1' as CardId, tag: { kind: 'SHURI_DOUBLED' } });
  eq(s2.cards['s1' as CardId]!.tags.filter(t => t.kind === 'SHURI_DOUBLED').length, 1, 'CARD_TAG_ADDED: idempotent');
  const s3 = run(s2, { type: 'CARD_TAG_REMOVED', cardId: 's1' as CardId, tag: 'SHURI_DOUBLED' });
  truthy(!s3.cards['s1' as CardId]!.tags.some(t => t.kind === 'SHURI_DOUBLED'), 'CARD_TAG_REMOVED: tag gone');
}

// -- CARD_COUNTER_CHANGED: per-name accumulator

{
  const s0 = stateWithSentinelInHand();
  const s1 = run(s0,
    { type: 'CARD_COUNTER_CHANGED', cardId: 's1' as CardId, name: 'bishop', delta: 2 },
    { type: 'CARD_COUNTER_CHANGED', cardId: 's1' as CardId, name: 'bishop', delta: 3 },
    { type: 'CARD_COUNTER_CHANGED', cardId: 's1' as CardId, name: 'other',  delta: 1 },
  );
  eq(s1.cards['s1' as CardId]!.counters['bishop'], 5, 'CARD_COUNTER_CHANGED: accumulates by name (2+3=5)');
  eq(s1.cards['s1' as CardId]!.counters['other'],  1, 'CARD_COUNTER_CHANGED: separate names independent');
}

// -- CARD_DRAWN: deck -> hand, preserves spawnSource

{
  const s = emptyState();
  const cardInst = mkCardInstance('d1', 'grunt', 'PLAYER');
  const s0: MatchState = {
    ...s,
    cards: { d1: cardInst } as Record<CardId, CardInstance>,
    deck: { PLAYER: [cardInst], OPP: [] },
  };
  const s1 = run(s0, { type: 'CARD_DRAWN', owner: 'PLAYER', cardId: 'd1' as CardId, toHand: true });
  eq(s1.deck.PLAYER.length, 0, 'CARD_DRAWN: removed from deck');
  eq(s1.hand.PLAYER.length, 1, 'CARD_DRAWN: added to hand');
  eq(s1.cards['d1' as CardId]!.zone, 'HAND', 'CARD_DRAWN: zone=HAND');
  eq(s1.cards['d1' as CardId]!.spawnSource, { kind: 'DECK_CREATION' }, 'CARD_DRAWN: preserves spawnSource');
}

// -- CARD_DISCARDED: hand -> DISCARD pile (Morbius target)

{
  const s0 = stateWithSentinelInHand();
  const cause = { sourceId: 's1' as CardId, effectKind: 'SYSTEM' as const };
  const s1 = run(s0, { type: 'CARD_DISCARDED', cardId: 's1' as CardId, reason: 'FORCED_EFFECT', cause });
  eq(s1.cards['s1' as CardId]!.zone, 'DISCARD', 'CARD_DISCARDED: zone=DISCARD');
  eq(s1.hand.PLAYER.length, 0, 'CARD_DISCARDED: removed from hand');
}

// -- CARD_BANISHED: any → BANISHED (permanent exile)

{
  const s0 = stateWithSentinelInHand();
  const cause = { sourceId: 's1' as CardId, effectKind: 'SYSTEM' as const };
  // From hand:
  const s1 = run(s0, { type: 'CARD_BANISHED', cardId: 's1' as CardId, cause });
  eq(s1.cards['s1' as CardId]!.zone, 'BANISHED', 'CARD_BANISHED (from hand): zone=BANISHED');
  eq(s1.hand.PLAYER.length, 0, 'CARD_BANISHED: gone from hand');
  // From lane:
  const s2 = run(s0,
    { type: 'CARD_STAGED', intentId: 'i', cardId: 's1' as CardId, lane: 0, owner: 'PLAYER', cost: 3 },
    { type: 'CARD_BANISHED', cardId: 's1' as CardId, cause },
  );
  eq(s2.cards['s1' as CardId]!.zone, 'BANISHED', 'CARD_BANISHED (from lane): zone=BANISHED');
  eq(s2.lanes[0].cards.PLAYER.length, 0, 'CARD_BANISHED: gone from lane');
}

// -- CARD_ADDED_TO_HAND: mints with spawnSource (Agent 13 / Collector)

{
  const s0 = emptyState();
  const spawn = { kind: 'CARD_CREATED' as const, sourceCardId: 'agent13' as CardId };
  const s1 = run(s0, {
    type: 'CARD_ADDED_TO_HAND',
    owner: 'PLAYER',
    cardId: 'spawn1' as CardId,
    defId: 'grunt',
    spawnSource: spawn,
  });
  eq(s1.cards['spawn1' as CardId]?.zone, 'HAND', 'CARD_ADDED_TO_HAND: zone=HAND');
  eq(s1.cards['spawn1' as CardId]?.spawnSource, spawn, 'CARD_ADDED_TO_HAND: spawnSource recorded');
  eq(s1.hand.PLAYER.length, 1, 'CARD_ADDED_TO_HAND: in hand list');
}

// -- CARD_ADDED_TO_LANE: mints with spawnSource (Brood / Bar Sinister)

{
  const s0 = emptyState();
  const spawn = { kind: 'LOCATION_CREATED' as const, sourceLocationId: 'bar-sinister' as LocationId };
  const s1 = run(s0, {
    type: 'CARD_ADDED_TO_LANE',
    owner: 'PLAYER',
    cardId: 'spawn2' as CardId,
    lane: 1,
    defId: 'grunt',
    spawnSource: spawn,
  });
  eq(s1.cards['spawn2' as CardId]?.zone, 'LANE', 'CARD_ADDED_TO_LANE: zone=LANE');
  eq(s1.cards['spawn2' as CardId]?.spawnSource, spawn, 'CARD_ADDED_TO_LANE: spawnSource recorded');
  eq(s1.lanes[1].cards.PLAYER, ['spawn2'] as CardId[], 'CARD_ADDED_TO_LANE: in lane list');
}

// -- DECK_SHUFFLED: reorders deck per newOrder

{
  const s = emptyState();
  const a = mkCardInstance('a', 'grunt', 'PLAYER');
  const b = mkCardInstance('b', 'grunt', 'PLAYER');
  const c = mkCardInstance('c', 'grunt', 'PLAYER');
  const s0: MatchState = {
    ...s,
    cards: { a, b, c } as Record<CardId, CardInstance>,
    deck: { PLAYER: [a, b, c], OPP: [] },
  };
  const s1 = run(s0, { type: 'DECK_SHUFFLED', owner: 'PLAYER', newOrder: ['c', 'a', 'b'] as CardId[] });
  eq(s1.deck.PLAYER.map(x => x.id), ['c', 'a', 'b'] as CardId[], 'DECK_SHUFFLED: order matches newOrder');
}

// -- PENDING_EFFECT_ADDED / REMOVED

{
  const s0 = emptyState();
  const pe = { kind: 'EGO_OVERRIDE' as const, turn: 6 };
  const s1 = run(s0, { type: 'PENDING_EFFECT_ADDED', effect: pe });
  eq(s1.pendingEffects.length, 1, 'PENDING_EFFECT_ADDED: queue has 1');
  const s2 = run(s1, { type: 'PENDING_EFFECT_REMOVED', effect: pe });
  eq(s2.pendingEffects.length, 0, 'PENDING_EFFECT_REMOVED: queue empty');
}

// -- LOCATION_REVEALED: flips revealed bit on the matching lane

{
  const s = emptyState();
  const locId = 'loc0' as LocationId;
  const s0: MatchState = {
    ...s,
    lanes: [
      { ...blankLane(0), location: { id: locId, defId: 'cathedral', lane: 0, tags: [] }, locationRevealed: false },
      blankLane(1),
      blankLane(2),
    ],
  };
  const s1 = run(s0, { type: 'LOCATION_REVEALED', lane: 0, locationId: locId });
  eq(s1.lanes[0].locationRevealed, true, 'LOCATION_REVEALED: lane 0 revealed');
  eq(s1.lanes[1].locationRevealed, false, 'LOCATION_REVEALED: lane 1 unaffected');

  // Mismatched locationId → no-op
  const s2 = run(s0, { type: 'LOCATION_REVEALED', lane: 0, locationId: 'other' as LocationId });
  eq(s2.lanes[0].locationRevealed, false, 'LOCATION_REVEALED: id mismatch is a no-op');
}

// -- LOCATION_TAG_ADDED / REMOVED: on lane.location.tags

{
  const s = emptyState();
  const locId = 'loc1' as LocationId;
  const s0: MatchState = {
    ...s,
    lanes: [
      blankLane(0),
      { ...blankLane(1), location: { id: locId, defId: 'jungle-trail', lane: 1, tags: [] }, locationRevealed: true },
      blankLane(2),
    ],
  };
  const s1 = run(s0,
    { type: 'LOCATION_TAG_ADDED', lane: 1, tag: { kind: 'ON_FIRE' } },
    { type: 'LOCATION_TAG_ADDED', lane: 1, tag: { kind: 'ON_FIRE' } }, // dup
  );
  eq(s1.lanes[1].location!.tags.length, 1, 'LOCATION_TAG_ADDED: idempotent');
  const s2 = run(s1, { type: 'LOCATION_TAG_REMOVED', lane: 1, tag: 'ON_FIRE' });
  eq(s2.lanes[1].location!.tags.length, 0, 'LOCATION_TAG_REMOVED: removed');
}

// -- TURN_STARTED / TURN_ENDED: housekeeping

{
  const s0 = stateWithSentinelInHand();
  const s1 = run(s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'PLAYER', cost: 3 },
    // Give the card a transient tag...
    { type: 'CARD_TAG_ADDED', cardId: 's1' as CardId, tag: { kind: 'MOVED_THIS_TURN' } },
    { type: 'TURN_ENDED', turn: 1 },
  );
  truthy(!s1.cards['s1' as CardId]!.tags.some(t => t.kind === 'MOVED_THIS_TURN'),
    'TURN_ENDED: transient tags cleared');
  eq(s1.stagingOrder.length, 0, 'TURN_ENDED: stagingOrder cleared');
  eq(s1.phase, 'BETWEEN_TURNS', 'TURN_ENDED: phase = BETWEEN_TURNS');

  const s2 = run(s1, { type: 'TURN_STARTED', turn: 2, priority: 'OPP', priorityReason: 'MORE_POWER' });
  eq(s2.turn, 2, 'TURN_STARTED: turn incremented');
  eq(s2.priority, 'OPP', 'TURN_STARTED: priority set');
  eq(s2.phase, 'AWAITING_INTENT', 'TURN_STARTED: phase = AWAITING_INTENT');
}

// -- MATCH_ENDED: sets result + phase

{
  const s0 = emptyState();
  const s1 = run(s0, {
    type: 'MATCH_ENDED',
    result: { winner: 'PLAYER', lanesWon: { PLAYER: 2, OPP: 1 }, totalPower: { PLAYER: 20, OPP: 15 } },
  });
  eq(s1.phase, 'ENDED', 'MATCH_ENDED: phase = ENDED');
  eq(s1.result?.winner, 'PLAYER', 'MATCH_ENDED: winner recorded');
  eq(s1.result?.lanesWon.PLAYER, 2, 'MATCH_ENDED: lanesWon recorded');
}

// -- Diagnostic events: log only, no state change

{
  const s0 = emptyState();
  const s1 = run(s0, {
    type: 'INTENT_REJECTED',
    intentId: 'bad',
    reason: 'insufficient energy',
  });
  eq(s1.log.length, 1, 'INTENT_REJECTED: appended to log');
  eq(JSON.stringify({ ...s1, log: [] }), JSON.stringify({ ...s0, log: [] }), 'INTENT_REJECTED: no state mutation beyond log');
}

// -- Log ordering: seq is monotonic

{
  const s0 = stateWithSentinelInHand();
  const s1 = run(s0,
    { type: 'ENERGY_CHANGED', owner: 'PLAYER', delta: -1, reason: 'EFFECT' },
    { type: 'ENERGY_CHANGED', owner: 'OPP',    delta: -1, reason: 'EFFECT' },
    { type: 'ENERGY_CHANGED', owner: 'PLAYER', delta: +2, reason: 'TURN_START' },
  );
  eq(s1.log.length, 3, 'log length = 3');
  eq(s1.log.map(e => e.seq), [0, 1, 2], 'log seq is monotonic 0..n');
}

// -- Purity: applying an event does not mutate the input state

{
  const s0 = stateWithSentinelInHand();
  const frozen = JSON.parse(JSON.stringify(s0));
  const _ = apply(s0, { type: 'ENERGY_CHANGED', owner: 'PLAYER', delta: -1, reason: 'EFFECT' }, BOOTSTRAP_MANIFEST);
  void _;
  eq(JSON.stringify(s0), JSON.stringify(frozen), 'apply() does not mutate the input state');
}

// -- Exit --------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll apply() tests passed.');
}

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
import type { CardId, LaneId, LocationCardInstanceId, Owner } from './types/ids';
import type { CardInstance, MatchState } from './types/state';
import { getCardPower } from './projections';
import {
  emptyTestMatchState,
  withTestLocation,
} from './testkit/runtimeFixture';
import { locationCardAtLane } from './laneTopology';

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

function mkCardInstance(id: string, defId: string, owner: Owner = 'P0'): CardInstance {
  return {
    id: id as CardId,
    defId,
    version: 1,
    owner,
    lane: null,
    zone: 'DECK',
    revealed: false,
    powerDelta: 0,
    costDelta: 0,
    powerLog: [],
    costLog: [],
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}

function emptyState(): MatchState {
  return emptyTestMatchState({
    seed: 'test-seed',
  });
}

/** Seed a state with one Armored Van (5/3, no abilities) in hand (already deck-drawn). */
function stateWithSentinelInHand(): MatchState {
  const s = emptyState();
  const armoredVan: CardInstance = {
    ...mkCardInstance('s1', 'armored-van', 'P0'),
    zone: 'HAND',
  };
  return {
    ...s,
    energy: { P0: 5, P1: 0 },
    cards: { s1: armoredVan } as Record<CardId, CardInstance>,
    hand: { P0: [armoredVan], P1: [] },
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
    owner: 'P0',
    cost: 3,
  });
  const c = s1.cards['s1' as CardId]!;
  eq(c.zone, 'LANE', 'CARD_STAGED: zone becomes LANE');
  eq(c.lane, 0, 'CARD_STAGED: lane set');
  eq(c.revealed, false, 'CARD_STAGED: not revealed (face-down pre-reveal)');
  eq(s1.hand.P0.length, 0, 'CARD_STAGED: hand drained');
  eq(s1.lanesById[0].cards.P0, ['s1'] as CardId[], 'CARD_STAGED: card in lane 0 player');
  eq(s1.stagingOrder, ['s1'] as CardId[], 'CARD_STAGED: pushed onto stagingOrder');
  eq(s1.lastPlayedBy.P0, 's1' as CardId, 'CARD_STAGED: updates lastPlayedBy.P0');
  eq(s1.log.length, 1, 'CARD_STAGED: appended to log');
}

// -- CARD_UNSTAGED: inverse of CARD_STAGED

{
  const s0 = stateWithSentinelInHand();
  const s2 = run(
    s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'P0', cost: 3 },
    { type: 'CARD_UNSTAGED', intentId: 'i2', cardId: 's1' as CardId },
  );
  const c = s2.cards['s1' as CardId]!;
  eq(c.zone, 'HAND', 'CARD_UNSTAGED: zone back to HAND');
  eq(c.lane, null, 'CARD_UNSTAGED: lane cleared');
  eq(s2.hand.P0.length, 1, 'CARD_UNSTAGED: hand restored');
  eq(s2.lanesById[0].cards.P0.length, 0, 'CARD_UNSTAGED: removed from lane');
  eq(s2.stagingOrder.length, 0, 'CARD_UNSTAGED: removed from stagingOrder');
}

// -- ENERGY_CHANGED: additive

{
  const s0 = emptyState();
  const s1 = run(s0, { type: 'ENERGY_CHANGED', owner: 'P0', delta: -3, reason: 'CARD_PLAYED' });
  eq(s1.energy.P0, -2, 'ENERGY_CHANGED: delta -3 from 1 = -2');
  eq(s1.energy.P1, 1, 'ENERGY_CHANGED: opponent unchanged');
}

// -- CARD_FLIPPED: revealed := true

{
  const s0 = stateWithSentinelInHand();
  const s2 = run(
    s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'P0', cost: 3 },
    { type: 'CARD_FLIPPED', cardId: 's1' as CardId },
  );
  eq(s2.cards['s1' as CardId]!.revealed, true, 'CARD_FLIPPED: revealed=true');
}

// -- CARD_POWER_CHANGED: accumulates in powerDelta and affects getCardPower

{
  const s0 = stateWithSentinelInHand();
  const staged = run(s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'P0', cost: 3 },
    { type: 'CARD_FLIPPED', cardId: 's1' as CardId },
  );
  // Armored Van has no ongoing; just check basePower to the lane total, not to any card's own power.
  eq(getCardPower(staged, 's1' as CardId, BOOTSTRAP_MANIFEST), 5, 'pre-delta: Armored Van card power = 5');
  const bumped = run(
    staged,
    { type: 'CARD_POWER_CHANGED', cardId: 's1' as CardId, delta: 3,
      cause: { sourceId: 's1' as CardId, effectKind: 'SYSTEM' } },
  );
  eq(bumped.cards['s1' as CardId]!.powerDelta, 3, 'CARD_POWER_CHANGED: powerDelta = 3');
  eq(getCardPower(bumped, 's1' as CardId, BOOTSTRAP_MANIFEST), 8, 'projected power picks up delta: 5+3=8');

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
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'P0', cost: 3 },
    { type: 'CARD_DESTROYED', cardId: 's1' as CardId,
      cause: { sourceId: 's1' as CardId, effectKind: 'SYSTEM' } },
  );
  const c = destroyed.cards['s1' as CardId]!;
  eq(c.zone, 'DESTROYED', 'CARD_DESTROYED: zone=DESTROYED (separate from DISCARD)');
  eq(c.lane, null, 'CARD_DESTROYED: lane cleared');
  eq(destroyed.lanesById[0].cards.P0.length, 0, 'CARD_DESTROYED: removed from lane');
  truthy(c.tags.some(t => t.kind === 'DESTROYED_THIS_TURN'), 'CARD_DESTROYED: tagged DESTROYED_THIS_TURN');
}

// -- CARD_MOVED: swaps lane membership and tags MOVED_THIS_TURN

{
  const s0 = stateWithSentinelInHand();
  const moved = run(
    s0,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'P0', cost: 3 },
    { type: 'CARD_MOVED', cardId: 's1' as CardId, fromLane: 0, toLane: 2,
      cause: { sourceId: 's1' as CardId, effectKind: 'ON_REVEAL' } },
  );
  eq(moved.lanesById[0].cards.P0.length, 0, 'CARD_MOVED: gone from lane 0');
  eq(moved.lanesById[2].cards.P0, ['s1'] as CardId[], 'CARD_MOVED: arrived at lane 2');
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
  const cardInst = mkCardInstance('d1', 'grunt', 'P0');
  const s0: MatchState = {
    ...s,
    cards: { d1: cardInst } as Record<CardId, CardInstance>,
    deck: { P0: [cardInst], P1: [] },
  };
  const s1 = run(s0, { type: 'CARD_DRAWN', owner: 'P0', cardId: 'd1' as CardId, toHand: true });
  eq(s1.deck.P0.length, 0, 'CARD_DRAWN: removed from deck');
  eq(s1.hand.P0.length, 1, 'CARD_DRAWN: added to hand');
  eq(s1.cards['d1' as CardId]!.zone, 'HAND', 'CARD_DRAWN: zone=HAND');
  eq(s1.cards['d1' as CardId]!.spawnSource, { kind: 'DECK_CREATION' }, 'CARD_DRAWN: preserves spawnSource');
}

// -- CARD_DISCARDED: hand -> DISCARD pile (Morbius target)

{
  const s0 = stateWithSentinelInHand();
  const cause = { sourceId: 's1' as CardId, effectKind: 'SYSTEM' as const };
  const s1 = run(s0, { type: 'CARD_DISCARDED', cardId: 's1' as CardId, reason: 'FORCED_EFFECT', cause });
  eq(s1.cards['s1' as CardId]!.zone, 'DISCARD', 'CARD_DISCARDED: zone=DISCARD');
  eq(s1.hand.P0.length, 0, 'CARD_DISCARDED: removed from hand');
}

// -- CARD_BANISHED: any → BANISHED (permanent exile)

{
  const s0 = stateWithSentinelInHand();
  const cause = { sourceId: 's1' as CardId, effectKind: 'SYSTEM' as const };
  // From hand:
  const s1 = run(s0, { type: 'CARD_BANISHED', cardId: 's1' as CardId, cause });
  eq(s1.cards['s1' as CardId]!.zone, 'BANISHED', 'CARD_BANISHED (from hand): zone=BANISHED');
  eq(s1.hand.P0.length, 0, 'CARD_BANISHED: gone from hand');
  // From lane:
  const s2 = run(s0,
    { type: 'CARD_STAGED', intentId: 'i', cardId: 's1' as CardId, lane: 0, owner: 'P0', cost: 3 },
    { type: 'CARD_BANISHED', cardId: 's1' as CardId, cause },
  );
  eq(s2.cards['s1' as CardId]!.zone, 'BANISHED', 'CARD_BANISHED (from lane): zone=BANISHED');
  eq(s2.lanesById[0].cards.P0.length, 0, 'CARD_BANISHED: gone from lane');
}

// -- CARD_ADDED_TO_HAND: mints with spawnSource (Agent 13 / Collector)

{
  const s0 = emptyState();
  const spawn = { kind: 'CARD_CREATED' as const, sourceCardId: 'agent13' as CardId };
  const s1 = run(s0, {
    type: 'CARD_ADDED_TO_HAND',
    owner: 'P0',
    cardId: 'spawn1' as CardId,
    defId: 'grunt',
    spawnSource: spawn,
  });
  eq(s1.cards['spawn1' as CardId]?.zone, 'HAND', 'CARD_ADDED_TO_HAND: zone=HAND');
  eq(s1.cards['spawn1' as CardId]?.spawnSource, spawn, 'CARD_ADDED_TO_HAND: spawnSource recorded');
  eq(s1.hand.P0.length, 1, 'CARD_ADDED_TO_HAND: in hand list');
}

// -- CARD_ADDED_TO_LANE: mints with spawnSource (Brood / Bar Sinister)

{
  const s0 = emptyState();
  const spawn = { kind: 'LOCATION_CREATED' as const, sourceLocationId: 'bar-sinister' as LocationCardInstanceId };
  const s1 = run(s0, {
    type: 'CARD_ADDED_TO_LANE',
    owner: 'P0',
    cardId: 'spawn2' as CardId,
    lane: 1,
    defId: 'grunt',
    spawnSource: spawn,
  });
  eq(s1.cards['spawn2' as CardId]?.zone, 'LANE', 'CARD_ADDED_TO_LANE: zone=LANE');
  eq(s1.cards['spawn2' as CardId]?.spawnSource, spawn, 'CARD_ADDED_TO_LANE: spawnSource recorded');
  eq(s1.lanesById[1].cards.P0, ['spawn2'] as CardId[], 'CARD_ADDED_TO_LANE: in lane list');
}

// -- DECK_SHUFFLED: reorders deck per newOrder

{
  const s = emptyState();
  const a = mkCardInstance('a', 'grunt', 'P0');
  const b = mkCardInstance('b', 'grunt', 'P0');
  const c = mkCardInstance('c', 'grunt', 'P0');
  const s0: MatchState = {
    ...s,
    cards: { a, b, c } as Record<CardId, CardInstance>,
    deck: { P0: [a, b, c], P1: [] },
  };
  const s1 = run(s0, { type: 'DECK_SHUFFLED', owner: 'P0', newOrder: ['c', 'a', 'b'] as CardId[] });
  eq(s1.deck.P0.map(x => x.id), ['c', 'a', 'b'] as CardId[], 'DECK_SHUFFLED: order matches newOrder');
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
  const locId = 'loc0' as LocationCardInstanceId;
  const s0 = withTestLocation(emptyState(), 0, 'cathedral', false, locId);
  const s1 = run(s0, { type: 'LOCATION_REVEALED', lane: 0, locationId: locId });
  eq(locationCardAtLane(s1, 0)?.face, 'FACE_UP', 'LOCATION_REVEALED: lane 0 revealed');
  eq(locationCardAtLane(s1, 1), null, 'LOCATION_REVEALED: lane 1 unaffected');

  // Mismatched locationId → no-op
  const s2 = run(s0, { type: 'LOCATION_REVEALED', lane: 0, locationId: 'other' as LocationCardInstanceId });
  eq(locationCardAtLane(s2, 0)?.face, 'FACE_DOWN', 'LOCATION_REVEALED: id mismatch is a no-op');
}

// -- LOCATION_REPLACED: preserves the new definition identity for replay

{
  const oldId = 'old-location' as LocationCardInstanceId;
  const newId = 'new-location' as LocationCardInstanceId;
  const s0 = withTestLocation(emptyState(), 0, 'old-def', true, oldId);
  const s1 = run(s0, {
    type: 'LOCATION_REPLACED',
    lane: 0,
    oldId,
    newId,
    newDefId: 'new-def',
    cause: { sourceId: oldId, effectKind: 'SYSTEM' },
    oldDestination: 'DISCARD',
    revealed: false,
  });
  eq(locationCardAtLane(s1, 0)?.id, newId, 'LOCATION_REPLACED: new instance id recorded');
  eq(locationCardAtLane(s1, 0)?.defId, 'new-def', 'LOCATION_REPLACED: new definition id recorded');
  eq(locationCardAtLane(s1, 0)?.face, 'FACE_DOWN', 'LOCATION_REPLACED: new location starts hidden');
  truthy(s1.locationDeck.discardPile.includes(oldId), 'LOCATION_REPLACED: old instance conserved in destination');
  const mismatched = run(s0, {
    type: 'LOCATION_REPLACED',
    lane: 0,
    oldId: 'not-the-current-location' as LocationCardInstanceId,
    newId,
    newDefId: 'new-def',
    cause: { sourceId: oldId, effectKind: 'SYSTEM' },
    oldDestination: 'DISCARD',
    revealed: false,
  });
  eq(locationCardAtLane(mismatched, 0)?.id, oldId, 'LOCATION_REPLACED: old instance mismatch is a no-op');
}

// -- LOCATION_TAG_ADDED / REMOVED: on lane.location.tags

{
  const locId = 'loc1' as LocationCardInstanceId;
  const s0 = withTestLocation(emptyState(), 1, 'jungle-trail', true, locId);
  const s1 = run(s0,
    { type: 'LOCATION_TAG_ADDED', lane: 1, tag: { kind: 'ON_FIRE' } },
    { type: 'LOCATION_TAG_ADDED', lane: 1, tag: { kind: 'ON_FIRE' } }, // dup
  );
  eq(locationCardAtLane(s1, 1)!.tags.length, 1, 'LOCATION_TAG_ADDED: idempotent');
  const s2 = run(s1, { type: 'LOCATION_TAG_REMOVED', lane: 1, tag: 'ON_FIRE' });
  eq(locationCardAtLane(s2, 1)!.tags.length, 0, 'LOCATION_TAG_REMOVED: removed');
}

// -- LOCATION_SHIFTED: moves the location from one lane to another

{
  const locId = 'wander' as LocationCardInstanceId;
  const s0 = withTestLocation(emptyState(), 0, 'wander', true, locId);
  const cause = { sourceId: 's' as CardId, effectKind: 'ON_REVEAL' as const };
  const s1 = run(s0, { type: 'LOCATION_SHIFTED', fromLane: 0, toLane: 2, locationId: locId, cause });
  truthy(locationCardAtLane(s1, 0) === null, 'LOCATION_SHIFTED: source lane cleared');
  truthy(locationCardAtLane(s1, 2) !== null, 'LOCATION_SHIFTED: dest lane has location');
  eq(locationCardAtLane(s1, 2)!.laneId, 2, 'LOCATION_SHIFTED: location.lane updated');
  eq(locationCardAtLane(s1, 2)!.id, locId, 'LOCATION_SHIFTED: same location id preserved');
  eq(locationCardAtLane(s1, 2)!.face, 'FACE_UP', 'LOCATION_SHIFTED: revealed state preserved');

  const occupied = withTestLocation(
    s0,
    2,
    'occupied',
    true,
    'occupied' as LocationCardInstanceId,
  );
  const rejected = run(occupied, {
    type: 'LOCATION_SHIFTED',
    fromLane: 0,
    toLane: 2,
    locationId: locId,
    cause,
  });
  eq(
    locationCardAtLane(rejected, 0)?.id,
    locId,
    'LOCATION_SHIFTED: occupied destination preserves the source',
  );
  eq(
    locationCardAtLane(rejected, 2)?.id,
    'occupied' as LocationCardInstanceId,
    'LOCATION_SHIFTED: occupied destination is never evicted',
  );
}

// -- TURN_STARTED / TURN_ENDED: housekeeping

{
  const s0 = stateWithSentinelInHand();
  const resolving = run(s0, { type: 'TURN_RESOLUTION_STARTED', turn: 1 });
  eq(resolving.phase, 'RESOLVING', 'TURN_RESOLUTION_STARTED: phase = RESOLVING');

  const s1 = run(resolving,
    { type: 'CARD_STAGED', intentId: 'i1', cardId: 's1' as CardId, lane: 0, owner: 'P0', cost: 3 },
    // Give the card a transient tag...
    { type: 'CARD_TAG_ADDED', cardId: 's1' as CardId, tag: { kind: 'MOVED_THIS_TURN' } },
    { type: 'TURN_ENDED', turn: 1 },
  );
  truthy(!s1.cards['s1' as CardId]!.tags.some(t => t.kind === 'MOVED_THIS_TURN'),
    'TURN_ENDED: transient tags cleared');
  eq(s1.stagingOrder.length, 0, 'TURN_ENDED: stagingOrder cleared');
  eq(s1.phase, 'BETWEEN_TURNS', 'TURN_ENDED: phase = BETWEEN_TURNS');

  const s2 = run(s1, { type: 'TURN_STARTED', turn: 2, priority: 'P1', priorityReason: 'MORE_POWER' });
  eq(s2.turn, 2, 'TURN_STARTED: turn incremented');
  eq(s2.priority, 'P1', 'TURN_STARTED: priority set');
  eq(s2.phase, 'AWAITING_INTENT', 'TURN_STARTED: phase = AWAITING_INTENT');
}

// -- MATCH_ENDED: sets result + phase

{
  const s0 = emptyState();
  const s1 = run(s0, {
    type: 'MATCH_ENDED',
    result: { winner: 'P0', lanesWon: { P0: 2, P1: 1 }, totalPower: { P0: 20, P1: 15 } },
  });
  eq(s1.phase, 'ENDED', 'MATCH_ENDED: phase = ENDED');
  eq(s1.result?.winner, 'P0', 'MATCH_ENDED: winner recorded');
  eq(s1.result?.lanesWon.P0, 2, 'MATCH_ENDED: lanesWon recorded');
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
    { type: 'ENERGY_CHANGED', owner: 'P0', delta: -1, reason: 'EFFECT' },
    { type: 'ENERGY_CHANGED', owner: 'P1',    delta: -1, reason: 'EFFECT' },
    { type: 'ENERGY_CHANGED', owner: 'P0', delta: +2, reason: 'TURN_START' },
  );
  eq(s1.log.length, 3, 'log length = 3');
  eq(s1.log.map(e => e.frame), [1, 2, 3], 'canonical frame is monotonic from genesis');
}

// -- Purity: applying an event does not mutate the input state

{
  const s0 = stateWithSentinelInHand();
  const frozen = JSON.parse(JSON.stringify(s0));
  const _ = apply(s0, { type: 'ENERGY_CHANGED', owner: 'P0', delta: -1, reason: 'EFFECT' }, BOOTSTRAP_MANIFEST);
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

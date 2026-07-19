import type { Manifest } from '../engine/manifest/types';
import { apply } from '../engine/apply';
import { executeReactionCommands } from '../engine/effects/evaluator';
import { createRng } from '../engine/rng';
import { appendGameplayRngAdvance } from '../engine/rng/transaction';
import type { MatchEvent } from '../engine/types/events';
import type { MatchState } from '../engine/types/state';
import { buildCardDrawEvents } from '../engine/draw';
import { applyHandEntryDebuffs } from '../engine/effects/evaluator';
import { activeLaneIds, locationCardAtLane } from '../engine/laneTopology';
import { revealLocation } from '../engine/locationLifecycle';

export interface OpeningTransaction {
  readonly transactionId: string;
  readonly events: readonly MatchEvent[];
}

/**
 * Builds the canonical engine-owned opening batch. Seat order is fixed so the
 * same genesis always produces the same complete transaction.
 */
export function buildOpeningTransaction(
  genesis: MatchState,
  manifest: Manifest,
): OpeningTransaction {
  const startingHandSize = manifest.constants.startingHandSize;
  const turnStartDraw = manifest.constants.turnStartDraw;
  if (!Number.isSafeInteger(startingHandSize) || startingHandSize < 0) {
    throw new Error(`buildOpeningTransaction: invalid startingHandSize ${startingHandSize}`);
  }
  if (startingHandSize > manifest.constants.handCap) {
    throw new Error(
      `buildOpeningTransaction: startingHandSize ${startingHandSize} exceeds handCap ${manifest.constants.handCap}`,
    );
  }
  if (!Number.isSafeInteger(turnStartDraw) || turnStartDraw < 0) {
    throw new Error(`buildOpeningTransaction: invalid turnStartDraw ${turnStartDraw}`);
  }
  const openingHandSize = startingHandSize + turnStartDraw;
  if (openingHandSize > manifest.constants.handCap) {
    throw new Error(
      `buildOpeningTransaction: opening hand size ${openingHandSize} exceeds handCap ${manifest.constants.handCap}`,
    );
  }

  const events: MatchEvent[] = [];
  let state = genesis;
  const openingRng = createRng(genesis.rng);
  for (const owner of ['P0', 'P1'] as const) {
    if (genesis.hand[owner].length !== 0) {
      throw new Error(`buildOpeningTransaction: ${owner} opening hand is not empty`);
    }
    if (genesis.deck[owner].length < openingHandSize) {
      throw new Error(
        `buildOpeningTransaction: ${owner} deck has ${genesis.deck[owner].length} cards; needs ${openingHandSize}`,
      );
    }
    for (const event of buildCardDrawEvents(state, owner, startingHandSize, manifest)) {
      events.push(event);
      state = apply(state, event, manifest);
    }
  }

  const scheduledLocationLanes = activeLaneIds(state).filter((laneId) => {
    const location = locationCardAtLane(state, laneId);
    return location?.face === 'FACE_DOWN'
      && state.lanesById[laneId].locationSlot.revealAtTurn === 1;
  });
  for (const lane of scheduledLocationLanes) {
    const location = locationCardAtLane(state, lane);
    if (
      !location
      || location.face !== 'FACE_DOWN'
      || state.lanesById[lane]?.status !== 'ACTIVE'
      || state.lanesById[lane].locationSlot.revealAtTurn !== 1
    ) {
      continue;
    }
    const reveal = revealLocation(state, lane, {
      sourceId: location.id,
      effectKind: 'SYSTEM',
      reason: 'OPENING_LOCATION_REVEAL',
    }, manifest);
    if (!reveal.ok) {
      throw new Error(`opening location reveal failed: ${reveal.message}`);
    }
    events.push(...reveal.events);
    state = reveal.state;

    const locationTrigger = executeReactionCommands(state, [{
      type: 'INVOKE_LOCATION_TRIGGER',
      locationId: location.id,
      lane,
      slot: 'REVEAL',
      depth: 0,
      cause: {
          sourceId: location.id,
          effectKind: 'LOCATION',
          reason: 'OPENING_LOCATION_ON_REVEAL',
      },
    }], {
      rng: openingRng.scope(`opening:location:${location.id}`),
    }, manifest);
    events.push(...locationTrigger.events);
    state = locationTrigger.state;
  }

  // Turn 1 begins after the initial location is live. Use the same normal
  // draw selection and hand-entry reaction pipeline as later turn starts.
  for (const owner of ['P0', 'P1'] as const) {
    const draws = buildCardDrawEvents(state, owner, turnStartDraw, manifest);
    for (const event of draws) {
      events.push(event);
      state = apply(state, event, manifest);
      const reactions = applyHandEntryDebuffs(
        state,
        event.cardId,
        owner,
        openingRng.scope(`turn-start-draw:${owner}:${event.cardId}`),
        manifest,
      );
      events.push(...reactions.events);
      state = reactions.state;
    }
  }

  return Object.freeze({
    transactionId: `opening:${genesis.rng.seed}`,
    events: appendGameplayRngAdvance(genesis, openingRng, events),
  });
}

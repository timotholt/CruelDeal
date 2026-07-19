import type { Manifest } from '../engine/manifest/types';
import { apply } from '../engine/apply';
import { evalEffect, type EffectCtx } from '../engine/effects/evaluator';
import { createRng } from '../engine/rng';
import type { MatchEvent } from '../engine/types/events';
import type { LaneId } from '../engine/types/ids';
import type { MatchState } from '../engine/types/state';
import { buildCardDrawEvents } from '../engine/draw';
import { applyHandEntryDebuffs } from '../engine/effects/evaluator';
import { activeLaneIds, locationCardAtLane } from '../engine/laneTopology';

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
  const openingRng = createRng(genesis.seed);
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

  const lane = activeLaneIds(state).find((laneId) => {
    const location = locationCardAtLane(state, laneId);
    return location?.face === 'FACE_DOWN'
      && state.lanesById[laneId].locationSlot.revealAtTurn === 1;
  });
  const location = lane === undefined ? null : locationCardAtLane(state, lane);
  if (location) {
    const reveal: MatchEvent = {
      type: 'LOCATION_REVEALED',
      lane: lane!,
      locationId: location.id,
    };
    events.push(reveal);
    state = apply(state, reveal, manifest);

    const effects = manifest.locations[location.defId]?.abilities.onReveal ?? [];
    const locationRng = openingRng.fork(`opening:location:${location.id}`);
    for (let index = 0; index < effects.length; index++) {
      const context: EffectCtx = {
        state,
        manifest,
        self: location.id,
        selfKind: 'location',
        selfLane: lane!,
        selfOwner: null,
        rng: locationRng.fork(`effect:${index}`),
        source: { sourceId: location.id, effectKind: 'LOCATION', exprIdx: index },
        depth: 0,
      };
      const result = evalEffect(state, effects[index], context, manifest);
      events.push(...result.events);
      state = result.state;
    }
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
        openingRng.fork(`turn-start-draw:${owner}:${event.cardId}`),
        manifest,
      );
      events.push(...reactions.events);
      state = reactions.state;
    }
  }

  return Object.freeze({
    transactionId: `opening:${genesis.seed}`,
    events: Object.freeze(events),
  });
}

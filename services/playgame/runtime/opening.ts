import type { Manifest } from '../engine/manifest/types';
import { apply } from '../engine/apply';
import { evalEffect, type EffectCtx } from '../engine/effects/evaluator';
import { createRng } from '../engine/rng';
import type { MatchEvent } from '../engine/types/events';
import type { LaneIdx } from '../engine/types/ids';
import type { MatchState } from '../engine/types/state';

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
  if (!Number.isSafeInteger(startingHandSize) || startingHandSize < 0) {
    throw new Error(`buildOpeningTransaction: invalid startingHandSize ${startingHandSize}`);
  }
  if (startingHandSize > manifest.constants.handCap) {
    throw new Error(
      `buildOpeningTransaction: startingHandSize ${startingHandSize} exceeds handCap ${manifest.constants.handCap}`,
    );
  }

  const events: MatchEvent[] = [];
  let state = genesis;
  for (const owner of ['P0', 'P1'] as const) {
    if (genesis.hand[owner].length !== 0) {
      throw new Error(`buildOpeningTransaction: ${owner} opening hand is not empty`);
    }
    if (genesis.deck[owner].length < startingHandSize) {
      throw new Error(
        `buildOpeningTransaction: ${owner} deck has ${genesis.deck[owner].length} cards; needs ${startingHandSize}`,
      );
    }
    for (const card of genesis.deck[owner].slice(0, startingHandSize)) {
      const event = Object.freeze({
        type: 'CARD_DRAWN',
        owner,
        cardId: card.id,
        toHand: true,
      } as const);
      events.push(event);
      state = apply(state, event, manifest);
    }
  }

  const lane = state.lanes.findIndex((candidate) => !candidate.locationRevealed) as LaneIdx;
  const location = lane >= 0 && lane <= 2 ? state.lanes[lane].location : null;
  if (location) {
    const reveal: MatchEvent = {
      type: 'LOCATION_REVEALED',
      lane,
      locationId: location.id,
    };
    events.push(reveal);
    state = apply(state, reveal, manifest);

    const effects = manifest.locations[location.defId]?.abilities.onReveal ?? [];
    const openingRng = createRng(genesis.seed).fork(`opening:location:${location.id}`);
    for (let index = 0; index < effects.length; index++) {
      const context: EffectCtx = {
        state,
        manifest,
        self: location.id,
        selfKind: 'location',
        selfLane: lane,
        selfOwner: null,
        rng: openingRng.fork(`effect:${index}`),
        source: { sourceId: location.id, effectKind: 'LOCATION', exprIdx: index },
        depth: 0,
      };
      const result = evalEffect(state, effects[index], context, manifest);
      events.push(...result.events);
      state = result.state;
    }
  }

  return Object.freeze({
    transactionId: `opening:${genesis.seed}`,
    events: Object.freeze(events),
  });
}

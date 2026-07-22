import type { Manifest } from './manifest/types';
import { executeRulesCommands } from './effects/rulesInterpreter';
import { createRng } from './rng';
import { appendGameplayRngResolution } from './rng/transaction';
import type { KernelResolutionStep } from './kernel/resolutionTrace';
import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';
import type { CardId } from './types/ids';
import { activeLaneIds, locationCardAtLane } from './laneTopology';

export interface OpeningTransaction {
  readonly transactionId: string;
  readonly events: readonly MatchEvent[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
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
  const resolutionSteps: KernelResolutionStep[] = [];
  const append = (
    result: {
      readonly events: readonly MatchEvent[];
      readonly resolutionSteps: readonly KernelResolutionStep[];
    },
  ): void => {
    const transitionOffset = events.length;
    events.push(...result.events);
    resolutionSteps.push(...result.resolutionSteps.map(step => ({
      transitionIndex: step.transitionIndex === null
        ? null
        : step.transitionIndex + transitionOffset,
      effect: step.effect,
    })));
  };
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
    const draw = executeRulesCommands(
      state,
      Array.from({ length: startingHandSize }, () => ({
        type: 'DRAW_CARD' as const,
        owner,
        selection: { kind: 'TOP' as const },
        cause: {
          sourceId: `system:opening-hand:${owner}` as CardId,
          effectKind: 'SYSTEM' as const,
          reason: 'OPENING_HAND_DRAW',
        },
      })),
      { rng: openingRng.scope(`opening-hand:${owner}`) },
      manifest,
    );
    append(draw);
    state = draw.state;
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
    const reveal = executeRulesCommands(state, [{
      type: 'REVEAL_LOCATION',
      lane,
      locationId: location.id,
      cause: {
        sourceId: location.id,
        effectKind: 'SYSTEM',
        reason: 'OPENING_LOCATION_REVEAL',
      },
    }], {
      rng: openingRng.scope(`opening:location:${location.id}`),
    }, manifest);
    append(reveal);
    state = reveal.state;
  }

  // Turn 1 begins after the initial location is live. Use the same normal
  // draw selection and hand-entry reaction pipeline as later turn starts.
  for (const owner of ['P0', 'P1'] as const) {
    const draw = executeRulesCommands(
      state,
      Array.from({ length: turnStartDraw }, () => ({
        type: 'DRAW_CARD' as const,
        owner,
        selection: { kind: 'TOP' as const },
        cause: {
          sourceId: `system:opening-turn-draw:${owner}` as CardId,
          effectKind: 'SYSTEM' as const,
          reason: 'TURN_START_DRAW',
        },
      })),
      { rng: openingRng.scope(`turn-start-draw:${owner}`) },
      manifest,
    );
    append(draw);
    state = draw.state;
  }

  const completed = executeRulesCommands(state, [{
    type: 'COMPLETE_SETUP',
    authority: 'SYSTEM',
  }], {
    rng: openingRng.scope('complete-setup'),
  }, manifest);
  append(completed);

  const committed = appendGameplayRngResolution(genesis, openingRng, {
    events,
    resolutionSteps,
  });

  return Object.freeze({
    transactionId: `opening:${genesis.rng.seed}`,
    events: committed.events,
    resolutionSteps: committed.resolutionSteps,
  });
}

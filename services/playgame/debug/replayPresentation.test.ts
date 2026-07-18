import { describe, expect, it } from 'vitest';

import { createInitialMatchState } from '../engine/cli/initState';
import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { ReplayFrame } from '../engine/replay';
import type { CardId, LocationId } from '../engine/types/ids';
import type { MatchEvent } from '../engine/types/events';
import {
  annotateReplayEventJson,
  createReplayActorResolver,
  createReplayNameResolver,
  describeReplayCause,
  describeReplayFrame,
} from './replayPresentation';

const state = createInitialMatchState('replay-presentation', BOOTSTRAP_MANIFEST, {
  P0: [{ defId: 'bone-market' }],
  P1: [{ defId: 'bone-market' }],
});
const cardId = state.deck.P0[0].id;
const location = state.lanes[0].location!;

const frame = (event: MatchEvent): ReplayFrame => ({ index: 1, transactionId: 'p0-tx', event, state });
const frames: ReplayFrame[] = [{ index: 0, event: null, state }];
const names = createReplayNameResolver(frames, BOOTSTRAP_MANIFEST);
const actors = {
  actorLabel: () => 'Player 1 (YOU)',
  playerLabel: (owner: string | undefined) => owner === 'P0' ? 'Player 1' : owner === 'P1' ? 'Player 2' : 'Game',
};

describe('replay debug presentation', () => {
  it('resolves card and location instance ids while preserving unknown ids', () => {
    expect(names.cardLabel(state, cardId)).toBe(`${cardId} (Bone Market, P0)`);
    expect(names.locationLabel(state, location.id)).toBe(
      `${location.id} (${BOOTSTRAP_MANIFEST.locations[location.defId].name})`,
    );
    expect(names.cardLabel(state, 'missing-card' as CardId)).toBe('missing-card');
    expect(names.locationLabel(state, 'missing-location' as LocationId)).toBe('missing-location');

    const stateAfterRemoval = {
      ...state,
      lanes: [
        { ...state.lanes[0], location: null },
        state.lanes[1],
        state.lanes[2],
      ] as const,
    };
    const historicalNames = createReplayNameResolver([
      ...frames,
      { index: 1, event: null, state: stateAfterRemoval },
    ], BOOTSTRAP_MANIFEST);
    expect(historicalNames.locationLabel(stateAfterRemoval, location.id)).toBe(
      `${location.id} (${BOOTSTRAP_MANIFEST.locations[location.defId].name})`,
    );

    const stateAfterCardRemoval = {
      ...state,
      cards: Object.fromEntries(
        Object.entries(state.cards).filter(([id]) => id !== cardId),
      ) as typeof state.cards,
    };
    const historicalCardNames = createReplayNameResolver([
      ...frames,
      { index: 1, event: null, state: stateAfterCardRemoval },
    ], BOOTSTRAP_MANIFEST);
    expect(historicalCardNames.cardLabel(stateAfterCardRemoval, cardId))
      .toBe(`${cardId} (Bone Market, P0)`);
  });

  it('name-resolves event fields and nested cause sourceIds without changing the event', () => {
    const event: MatchEvent = {
      type: 'CARD_POWER_CHANGED',
      cardId,
      delta: 2,
      cause: { sourceId: cardId, effectKind: 'ON_REVEAL' },
    };
    const snapshot = structuredClone(event);

    expect(describeReplayFrame(frame(event), names, actors).summary)
      .toBe('Bone Market gained 2 power - caused by Bone Market (P0).');
    expect(annotateReplayEventJson(frame(event), names)).toContain(`// Bone Market (P0)`);
    expect(event).toEqual(snapshot);
  });

  it('decodes card, location, spell-cleanup, and generic system causes', () => {
    expect(describeReplayCause(frame({
      type: 'CARD_POWER_CHANGED',
      cardId,
      delta: 1,
      cause: { sourceId: cardId, effectKind: 'ONGOING' },
    }), names)).toBe('caused by Bone Market (P0)');

    expect(describeReplayCause(frame({
      type: 'LOCATION_DESTROYED',
      lane: 0,
      locationId: location.id,
      cause: { sourceId: location.id, effectKind: 'LOCATION' },
    }), names)).toBe(`caused by left lane location ${BOOTSTRAP_MANIFEST.locations[location.defId].name}`);

    expect(describeReplayCause(frame({
      type: 'CARD_BANISHED',
      cardId,
      cause: { sourceId: cardId, effectKind: 'SYSTEM', systemReason: 'SPELL_RESOLVED' },
    }), names)).toBe('caused by Bone Market (P0) resolving under the game rules');

    expect(describeReplayCause(frame({
      type: 'CARD_BANISHED',
      cardId,
      cause: { sourceId: 'rules' as CardId, effectKind: 'SYSTEM', systemReason: 'ROUND_CLEANUP' },
    }), names)).toBe('caused by game rules: Round cleanup');

    const locationJson = annotateReplayEventJson(frame({
      type: 'CARD_COST_CHANGED',
      cardId,
      delta: -1,
      cause: { sourceId: location.id, effectKind: 'LOCATION' },
    }), names);
    expect(locationJson).toContain(`// ${BOOTSTRAP_MANIFEST.locations[location.defId].name}, left lane`);
    expect(describeReplayFrame(frame({
      type: 'CARD_COST_CHANGED',
      cardId,
      delta: -1,
      cause: { sourceId: location.id, effectKind: 'LOCATION' },
    }), names, actors).summary).toBe(
      `P0 - Bone Market's cost decreased by 1 - caused by left lane location ${BOOTSTRAP_MANIFEST.locations[location.defId].name}.`,
    );
  });

  it('maps runtime frames to the accepted transaction actor and bootstrap display name', () => {
    const replay = {
      version: 1 as const,
      genesis: state,
      bootstrap: {
        viewerSeat: 'P0',
        participants: {
          P0: { displayName: 'YOU' },
          P1: { displayName: 'OPPONENT' },
        },
      },
      transactions: [
        { transactionId: 'p0-tx', intent: { seat: 'P0' } },
        { transactionId: 'p1-tx', intent: { seat: 'P1' } },
        { transactionId: 'system-tx', intent: { seat: 'SYSTEM' } },
      ],
    } as unknown as Parameters<typeof createReplayActorResolver>[0];
    const resolver = createReplayActorResolver(replay);

    const event: MatchEvent = { type: 'TURN_RESOLUTION_STARTED', turn: 2 };
    expect(resolver.actorLabel(frame(event))).toBe('Player 1 (YOU)');
    expect(resolver.actorLabel({ ...frame(event), transactionId: 'p1-tx' }))
      .toBe('Player 2 (OPPONENT)');
    expect(resolver.actorLabel({ ...frame(event), transactionId: 'system-tx' }))
      .toBe('Game');
    expect(resolver.actorLabel(frames[0])).toBe('Game');
  });

  it('explains common replay events without exposing engine field names', () => {
    const stagedEvent: MatchEvent = {
      type: 'CARD_STAGED',
      intentId: 'play-card',
      cardId,
      lane: 2,
      owner: 'P0',
      cost: 1,
    };
    expect(describeReplayFrame(frame(stagedEvent), names, actors).summary)
      .toBe('Player 1 played Bone Market to the right lane, slot FL.');
    expect(annotateReplayEventJson(frame(stagedEvent), names))
      .toContain('"lane": 2,  // right lane');

    expect(describeReplayFrame(frame({
      type: 'CARD_FLIPPED',
      cardId,
    }), names, actors).summary).toBe('Player 1 — Bone Market — Revealed.');

    expect(describeReplayFrame(frame({
      type: 'MATCH_ENDED',
      result: {
        winner: 'P0',
        lanesWon: { P0: 2, P1: 1 },
        totalPower: { P0: 24, P1: 19 },
      },
    }), names, actors).summary).toBe('End of game — Player 1 won.');
  });
});

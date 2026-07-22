import { describe, expect, it } from 'vitest';

import { createInitialMatchState } from '../engine/cli/initState';
import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { ReplayStep } from '../engine/replay';
import {
  mkPendingEffectId,
  type CardId,
  type LocationCardInstanceId,
} from '../engine/types/ids';
import type { MatchEvent } from '../engine/types/events';
import { GENESIS_FRAME, asFrame } from '../engine/types/timeline';
import { locationCardAtLane } from '../engine/laneTopology';
import {
  orderedTestLocationDeck,
  removeTestCard,
  removeTestLocation,
} from '../engine/testkit/runtimeFixture';
import {
  annotateReplayEffectJson,
  annotateReplayEventJson,
  createReplayActorResolver,
  createReplayNameResolver,
  describeReplayEffect,
  describeReplayCause,
  describeReplayStep,
} from './replayPresentation';
import type { EffectTraceEntry } from '../engine/types/effectTrace';
import {
  effectAttemptId,
  effectInvocationId,
} from '../engine/types/effectTrace';

const state = createInitialMatchState('replay-presentation', BOOTSTRAP_MANIFEST, {
  P0: Array.from({ length: 4 }, () => ({ defId: 'bone-market' })),
  P1: Array.from({ length: 4 }, () => ({ defId: 'bone-market' })),
}, orderedTestLocationDeck(BOOTSTRAP_MANIFEST));
const cardId = state.hand.P0[0];
const location = locationCardAtLane(state, 0)!;

const step = (
  event: MatchEvent | null,
  effect: EffectTraceEntry | null = null,
): ReplayStep => ({
  cursor: 1,
  transactionId: 'p0-tx',
  canonicalFrame: {
    frame: asFrame(1),
    scope: { turn: 1, phase: 'ACTION' },
    event,
    effect,
  },
  frame: asFrame(1),
  scope: { turn: 1, phase: 'ACTION' },
  event,
  state,
});
const steps: ReplayStep[] = [{
  cursor: 0,
  canonicalFrame: null,
  frame: GENESIS_FRAME,
  scope: null,
  event: null,
  state,
}];
const names = createReplayNameResolver(steps, BOOTSTRAP_MANIFEST);
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
    expect(names.locationLabel(state, 'missing-location' as LocationCardInstanceId)).toBe('missing-location');

    const stateAfterRemoval = removeTestLocation({
      ...state,
      lanesById: {
        ...state.lanesById,
        0: {
          ...state.lanesById[0],
          locationSlot: {
            ...state.lanesById[0].locationSlot,
            locationCardId: null,
          },
        },
      },
    }, location.id);
    const historicalNames = createReplayNameResolver([
      ...steps,
      { ...steps[0], state: stateAfterRemoval },
    ], BOOTSTRAP_MANIFEST);
    expect(historicalNames.locationLabel(stateAfterRemoval, location.id)).toBe(
      `${location.id} (${BOOTSTRAP_MANIFEST.locations[location.defId].name})`,
    );

    const stateAfterCardRemoval = removeTestCard(state, cardId);
    const historicalCardNames = createReplayNameResolver([
      ...steps,
      { ...steps[0], state: stateAfterCardRemoval },
    ], BOOTSTRAP_MANIFEST);
    expect(historicalCardNames.cardLabel(stateAfterCardRemoval, cardId))
      .toBe(`${cardId} (Bone Market, P0)`);
  });

  it('name-resolves event fields and nested cause sourceIds without changing the event', () => {
    const event: MatchEvent = {
      type: 'CARD_POWER_CHANGED',
      cardId,
      mutation: { kind: 'ADD', delta: 2 },
      cause: { sourceId: cardId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    };
    const snapshot = structuredClone(event);

    expect(describeReplayStep(step(event), names, actors).summary)
      .toBe("Player 1's Bone Market gained 2 power - caused by Bone Market (P0).");
    expect(annotateReplayEventJson(step(event), names)).toContain(`// Bone Market (P0)`);
    expect(event).toEqual(snapshot);
  });

  it('summarizes and annotates canonical effect trace entries', () => {
    const invocationId = effectInvocationId('tx', 0);
    const started: EffectTraceEntry = {
      kind: 'EFFECT_INVOCATION_STARTED',
      invocationId,
      parentInvocationId: null,
      source: { kind: 'CARD', cardId },
      ability: { kind: 'ON_REVEAL', ruleId: 'card:test', ruleIndex: 0 },
      invocationReason: 'NATURAL',
      depth: 0,
      candidates: [
        { kind: 'CARD', cardId },
        { kind: 'LOCATION', locationId: location.id },
      ],
    };
    expect(describeReplayEffect(step(null, started), names, actors))
      .toBe('Bone Market (P0) began On reveal 1: 2 targets selected.');
    expect(annotateReplayEffectJson(step(null, started), names, actors))
      .toContain('// Bone Market (P0)');

    const blocked: EffectTraceEntry = {
      kind: 'EFFECT_TARGET_RESOLVED',
      invocationId,
      attemptId: effectAttemptId(invocationId, 0),
      attemptOrdinal: 0,
      operation: 'DESTROY',
      target: { kind: 'CARD', cardId },
      result: 'BLOCKED',
      blockedBy: [{ kind: 'LOCATION', locationId: location.id }],
      reason: 'CANNOT_BE_DESTROYED',
    };
    expect(describeReplayEffect(step(null, blocked), names, actors))
      .toBe(`Attempt 1: DESTROY on Bone Market (P0) — blocked by ${BOOTSTRAP_MANIFEST.locations[location.defId].name} (left lane) (cannot be destroyed).`);

    const completed: EffectTraceEntry = {
      kind: 'EFFECT_INVOCATION_COMPLETED',
      invocationId,
      attempted: 2,
      affected: 1,
      blocked: 1,
      invalidated: 0,
      unchanged: 0,
    };
    expect(describeReplayEffect(step(null, completed), names, actors))
      .toBe('Effect completed: 1 affected, 1 blocked, 0 invalidated, 0 unchanged.');
  });

  it('decodes card, location, spell-cleanup, and generic system causes', () => {
    expect(describeReplayCause(step({
      type: 'CARD_POWER_CHANGED',
      cardId,
      mutation: { kind: 'ADD', delta: 1 },
      cause: { sourceId: cardId, effectKind: 'ONGOING', reason: 'TEST' },
    }), names)).toBe('caused by Bone Market (P0)');

    expect(describeReplayCause(step({
      type: 'LOCATION_REPLACED',
      lane: 0,
      oldId: location.id,
      newId: `ruin:${location.id}` as LocationCardInstanceId,
      newDefId: 'ruin',
      oldDestination: 'DESTROYED',
      revealPolicy: 'REVEAL_IMMEDIATELY',
      cause: { sourceId: location.id, effectKind: 'LOCATION', reason: 'TEST' },
    }), names)).toBe(`caused by left lane location ${BOOTSTRAP_MANIFEST.locations[location.defId].name}`);

    expect(describeReplayCause(step({
      type: 'CARD_BANISHED',
      cardId,
      cause: { sourceId: cardId, effectKind: 'SYSTEM', reason: 'SPELL_RESOLVED' },
    }), names)).toBe('caused by Bone Market (P0) resolving under the game rules');

    expect(describeReplayCause(step({
      type: 'CARD_BANISHED',
      cardId,
      cause: { sourceId: 'rules' as CardId, effectKind: 'SYSTEM', reason: 'ROUND_CLEANUP' },
    }), names)).toBe('caused by game rules: Round cleanup');
    expect(describeReplayStep(step({
      type: 'CARD_BANISHED',
      cardId,
      cause: { sourceId: 'rules' as CardId, effectKind: 'SYSTEM', reason: 'ROUND_CLEANUP' },
    }), names, actors)).toMatchObject({
      actor: 'Player 1 (YOU)',
      summary: "Player 1's Bone Market was banished - caused by game rules: Round cleanup.",
    });

    const locationJson = annotateReplayEventJson(step({
      type: 'CARD_COST_CHANGED',
      cardId,
      delta: -1,
      cause: { sourceId: location.id, effectKind: 'LOCATION', reason: 'TEST' },
    }), names);
    expect(locationJson).toContain(`// ${BOOTSTRAP_MANIFEST.locations[location.defId].name}, left lane`);
    expect(describeReplayStep(step({
      type: 'CARD_COST_CHANGED',
      cardId,
      delta: -1,
      cause: { sourceId: location.id, effectKind: 'LOCATION', reason: 'TEST' },
    }), names, actors).summary).toBe(
      `Player 1's Bone Market cost decreased by 1 - caused by left lane location ${BOOTSTRAP_MANIFEST.locations[location.defId].name}.`,
    );
  });

  it('presents location destruction as the atomic Ruin replacement', () => {
    expect(describeReplayStep(step({
      type: 'LOCATION_REPLACED',
      lane: 0,
      oldId: location.id,
      newId: `ruin:${location.id}` as LocationCardInstanceId,
      newDefId: 'ruin',
      oldDestination: 'DESTROYED',
      revealPolicy: 'REVEAL_IMMEDIATELY',
      cause: { sourceId: location.id, effectKind: 'SYSTEM', reason: 'TEST' },
    }), names, actors).summary).toBe(
      `${BOOTSTRAP_MANIFEST.locations[location.defId].name} was destroyed and replaced by Ruin in the left lane - caused by game rules.`,
    );
  });

  it('presents pending effects by stable identity rather than payload equality', () => {
    const pendingEffectId = mkPendingEffectId('pending:1');
    const scheduledBy = {
      sourceId: cardId,
      effectKind: 'ON_REVEAL' as const,
      reason: 'TEST_PENDING',
    };
    expect(describeReplayStep(step({
      type: 'PENDING_EFFECT_SCHEDULED',
      effect: {
        id: pendingEffectId,
        kind: 'SCHEDULED',
        when: 'START_OF_NEXT_TURN',
        sourceId: cardId,
        sourceOwner: 'P0',
        sourceLane: 0,
        fireTurn: 2,
        effect: { kind: 'SEQUENCE', items: [] },
        scheduledBy,
      },
      cause: scheduledBy,
    }), names, actors).summary).toBe(
      `Pending effect “${pendingEffectId}” was scheduled for start of next turn - caused by Bone Market (P0).`,
    );

    expect(describeReplayStep(step({
      type: 'PENDING_EFFECT_CONSUMED',
      pendingEffectId,
      cause: {
        sourceId: cardId,
        effectKind: 'SYSTEM',
        reason: 'PENDING_EFFECT_FIRED',
      },
    }), names, actors).summary).toBe(
      `Pending effect “${pendingEffectId}” was consumed - caused by game rules: Pending effect fired.`,
    );
  });

  it('maps replay steps to the accepted transaction actor and bootstrap display name', () => {
    const replay = {
      version: 3 as const,
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
    expect(resolver.actorLabel(step(event))).toBe('Player 1 (YOU)');
    expect(resolver.actorLabel({ ...step(event), transactionId: 'p1-tx' }))
      .toBe('Player 2 (OPPONENT)');
    expect(resolver.actorLabel({ ...step(event), transactionId: 'system-tx' }))
      .toBe('Game');
    expect(resolver.actorLabel(steps[0])).toBe('Game');
  });

  it('explains common replay events without exposing engine field names', () => {
    const stagedEvent: MatchEvent = {
      type: 'CARD_STAGED',
      intentId: 'play-card',
      cardId,
      lane: 2,
      owner: 'P0',
      energyPaid: 1,
      cause: {
        sourceId: cardId,
        effectKind: 'SYSTEM',
        reason: 'TEST_STAGE',
      },
    };
    expect(describeReplayStep(step(stagedEvent), names, actors).summary)
      .toBe('Player 1 played Bone Market to the right lane, slot FL.');
    expect(annotateReplayEventJson(step(stagedEvent), names))
      .toContain('"lane": 2,  // right lane');

    expect(describeReplayStep(step({
      type: 'CARD_REVEALED',
      cardId,
      cause: {
        sourceId: cardId,
        effectKind: 'SYSTEM',
        reason: 'TEST_REVEAL',
      },
    }), names, actors).summary).toBe(
      'Player 1 — Bone Market — Revealed - caused by Bone Market (P0) resolving under the game rules.',
    );

    expect(describeReplayStep(step({
      type: 'MATCH_ENDED',
      result: {
        winner: 'P0',
        lanesWon: { P0: 2, P1: 1 },
        totalPower: { P0: 24, P1: 19 },
      },
    }), names, actors).summary).toBe('End of game — Player 1 won.');
  });
});

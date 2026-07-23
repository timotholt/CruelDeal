import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { BOOTSTRAP_MANIFEST } from '../../engine/manifest/bootstrap';
import {
  effectAttemptId,
  effectInvocationId,
} from '../../engine/types/effectTrace';
import { asFrame, type CanonicalFrame } from '../../engine/types/timeline';
import { foldCanonicalFrames } from '../../engine/transactionTimeline';
import { MatchSession } from '../matchSession';
import type {
  CommittedTransactionRecord,
  CommittedTransactionTimeline,
} from '../contracts';
import {
  hashSeatVisibleState,
  projectPresentationBlockForSeat,
} from '../projection';

function sessionFixture(): MatchSession {
  return MatchSession.fromBootstrap(
    buildDebugMatchBootstrap(
      DEBUG_DECKS[0],
      DEBUG_DECKS[1],
      'seat-effect-projection',
    ),
  );
}

describe('seat presentation block projection', () => {
  it('projects a complete canonical trace for both seats without canonical IDs', () => {
    const session = sessionFixture();
    const initialState = session.runtime.state();
    const transactionId = `${session.bootstrap.matchId}:tx:trace-test`;
    const invocationId = effectInvocationId(transactionId, 0);
    const sourceCardId = initialState.hand.P0[0]!;
    const observableTargetId = initialState.hand.P1[0]!;
    const hiddenDeckTargetId = initialState.deck.P1[0]!;
    const scope = initialState.timeline.scope;
    if (scope === null) throw new Error('opened match requires a timeline scope');
    const frames: readonly CanonicalFrame[] = [
      {
        frame: asFrame(initialState.timeline.frame + 1),
        scope,
        event: null,
        effect: {
          kind: 'EFFECT_INVOCATION_STARTED',
          invocationId,
          parentInvocationId: null,
          source: { kind: 'CARD', cardId: sourceCardId },
          ability: {
            kind: 'ON_REVEAL',
            ruleId: 'test-destroy',
            ruleIndex: 0,
          },
          invocationReason: 'NATURAL',
          depth: 0,
          candidates: [
            { kind: 'CARD', cardId: observableTargetId },
            { kind: 'CARD', cardId: hiddenDeckTargetId },
          ],
        },
      },
      {
        frame: asFrame(initialState.timeline.frame + 2),
        scope,
        event: null,
        effect: {
          kind: 'EFFECT_TARGET_RESOLVED',
          invocationId,
          attemptId: effectAttemptId(invocationId, 0),
          attemptOrdinal: 0,
          candidateOrdinal: 0,
          operation: 'DESTROY_CARD',
          target: { kind: 'CARD', cardId: observableTargetId },
          result: 'BLOCKED',
          blockedBy: [{ kind: 'CARD', cardId: sourceCardId }],
          reason: 'CANNOT_BE_DESTROYED',
        },
      },
      {
        frame: asFrame(initialState.timeline.frame + 3),
        scope,
        event: null,
        effect: {
          kind: 'EFFECT_INVOCATION_COMPLETED',
          invocationId,
          attempted: 1,
          affected: 0,
          blocked: 1,
          invalidated: 0,
          unchanged: 0,
        },
      },
    ];
    const folded = foldCanonicalFrames({
      transactionId,
      initialState,
      frames,
      manifest: BOOTSTRAP_MANIFEST,
    });
    const transaction: CommittedTransactionRecord = {
      transactionId,
      matchId: session.bootstrap.matchId,
      baseRevision: session.runtime.publicRevision(),
      revision: session.runtime.publicRevision() + 1,
      intent: {
        matchId: session.bootstrap.matchId,
        seat: 'SYSTEM',
        intentId: 'trace-test',
      },
      frames: folded.frames,
      rngDrawsBefore: initialState.rng.draws,
      rngDrawsAfter: initialState.rng.draws,
    };
    const timeline: CommittedTransactionTimeline = {
      transaction,
      transitions: folded.transitions,
      finalState: folded.finalState,
    };

    const p0 = projectPresentationBlockForSeat(
      timeline,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const p1 = projectPresentationBlockForSeat(
      timeline,
      'P1',
      BOOTSTRAP_MANIFEST,
    );
    expect(p0.frames).toHaveLength(3);
    expect(p1.frames).toHaveLength(3);
    expect(p0.frames[0]?.effect).toMatchObject({
      kind: 'EFFECT_INVOCATION_STARTED',
      ability: { kind: 'ON_REVEAL', ruleId: 'test-destroy', ruleIndex: 0 },
      candidates: [
        { kind: 'CARD' },
        { kind: 'HIDDEN', category: 'CARD' },
      ],
    });
    expect(p1.frames[0]?.effect).toMatchObject({
      kind: 'EFFECT_INVOCATION_STARTED',
      ability: { kind: 'HIDDEN' },
      candidates: [
        { kind: 'CARD' },
        { kind: 'HIDDEN', category: 'CARD' },
      ],
    });
    expect(p0.frames[1]?.effect).toMatchObject({
      kind: 'EFFECT_TARGET_RESOLVED',
      result: 'BLOCKED',
      reason: 'CANNOT_BE_DESTROYED',
    });
    expect(p0.postStateHash).toBe(hashSeatVisibleState(p0.postState));
    expect(p1.postStateHash).toBe(hashSeatVisibleState(p1.postState));
    expect(p0.frames.at(-1)?.after).toEqual(p0.postState);
    expect(p1.frames.at(-1)?.after).toEqual(p1.postState);

    const p0Json = JSON.stringify(p0);
    const p1Json = JSON.stringify(p1);
    const stringLeaves = (value: unknown): readonly string[] => {
      if (typeof value === 'string') return [value];
      if (Array.isArray(value)) return value.flatMap(stringLeaves);
      if (value !== null && typeof value === 'object') {
        return Object.values(value).flatMap(stringLeaves);
      }
      return [];
    };
    const p0Strings = stringLeaves(p0);
    const p1Strings = stringLeaves(p1);
    for (const secret of [
      sourceCardId,
      observableTargetId,
      hiddenDeckTargetId,
      invocationId,
    ]) {
      expect(p0Strings).not.toContain(secret);
      expect(p1Strings).not.toContain(secret);
    }
    expect(p0Json).not.toContain('"rng"');
    expect(p1Json).not.toContain('"rng"');
    expect(p0.frames[0]?.effect).not.toEqual(p1.frames[0]?.effect);
  });
});

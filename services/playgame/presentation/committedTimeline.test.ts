import { describe, expect, it } from 'vitest';

import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import { frameAndFoldEvents } from '../engine/transactionTimeline';
import type { MatchEvent } from '../engine/types/events';
import type { CardId, LaneId } from '../engine/types/ids';
import { buildRuntimeFixture } from '../engine/testkit';
import type { CommittedTransactionTimeline } from '../runtime/contracts';
import { planCommittedResolutionWalk } from './committedTimeline';

describe('committed END TURN choreography', () => {
  it('walks lock, remote fly-in, priority reveals, then non-priority reveals', () => {
    const fixture = buildRuntimeFixture({
      seed: 'presentation-order',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P1',
      decks: { P0: [], P1: [] },
      hands: {
        P0: [
          { id: 'local-now', defId: 'black-market-dealer' },
          { id: 'local-delayed', defId: 'black-market-dealer' },
        ],
        P1: [{ id: 'remote-priority', defId: 'black-market-dealer' }],
      },
      lanes: [
        { P0: [], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
    });
    const events: MatchEvent[] = [
      {
        type: 'CARD_STAGED',
        intentId: 'remote-stage',
        cardId: 'remote-priority' as CardId,
        lane: 0 as LaneId,
        owner: 'P1',
        cost: 1,
      },
      {
        type: 'CARD_STAGED',
        intentId: 'local-stage-now',
        cardId: 'local-now' as CardId,
        lane: 1 as LaneId,
        owner: 'P0',
        cost: 1,
      },
      {
        type: 'CARD_STAGED',
        intentId: 'local-stage-delayed',
        cardId: 'local-delayed' as CardId,
        lane: 2 as LaneId,
        owner: 'P0',
        cost: 1,
      },
      { type: 'TURN_RESOLUTION_STARTED', turn: 2 },
      { type: 'CARD_REVEALED', cardId: 'remote-priority' as CardId, cause: { sourceId: 'remote-priority' as CardId, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } },
      { type: 'CARD_REVEALED', cardId: 'local-now' as CardId, cause: { sourceId: 'local-now' as CardId, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } },
      // local-delayed deliberately has no CARD_REVEALED frame this turn. The
      // The engine's per-card reveal schedule expresses eligibility this way.
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const built = frameAndFoldEvents({
      transactionId: 'presentation-order:tx',
      initialState: fixture.state,
      events,
      manifest: BOOTSTRAP_MANIFEST,
    });
    const timeline: CommittedTransactionTimeline = {
      transaction: {
        transactionId: built.transactionId,
        matchId: 'presentation-order',
        baseRevision: 1,
        revision: 2,
        intent: { matchId: 'presentation-order', seat: 'SYSTEM', intentId: 'resolve' },
        framedEvents: built.framedEvents,
        rngDrawsBefore: fixture.state.rng.draws,
        rngDrawsAfter: built.finalState.rng.draws,
      },
      transitions: built.transitions,
      finalState: built.finalState,
    };

    const walk = planCommittedResolutionWalk(timeline, 'P0');
    const designerSteps = walk
      .filter((beat) => [
        'local-lock',
        'remote-fly-in',
        'priority-reveal',
        'non-priority-reveal',
      ].includes(beat.kind))
      .map((beat) => beat.kind);
    const revealedIds = walk.flatMap((beat) => (
      beat.kind === 'priority-reveal' || beat.kind === 'non-priority-reveal'
        ? [beat.frame.event.type === 'CARD_REVEALED' ? beat.frame.event.cardId : null]
        : []
    )).filter(Boolean);

    expect(designerSteps).toEqual([
      'local-lock',
      'remote-fly-in',
      'priority-reveal',
      'non-priority-reveal',
    ]);
    expect(revealedIds).toEqual(['remote-priority', 'local-now']);
    expect(revealedIds).not.toContain('local-delayed');
  });
});

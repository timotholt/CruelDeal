import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { BOOTSTRAP_MANIFEST } from '../../engine/manifest/bootstrap';
import { asFrame } from '../../engine/types/timeline';
import type { MatchRuntimeReplayExport } from '../contracts';
import { MatchSession } from '../matchSession';
import { renderRuntimeReplay } from '../replayExport';

function session(seed: string) {
  return MatchSession.fromBootstrap(
    buildDebugMatchBootstrap(DEBUG_DECKS[0], DEBUG_DECKS[1], seed),
  );
}

async function twoTransactionReplay(seed: string): Promise<MatchRuntimeReplayExport> {
  const match = session(seed);
  await match.runtime.submitIntent({
    matchId: match.bootstrap.matchId,
    seat: match.bootstrap.viewerSeat,
    intentId: 'frame-edge-end-turn',
    expectedRevision: match.runtime.revision(),
    intent: { type: 'END_TURN' },
  });
  return structuredClone(match.exportReplay());
}

describe('Runtime frame replay edge cases', () => {
  it('rejects the removed version-1 replay schema', () => {
    const match = session('frame-replay-old-version');
    const replay = {
      ...match.exportReplay(),
      version: 1,
    } as unknown as MatchRuntimeReplayExport;

    expect(() => renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST))
      .toThrow(/Unsupported runtime replay version: 1/);
  });

  it('rejects a replay whose claimed genesis already contains frames', () => {
    const match = session('frame-replay-dirty-genesis');
    const replay = {
      ...match.exportReplay(),
      genesis: match.runtime.state(),
    };

    expect(() => renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST))
      .toThrow(/genesis must be frame 0/);
  });

  it('allows revision gaps caused by private planning without inventing frames', () => {
    const match = session('frame-replay-revision-gap');
    const exported = structuredClone(match.exportReplay());
    const replay: MatchRuntimeReplayExport = {
      ...exported,
      transactions: exported.transactions.map((transaction, index) => (
        { ...transaction, baseRevision: 4 + index, revision: 5 + index }
      )),
    };

    const rendered = renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST);
    expect(rendered.finalState.timeline.frame)
      .toBe(replay.transactions.at(-1)?.framedEvents.at(-1)?.frame);
  });

  it('rejects transaction revisions that move backward', async () => {
    const exported = await twoTransactionReplay('frame-replay-revision-regression');
    const replay: MatchRuntimeReplayExport = {
      ...exported,
      transactions: exported.transactions.map((transaction, index) => (
        index === 1
          ? { ...transaction, baseRevision: 0, revision: 1 }
          : transaction
      )),
    };

    expect(() => renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST))
      .toThrow(/is out of order/);
  });

  it('rejects a committed transaction with no framed events', () => {
    const match = session('frame-replay-empty-transaction');
    const exported = structuredClone(match.exportReplay());
    const replay: MatchRuntimeReplayExport = {
      ...exported,
      transactions: exported.transactions.map((transaction, index) => (
        index === 0 ? { ...transaction, framedEvents: [] } : transaction
      )),
    };

    expect(() => renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST))
      .toThrow(/has no framed events/);
  });

  it('rejects an unknown event discriminant at replay ingress', () => {
    const match = session('frame-replay-unknown-event');
    const exported = structuredClone(match.exportReplay());
    const replay = {
      ...exported,
      transactions: exported.transactions.map((transaction, transactionIndex) => ({
        ...transaction,
        framedEvents: transaction.framedEvents.map((framedEvent, eventIndex) => (
          transactionIndex === 0 && eventIndex === 0
            ? { ...framedEvent, event: { type: 'UNKNOWN_EVENT' } }
            : framedEvent
        )),
      })),
    } as unknown as MatchRuntimeReplayExport;

    expect(() => renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST))
      .toThrow(/COMMITTED_TRANSACTION violates Cruel Deal protocol/);
  });

  it('rejects duplicate transaction identities', async () => {
    const exported = await twoTransactionReplay('frame-replay-duplicate-transaction');
    const replay: MatchRuntimeReplayExport = {
      ...exported,
      transactions: exported.transactions.map((transaction, index) => (
        index === 1
          ? { ...transaction, transactionId: exported.transactions[0].transactionId }
          : transaction
      )),
    };

    expect(() => renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST))
      .toThrow(/duplicate transactionId/);
  });

  it('rejects a frame gap across otherwise contiguous transactions', async () => {
    const exported = await twoTransactionReplay('frame-replay-frame-gap');
    const replay: MatchRuntimeReplayExport = {
      ...exported,
      transactions: exported.transactions.map((transaction, transactionIndex) => {
        if (transactionIndex !== 1) return transaction;
        return {
          ...transaction,
          framedEvents: transaction.framedEvents.map((framed, eventIndex) => (
            eventIndex === 0
              ? { ...framed, frame: asFrame(framed.frame + 1) }
              : framed
          )),
        };
      }),
    };

    expect(() => renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST))
      .toThrow(/Non-contiguous framed event/);
  });

  it('materializes TURN_STARTED as the exact step that changes the turn', async () => {
    const replay = await twoTransactionReplay('frame-replay-turn-boundary');
    const rendered = renderRuntimeReplay(replay, BOOTSTRAP_MANIFEST);
    const boundaryIndex = rendered.steps.findIndex(
      (step) => step.event?.type === 'TURN_STARTED',
    );

    expect(boundaryIndex).toBeGreaterThan(0);
    expect(rendered.steps[boundaryIndex - 1].state.turn).toBe(1);
    expect(rendered.steps[boundaryIndex].state.turn).toBe(2);
    expect(rendered.steps[boundaryIndex].scope).toEqual({ turn: 2, phase: 'START' });
    expect(rendered.steps[boundaryIndex].frame)
      .toBe(rendered.steps[boundaryIndex].framedEvent?.frame);
  });
});

import { describe, expect, test } from 'vitest';

import { BOOTSTRAP_MANIFEST } from '../../../engine';
import type { Deck } from '../../../engine/manifest/types';
import type { CardId, Seat } from '../../../engine/types/ids';
import { computeDeckContentHash, validateMatchBootstrap } from '../../bootstrapValidation';
import type { IntentEnvelope, MatchBootstrap, RuntimeIntent } from '../../contracts';
import { createMatchRuntime, type MatchRuntime } from '../../matchRuntime';

function cheapDeck(): Deck {
  return Object.values(BOOTSTRAP_MANIFEST.cards)
    .filter((card) => card.cost <= 1 && !BOOTSTRAP_MANIFEST.disabled.cards.includes(card.defId))
    .slice(0, BOOTSTRAP_MANIFEST.constants.deckSize)
    .map((card) => ({ defId: card.defId }));
}

function runtimeFixture(): MatchRuntime {
  const deck = cheapDeck();
  const bootstrap: MatchBootstrap = {
    matchId: 'phase1-contract-match',
    mode: 'CONQUEST',
    seed: 'phase1-checkpoint3-contracts',
    rulesetId: 'standard',
    manifestVersion: BOOTSTRAP_MANIFEST.version,
    viewerSeat: 'P0',
    participants: {
      P0: { participantId: 'p0', controller: 'LOCAL_HUMAN', displayName: 'P0' },
      P1: { participantId: 'p1', controller: 'LOCAL_AI', displayName: 'P1' },
    },
    decks: {
      P0: {
        deckId: 'p0-deck',
        revision: 1,
        name: 'P0 Deck',
        entries: deck,
        contentHash: computeDeckContentHash(deck),
      },
      P1: {
        deckId: 'p1-deck',
        revision: 1,
        name: 'P1 Deck',
        entries: deck,
        contentHash: computeDeckContentHash(deck),
      },
    },
  };
  const validation = validateMatchBootstrap(bootstrap, BOOTSTRAP_MANIFEST);
  if (!validation.ok) throw new Error(JSON.stringify(validation.issues));
  return createMatchRuntime(validation.value);
}

function stageEnvelope(
  runtime: MatchRuntime,
  seat: Seat,
  intentId: string,
  expectedRevision: number,
  cardId: CardId = runtime.state().hand[seat][0].id,
): IntentEnvelope {
  const intent: RuntimeIntent = { type: 'STAGE_CARD', cardId, lane: 0 };
  return {
    matchId: 'phase1-contract-match',
    seat,
    intentId,
    expectedRevision,
    intent,
  };
}

describe('Phase 1 checkpoint 3 runtime behavior contracts', () => {
  test('drains concurrently submitted work in FIFO order', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.revision();

    const first = runtime.submitIntent(stageEnvelope(runtime, 'P0', 'fifo-first', baseRevision));
    const second = runtime.submitIntent(stageEnvelope(runtime, 'P1', 'fifo-second', baseRevision + 1));

    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.status)).toEqual(['accepted', 'accepted']);
    expect(runtime.transactions().slice(-2).map((record) => record.intent.intentId)).toEqual([
      'fifo-first',
      'fifo-second',
    ]);
    expect(runtime.revision()).toBe(baseRevision + 2);
  });

  test('validates legality against authoritative state when dequeued (H2)', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.revision();
    const cardId = runtime.state().hand.P0[0].id;

    const first = runtime.submitIntent(stageEnvelope(runtime, 'P0', 'legal-first', baseRevision, cardId));
    const submittedWhileCardWasInHand = runtime.submitIntent(
      stageEnvelope(runtime, 'P0', 'illegal-at-dequeue', baseRevision + 1, cardId),
    );

    expect((await first).status).toBe('accepted');
    await expect(submittedWhileCardWasInHand).resolves.toMatchObject({
      status: 'illegal',
      intentId: 'illegal-at-dequeue',
      code: 'RULES_INVALID',
      currentRevision: baseRevision + 1,
    });
    expect(runtime.transactions().slice(-1)[0]?.intent.intentId).toBe('legal-first');
    expect(runtime.revision()).toBe(baseRevision + 1);
  });

  test('returns an idempotent duplicate receipt without a second commit (H1)', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.revision();
    const envelope = stageEnvelope(runtime, 'P0', 'retry-me', baseRevision);

    const [accepted, duplicate] = await Promise.all([
      runtime.submitIntent(envelope),
      runtime.submitIntent(envelope),
    ]);

    expect(accepted.status).toBe('accepted');
    expect(duplicate).toMatchObject({
      status: 'duplicate',
      intentId: 'retry-me',
      original: { status: 'accepted', revision: baseRevision + 1 },
    });
    expect(runtime.transactions().filter((record) => record.intent.intentId === 'retry-me')).toHaveLength(1);
    expect(runtime.revision()).toBe(baseRevision + 1);
  });

  test('applies every event in an accepted transaction exactly once', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.revision();
    const counts = new Map<string, number>();
    runtime.subscribeCommittedTransactions((timeline) => {
      timeline.frames.forEach((frame) => {
        const key = `${frame.transactionId}:${frame.index}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });

    const result = await runtime.submitIntent(
      stageEnvelope(runtime, 'P0', 'exactly-once', baseRevision),
    );
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;

    expect([...counts.values()]).toEqual(result.transaction.events.map(() => 1));
    expect(runtime.state().log.slice(-result.transaction.events.length).map((entry) => entry.event))
      .toEqual(result.transaction.events);
  });
});

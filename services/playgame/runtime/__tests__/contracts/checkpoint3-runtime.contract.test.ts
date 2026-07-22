import { describe, expect, test } from 'vitest';

import { BOOTSTRAP_MANIFEST } from '../../../engine';
import type { Deck } from '../../../engine/manifest/types';
import type { CardId, Seat } from '../../../engine/types/ids';
import { computeDeckContentHash, validateMatchBootstrap } from '../../bootstrapValidation';
import type { IntentEnvelope, MatchBootstrap, RuntimeIntent } from '../../contracts';
import { defaultLocationDeckFactory } from '../../locationDeckFactory';
import { createMatchRuntime, type MatchRuntime } from '../../matchRuntime';

function cheapDeck(): Deck {
  return Object.values(BOOTSTRAP_MANIFEST.cards)
    .filter((card) => card.cost <= 1 && !BOOTSTRAP_MANIFEST.disabled.cards.includes(card.defId))
    .slice(0, BOOTSTRAP_MANIFEST.constants.deckSize)
    .map((card) => ({ defId: card.defId }));
}

function runtimeFixture(): MatchRuntime {
  const deck = cheapDeck();
  const ruleset = BOOTSTRAP_MANIFEST.rulesets.standard;
  if (!ruleset) throw new Error('fixture requires standard ruleset');
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
        kind: 'PLAYER',
        deckId: 'p0-deck',
        revision: 1,
        name: 'P0 Deck',
        entries: deck,
        contentHash: computeDeckContentHash(deck),
      },
      P1: {
        kind: 'PLAYER',
        deckId: 'p1-deck',
        revision: 1,
        name: 'P1 Deck',
        entries: deck,
        contentHash: computeDeckContentHash(deck),
      },
      LOCATIONS: defaultLocationDeckFactory.build({
        manifest: BOOTSTRAP_MANIFEST,
        ruleset,
        seed: 'phase1-checkpoint3-contracts',
      }),
    },
  };
  const validation = validateMatchBootstrap(bootstrap, BOOTSTRAP_MANIFEST);
  if (!validation.ok) throw new Error(JSON.stringify(validation.issues));
  return createMatchRuntime({
    matchId: validation.value.matchId,
    seed: validation.value.seed,
    rulesetId: validation.value.rulesetId,
    manifestVersion: validation.value.manifestVersion,
    viewerSeat: validation.value.viewerSeat,
    controllers: {
      P0: validation.value.participants.P0.controller,
      P1: validation.value.participants.P1.controller,
    },
    decks: {
      P0: validation.value.decks.P0.entries,
      P1: validation.value.decks.P1.entries,
    },
    locationDeck: validation.value.decks.LOCATIONS.entries,
  });
}

function stageEnvelope(
  runtime: MatchRuntime,
  seat: Seat,
  intentId: string,
  expectedPublicRevision: number,
  cardId: CardId = runtime.state().hand[seat][0],
): IntentEnvelope {
  const intent: RuntimeIntent = { type: 'STAGE_CARD', cardId, lane: 0 };
  return {
    matchId: 'phase1-contract-match',
    seat,
    intentId,
    expectedPublicRevision,
    expectedPlanRevision: runtime.planRevision(seat),
    intent,
  };
}

describe('Phase 1 checkpoint 3 runtime behavior contracts', () => {
  test('drains concurrently submitted work in FIFO order', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.publicRevision();
    const initialTransactionCount = runtime.transactions().length;

    const first = runtime.submitIntent(stageEnvelope(runtime, 'P0', 'fifo-first', baseRevision));
    const second = runtime.submitIntent(stageEnvelope(runtime, 'P1', 'fifo-second', baseRevision));

    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.status)).toEqual(['accepted', 'accepted']);
    // The trusted local projection exposes only the viewer's private plan.
    expect(runtime.state().stagedPlays).toHaveLength(1);
    expect(runtime.transactions()).toHaveLength(initialTransactionCount);
    expect(runtime.publicRevision()).toBe(baseRevision);
    expect(runtime.planRevision('P0')).toBe(1);
    expect(runtime.planRevision('P1')).toBe(1);
  });

  test('validates legality against authoritative state when dequeued (H2)', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.publicRevision();
    const initialTransactionCount = runtime.transactions().length;
    const cardId = runtime.state().hand.P0[0];

    const first = runtime.submitIntent(stageEnvelope(runtime, 'P0', 'legal-first', baseRevision, cardId));
    const submittedWhileCardWasInHand = runtime.submitIntent(
      stageEnvelope(runtime, 'P0', 'illegal-at-dequeue', baseRevision, cardId),
    );

    expect((await first).status).toBe('accepted');
    await expect(submittedWhileCardWasInHand).resolves.toMatchObject({
      status: 'stale-plan',
      intentId: 'illegal-at-dequeue',
      currentPublicRevision: baseRevision,
      currentPlanRevision: 1,
    });
    expect(runtime.state().stagedPlays.map(play => play.cardId)).toEqual([cardId]);
    expect(runtime.transactions()).toHaveLength(initialTransactionCount);
    expect(runtime.publicRevision()).toBe(baseRevision);
  });

  test('returns an idempotent duplicate receipt without a second commit (H1)', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.publicRevision();
    const envelope = stageEnvelope(runtime, 'P0', 'retry-me', baseRevision);

    const [accepted, duplicate] = await Promise.all([
      runtime.submitIntent(envelope),
      runtime.submitIntent(envelope),
    ]);

    expect(accepted.status).toBe('accepted');
    expect(duplicate).toMatchObject({
      status: 'duplicate',
      intentId: 'retry-me',
      original: { status: 'accepted', publicRevision: baseRevision },
    });
    expect(runtime.transactions().filter((record) => record.intent.intentId === 'retry-me')).toHaveLength(0);
    expect(runtime.state().stagedPlays).toHaveLength(1);
    expect(runtime.publicRevision()).toBe(baseRevision);
  });

  test('applies every event in an accepted transaction exactly once', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.publicRevision();
    const counts = new Map<string, number>();
    runtime.subscribeCommittedTransactions((timeline) => {
      timeline.transitions.forEach((frame) => {
        const key = `${frame.transactionId}:${frame.index}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });

    const result = await runtime.submitIntent(
      stageEnvelope(runtime, 'P0', 'exactly-once', baseRevision),
    );
    expect(result.status).toBe('accepted');
    expect([...counts.values()]).toEqual([]);

    await runtime.submitIntent({
      matchId: 'phase1-contract-match',
      seat: 'P0',
      intentId: 'exactly-once-end',
      expectedPublicRevision: runtime.publicRevision(),
      expectedPlanRevision: runtime.planRevision('P0'),
      intent: { type: 'END_TURN' },
    });
    const committed = runtime.transactions().at(-1)!;
    expect(committed.intent.seat).toBe('SYSTEM');
    expect([...counts.values()]).toEqual(committed.frames.map(() => 1));
    expect(runtime.state().timeline.frame)
      .toBe(committed.frames.at(-1)?.frame);
  });
});

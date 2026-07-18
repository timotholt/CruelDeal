import { describe, expect, it } from 'vitest';

import { BOOTSTRAP_MANIFEST, buildEventTransactionFrames } from '../../engine';
import type { Deck } from '../../engine/manifest/types';
import type { CardId, Seat } from '../../engine/types/ids';
import { computeDeckContentHash, validateMatchBootstrap } from '../bootstrapValidation';
import type { IntentEnvelope, MatchBootstrap, ParticipantController, RuntimeIntent } from '../contracts';
import { createMatchRuntime, type MatchRuntime } from '../matchRuntime';

function cheapDeck(): Deck {
  return Object.values(BOOTSTRAP_MANIFEST.cards)
    .filter((card) => card.cost <= 1 && !BOOTSTRAP_MANIFEST.disabled.cards.includes(card.defId))
    .slice(0, BOOTSTRAP_MANIFEST.constants.deckSize)
    .map((card) => ({ defId: card.defId }));
}

function runtimeFixture(
  seed = 'phase1-checkpoint3-runtime',
  remoteController: ParticipantController = 'LOCAL_AI',
): MatchRuntime {
  const deck = cheapDeck();
  const bootstrap: MatchBootstrap = {
    matchId: 'phase1-runtime-match',
    mode: 'LADDER',
    seed,
    rulesetId: 'standard',
    manifestVersion: BOOTSTRAP_MANIFEST.version,
    viewerSeat: 'P0',
    participants: {
      P0: { participantId: 'p0', controller: 'LOCAL_HUMAN', displayName: 'P0' },
      P1: { participantId: 'p1', controller: remoteController, displayName: 'P1' },
    },
    decks: {
      P0: {
        deckId: 'p0-deck',
        revision: 2,
        name: 'P0 Deck',
        entries: deck,
        contentHash: computeDeckContentHash(deck),
      },
      P1: {
        deckId: 'p1-deck',
        revision: 3,
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
  intentId: string,
  expectedRevision = runtime.revision(),
  seat: Seat = 'P0',
  cardId: CardId = runtime.state().hand[seat][0].id,
): IntentEnvelope {
  return {
    matchId: 'phase1-runtime-match',
    seat,
    intentId,
    expectedRevision,
    intent: { type: 'STAGE_CARD', cardId, lane: 0 },
  };
}

describe('createMatchRuntime', () => {
  it('commits the symmetric opening as a system transaction over canonical genesis', () => {
    const runtime = runtimeFixture();
    const [opening] = runtime.transactions();

    expect(runtime.revision()).toBe(1);
    expect(opening.intent.seat).toBe('SYSTEM');
    expect(opening.events.filter((event) => event.type === 'CARD_DRAWN'))
      .toHaveLength(BOOTSTRAP_MANIFEST.constants.startingHandSize * 2);
    expect(opening.events.some((event) => event.type === 'LOCATION_REVEALED')).toBe(true);
    expect(runtime.genesis().hand.P0).toHaveLength(0);
    expect(runtime.genesis().hand.P1).toHaveLength(0);
    expect(runtime.state().hand.P0).toHaveLength(BOOTSTRAP_MANIFEST.constants.startingHandSize);
    expect(runtime.state().hand.P1).toHaveLength(BOOTSTRAP_MANIFEST.constants.startingHandSize);
  });

  it('keeps planning private, then publishes one complete system resolution timeline', async () => {
    const runtime = runtimeFixture();
    const baseRevision = runtime.revision();
    let publications = 0;
    runtime.subscribeCommittedTransactions((timeline) => {
      publications++;
      expect(runtime.state()).toBe(timeline.finalState);
      expect(runtime.revision()).toBe(timeline.transaction.revision);
      expect(runtime.transactions().at(-1)).toBe(timeline.transaction);
      expect(timeline.frames).toHaveLength(timeline.transaction.events.length);
      expect(timeline.frames.at(-1)?.after).toBe(timeline.finalState);
      expect(timeline.frames[0].before.lanes[1]).toBe(timeline.frames[0].after.lanes[1]);
    });

    const result = await runtime.submitIntent(stageEnvelope(runtime, 'atomic-publication'));

    expect(result).toMatchObject({ status: 'accepted', revision: baseRevision + 1, commit: 'PRIVATE' });
    expect(publications).toBe(0);
    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'atomic-end',
      expectedRevision: runtime.revision(),
      intent: { type: 'END_TURN' },
    });
    expect(publications).toBe(1);
  });

  it('returns stale, authority, match, rules, and terminal receipts without log events', async () => {
    const runtime = runtimeFixture();
    const initialRevision = runtime.revision();
    const initialLogLength = runtime.state().log.length;
    const initialTransactionCount = runtime.transactions().length;

    await expect(runtime.submitIntent({
      ...stageEnvelope(runtime, 'wrong-match'),
      matchId: 'some-other-match',
    })).resolves.toMatchObject({ status: 'illegal', code: 'MATCH_MISMATCH' });

    const spoofedIntent = {
      ...stageEnvelope(runtime, 'seat-spoof').intent,
      owner: 'P1',
    } as unknown as RuntimeIntent;
    await expect(runtime.submitIntent({
      ...stageEnvelope(runtime, 'seat-spoof'),
      intent: spoofedIntent,
    })).resolves.toMatchObject({ status: 'illegal', code: 'SEAT_AUTHORITY' });

    await expect(runtime.submitIntent(stageEnvelope(
      runtime,
      'stale',
      initialRevision - 1,
    ))).resolves.toMatchObject({
      status: 'stale',
      expectedRevision: initialRevision - 1,
      currentRevision: initialRevision,
    });

    const cardId = runtime.state().hand.P0[0].id;
    await expect(runtime.submitIntent(stageEnvelope(runtime, 'first-stage', initialRevision, 'P0', cardId)))
      .resolves.toMatchObject({ status: 'accepted' });
    const afterAcceptedRevision = runtime.revision();
    const afterAcceptedLogLength = runtime.state().log.length;
    const afterAcceptedTransactions = runtime.transactions().length;
    await expect(runtime.submitIntent(stageEnvelope(
      runtime,
      'rules-invalid',
      afterAcceptedRevision,
      'P0',
      cardId,
    ))).resolves.toMatchObject({ status: 'illegal', code: 'RULES_INVALID' });
    expect(runtime.revision()).toBe(afterAcceptedRevision);
    expect(runtime.state().log).toHaveLength(afterAcceptedLogLength);
    expect(runtime.transactions()).toHaveLength(afterAcceptedTransactions);
    expect(runtime.state().log.some(
      (entry) => (entry.event as { type?: string }).type === 'INTENT_REJECTED',
    )).toBe(false);

    const concedeRevision = runtime.revision();
    await expect(runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P1',
      intentId: 'concede',
      expectedRevision: concedeRevision,
      intent: { type: 'CONCEDE' },
    })).resolves.toMatchObject({ status: 'accepted' });
    await expect(runtime.submitIntent(stageEnvelope(
      runtime,
      'after-terminal',
      runtime.revision(),
      'P0',
    ))).resolves.toMatchObject({ status: 'illegal', code: 'TERMINAL_MATCH' });

    expect(initialLogLength).toBeGreaterThan(0);
    expect(initialTransactionCount).toBe(1);
  });

  it('returns the original rejected receipt on retry before evaluating staleness', async () => {
    const runtime = runtimeFixture();
    const envelope = stageEnvelope(runtime, 'stale-retry', runtime.revision() - 1);
    const original = await runtime.submitIntent(envelope);
    const duplicate = await runtime.submitIntent(envelope);

    expect(original).toMatchObject({ status: 'stale' });
    expect(duplicate).toMatchObject({
      status: 'duplicate',
      original: { status: 'stale' },
    });
  });

  it('refolds private Gun Store stages for latest, suffix, and full-turn undo without replay residue', async () => {
    const runtime = Array.from({ length: 256 }, (_, index) => runtimeFixture(`gun-store-planning-${index}`))
      .find((candidate) => candidate.state().lanes[0].location?.defId === 'gun-store');
    expect(runtime).toBeDefined();
    if (!runtime) return;

    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'advance-to-two-energy',
      expectedRevision: runtime.revision(),
      intent: { type: 'END_TURN' },
    });

    const turnBase = structuredClone(runtime.state());
    const transactionCount = runtime.transactions().length;
    const [firstCard, secondCard] = [...runtime.state().hand.P0].sort((a, b) =>
      BOOTSTRAP_MANIFEST.cards[a.defId].cost - BOOTSTRAP_MANIFEST.cards[b.defId].cost);
    expect(firstCard).toBeDefined();
    expect(secondCard).toBeDefined();

    await runtime.submitIntent(stageEnvelope(runtime, 'gun-store-first', runtime.revision(), 'P0', firstCard.id));
    expect(runtime.state().cards[firstCard.id].powerDelta).toBe(2);
    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'gun-store-second',
      expectedRevision: runtime.revision(),
      intent: { type: 'STAGE_CARD', cardId: secondCard.id, lane: 1 },
    });
    expect(runtime.state().stagingOrder).toEqual([firstCard.id, secondCard.id]);

    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'undo-older-suffix',
      expectedRevision: runtime.revision(),
      intent: { type: 'UNSTAGE_CARD', cardId: firstCard.id },
    });
    expect(runtime.state()).toEqual(turnBase);
    expect(runtime.transactions()).toHaveLength(transactionCount);

    await runtime.submitIntent(stageEnvelope(runtime, 'gun-store-restage', runtime.revision(), 'P0', firstCard.id));
    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'undo-full-turn',
      expectedRevision: runtime.revision(),
      intent: { type: 'UNDO_TURN' },
    });
    expect(runtime.state()).toEqual(turnBase);
    expect(runtime.transactions()).toHaveLength(transactionCount);
  });

  it('turns malformed dequeue work into a typed receipt and continues draining', async () => {
    const runtime = runtimeFixture();
    const revision = runtime.revision();
    const malformed = {
      ...stageEnvelope(runtime, 'malformed', revision),
      intent: null as unknown as RuntimeIntent,
    };

    const [rejected, accepted] = await Promise.all([
      runtime.submitIntent(malformed),
      runtime.submitIntent(stageEnvelope(runtime, 'after-malformed', revision)),
    ]);

    expect(rejected).toMatchObject({ status: 'illegal', code: 'RULES_INVALID' });
    expect(accepted).toMatchObject({ status: 'accepted', revision: revision + 1 });
    expect(runtime.state().stagingOrder).not.toHaveLength(0);
    expect(runtime.transactions()).toHaveLength(1);
  });

  it('exports bootstrap, genesis, and a non-overlapping transaction log that folds to current state', async () => {
    const runtime = runtimeFixture('phase1-runtime-replay-export');
    await runtime.submitIntent(stageEnvelope(runtime, 'replay-stage'));
    const exported = runtime.exportReplay();
    let replayed = exported.genesis;

    exported.transactions.forEach((transaction) => {
      expect(transaction.baseRevision + 1).toBe(transaction.revision);
      replayed = buildEventTransactionFrames({
        transactionId: transaction.transactionId,
        initialState: replayed,
        events: transaction.events,
        manifest: BOOTSTRAP_MANIFEST,
      }).finalState;
    });

    expect(exported.bootstrap.matchId).toBe('phase1-runtime-match');
    expect(exported.genesis.log).toHaveLength(0);
    expect(replayed).not.toEqual(runtime.state());

    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'replay-end',
      expectedRevision: runtime.revision(),
      intent: { type: 'END_TURN' },
    });
    const resolvedExport = runtime.exportReplay();
    let resolvedReplay = resolvedExport.genesis;
    for (const transaction of resolvedExport.transactions) {
      resolvedReplay = buildEventTransactionFrames({
        transactionId: transaction.transactionId,
        initialState: resolvedReplay,
        events: transaction.events,
        manifest: BOOTSTRAP_MANIFEST,
      }).finalState;
    }
    expect(resolvedReplay).toEqual(runtime.state());
  });

  it('emits the resolution-start vocabulary before a legal turn cascade', async () => {
    const runtime = runtimeFixture();
    let resolutionPhaseObserved = false;
    runtime.subscribeCommittedTransactions((timeline) => {
      const first = timeline.frames.find((frame) => frame.event.type === 'TURN_RESOLUTION_STARTED');
      if (!first) return;
      resolutionPhaseObserved = true;
      expect(first.before.phase).toBe('AWAITING_INTENT');
      expect(first.after.phase).toBe('RESOLVING');
    });

    const result = await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'end-turn',
      expectedRevision: runtime.revision(),
      intent: { type: 'END_TURN' },
    });

    expect(result.status).toBe('accepted');
    expect(resolutionPhaseObserved).toBe(true);
    expect(runtime.state().phase).toBe('AWAITING_INTENT');
  });

  it('does not resolve the first END_TURN before the other seat locks', async () => {
    const runtime = runtimeFixture('two-human-locks', 'REMOTE_PLAYER');
    const openingCount = runtime.transactions().length;
    const first = await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'p0-lock',
      expectedRevision: runtime.revision(),
      intent: { type: 'END_TURN' },
    });

    expect(first).toMatchObject({ status: 'accepted', commit: 'PRIVATE' });
    expect(runtime.transactions()).toHaveLength(openingCount);
    expect(runtime.state().phase).toBe('AWAITING_INTENT');

    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P1',
      intentId: 'p1-lock',
      expectedRevision: runtime.revision(),
      intent: { type: 'END_TURN' },
    });
    expect(runtime.transactions()).toHaveLength(openingCount + 1);
    expect(runtime.transactions().at(-1)?.intent.seat).toBe('SYSTEM');
  });
});

import { getCardCost } from '../../engine/projections/cost';
import { getAllLocationStates, getLocationState } from '../../engine/projections/locationRuntime';
import { describe, expect, it } from 'vitest';

import { BOOTSTRAP_MANIFEST, currentFrame, foldFramedEvents } from '../../engine';
import { getStoredCardPowerDelta } from '../../engine/powerLedger';
import type { Deck } from '../../engine/manifest/types';
import type { CardId, Seat } from '../../engine/types/ids';
import { computeDeckContentHash, validateMatchBootstrap } from '../bootstrapValidation';
import type { IntentEnvelope, MatchBootstrap, ParticipantController, RuntimeIntent } from '../contracts';
import { defaultLocationDeckFactory } from '../locationDeckFactory';
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
  const ruleset = BOOTSTRAP_MANIFEST.rulesets.standard;
  if (!ruleset) throw new Error('fixture requires standard ruleset');
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
        kind: 'PLAYER',
        deckId: 'p0-deck',
        revision: 2,
        name: 'P0 Deck',
        entries: deck,
        contentHash: computeDeckContentHash(deck),
      },
      P1: {
        kind: 'PLAYER',
        deckId: 'p1-deck',
        revision: 3,
        name: 'P1 Deck',
        entries: deck,
        contentHash: computeDeckContentHash(deck),
      },
      LOCATIONS: defaultLocationDeckFactory.build({
        manifest: BOOTSTRAP_MANIFEST,
        ruleset,
        seed,
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
  intentId: string,
  expectedRevision = runtime.revision(),
  seat: Seat = 'P0',
  cardId: CardId = runtime.state().hand[seat][0],
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
  it('commits canonical setup before the symmetric opening', () => {
    const runtime = runtimeFixture();
    const [setup, opening] = runtime.transactions();
    const initialization = runtime.initialization();
    const setupEvents = setup.framedEvents.map(({ event }) => event);
    const openingEvents = opening.framedEvents.map(({ event }) => event);

    expect(initialization.setup.transaction).toBe(setup);
    expect(initialization.opening.transaction).toBe(opening);
    expect(initialization.setup.finalState.activeLaneOrder).toEqual([0, 1, 2]);
    expect(initialization.setup.finalState.hand.P0).toHaveLength(0);
    expect(initialization.opening.transitions[0]?.event.type).toBe('CARD_DRAWN');
    expect(runtime.revision()).toBe(2);
    expect(setup.intent.seat).toBe('SYSTEM');
    expect(opening.intent.seat).toBe('SYSTEM');
    expect(setup.rngDrawsBefore).toBe(runtime.genesis().rng.draws);
    expect(setup.rngDrawsAfter).toBe(initialization.setup.finalState.rng.draws);
    expect(opening.rngDrawsBefore).toBe(initialization.setup.finalState.rng.draws);
    expect(opening.rngDrawsAfter).toBe(initialization.opening.finalState.rng.draws);
    expect(setupEvents[0]?.type).toBe('LOCATION_DECK_INITIALIZED');
    const initialized = setupEvents[0];
    if (initialized.type !== 'LOCATION_DECK_INITIALIZED') {
      throw new Error('setup must initialize the location deck first');
    }
    const ruleset = BOOTSTRAP_MANIFEST.rulesets.standard!;
    expect(initialized.locations.map(location => location.defId).sort()).toEqual(
      defaultLocationDeckFactory.build({
        manifest: BOOTSTRAP_MANIFEST,
        ruleset,
        seed: 'phase1-checkpoint3-runtime',
      }).entries.map(entry => entry.defId).sort(),
    );
    expect(setupEvents.filter((event) => event.type === 'LOCATION_CARD_DRAWN')).toHaveLength(3);
    expect(setupEvents.filter((event) => event.type === 'LOCATION_CARD_PLAYED')).toHaveLength(3);
    expect(setupEvents.at(-1)?.type).toBe('MATCH_SETUP_COMPLETED');
    expect(setup.framedEvents.map(({ frame }) => frame))
      .toEqual(setupEvents.map((_, index) => index + 1));
    expect(opening.framedEvents[0]?.frame).toBe(setup.framedEvents.at(-1)!.frame + 1);
    expect(setup.framedEvents.every(({ scope }) => scope.phase === 'SETUP')).toBe(true);
    expect(opening.framedEvents.every(({ scope }) => scope.phase === 'SETUP')).toBe(true);
    expect(runtime.frame()).toBe(opening.framedEvents.at(-1)?.frame);
    const openingHandSize = BOOTSTRAP_MANIFEST.constants.startingHandSize
      + BOOTSTRAP_MANIFEST.constants.turnStartDraw;
    expect(openingEvents.filter((event) => event.type === 'CARD_DRAWN'))
      .toHaveLength(openingHandSize * 2);
    expect(openingEvents.some((event) => event.type === 'LOCATION_REVEALED')).toBe(true);
    const revealIndex = openingEvents.findIndex((event) => event.type === 'LOCATION_REVEALED');
    expect(openingEvents.slice(0, revealIndex).filter((event) => event.type === 'CARD_DRAWN'))
      .toHaveLength(BOOTSTRAP_MANIFEST.constants.startingHandSize * 2);
    expect(openingEvents.slice(revealIndex + 1).filter((event) => event.type === 'CARD_DRAWN'))
      .toHaveLength(BOOTSTRAP_MANIFEST.constants.turnStartDraw * 2);
    expect(runtime.genesis().hand.P0).toHaveLength(0);
    expect(runtime.genesis().hand.P1).toHaveLength(0);
    expect(runtime.genesis().phase).toBe('SETUP');
    expect(runtime.genesis().activeLaneOrder).toEqual([]);
    expect(getAllLocationStates(runtime.genesis())).toEqual([]);
    expect(runtime.state()).toBe(initialization.opening.finalState);
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
      expect(timeline.transitions).toHaveLength(timeline.transaction.framedEvents.length);
      expect(timeline.transitions.at(-1)?.after).toBe(timeline.finalState);
      expect(timeline.transitions[0].before.lanesById[1]).toBe(timeline.transitions[0].after.lanesById[1]);
    });

    const result = await runtime.submitIntent(stageEnvelope(runtime, 'atomic-publication'));

    expect(result).toMatchObject({ status: 'accepted', revision: baseRevision + 1, commit: 'PRIVATE' });
    const committedFrameBeforeLock = runtime.frame();
    expect(currentFrame(runtime.state())).toBe(committedFrameBeforeLock);
    expect(publications).toBe(0);
    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'atomic-end',
      expectedRevision: runtime.revision(),
      intent: { type: 'END_TURN' },
    });
    expect(publications).toBe(1);
    expect(runtime.frame()).toBeGreaterThan(committedFrameBeforeLock);
  });

  it('returns stale, authority, match, rules, and terminal receipts without committed events', async () => {
    const runtime = runtimeFixture();
    const initialRevision = runtime.revision();
    const initialFrame = runtime.frame();
    const initialTransactionCount = runtime.transactions().length;
    const initialRngDraws = runtime.transactions().at(-1)!.rngDrawsAfter;

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
    expect(runtime.frame()).toBe(initialFrame);
    expect(runtime.transactions()).toHaveLength(initialTransactionCount);
    expect(runtime.transactions().at(-1)!.rngDrawsAfter).toBe(initialRngDraws);

    const cardId = runtime.state().hand.P0[0];
    await expect(runtime.submitIntent(stageEnvelope(runtime, 'first-stage', initialRevision, 'P0', cardId)))
      .resolves.toMatchObject({ status: 'accepted' });
    const afterAcceptedRevision = runtime.revision();
    const afterAcceptedFrame = runtime.frame();
    const afterAcceptedTransactions = runtime.transactions().length;
    await expect(runtime.submitIntent(stageEnvelope(
      runtime,
      'rules-invalid',
      afterAcceptedRevision,
      'P0',
      cardId,
    ))).resolves.toMatchObject({ status: 'illegal', code: 'RULES_INVALID' });
    expect(runtime.revision()).toBe(afterAcceptedRevision);
    expect(runtime.frame()).toBe(afterAcceptedFrame);
    expect(runtime.transactions()).toHaveLength(afterAcceptedTransactions);
    expect(runtime.transactions().flatMap(transaction => transaction.framedEvents)
      .some(entry => entry.event.type === 'INTENT_REJECTED')).toBe(false);

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

    expect(initialFrame).toBeGreaterThan(0);
    expect(initialTransactionCount).toBe(2);
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
      .find((candidate) => {
        const state = candidate.state();
        const id = state.lanesById[0].locationSlot.locationCardId;
        return id ? getLocationState(state, id)?.defId === 'gun-store' : false;
      });
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
    const [firstCardId, secondCardId] = [...runtime.state().hand.P0].sort((a, b) =>
      getCardCost(runtime.state(), a, BOOTSTRAP_MANIFEST)
      - getCardCost(runtime.state(), b, BOOTSTRAP_MANIFEST));
    expect(firstCardId).toBeDefined();
    expect(secondCardId).toBeDefined();

    await runtime.submitIntent(stageEnvelope(runtime, 'gun-store-first', runtime.revision(), 'P0', firstCardId));
    expect(getStoredCardPowerDelta(
      runtime.state(),
      firstCardId,
      BOOTSTRAP_MANIFEST,
    )).toBe(2);
    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'gun-store-second',
      expectedRevision: runtime.revision(),
      intent: { type: 'STAGE_CARD', cardId: secondCardId, lane: 1 },
    });
    expect(runtime.state().stagingOrder).toEqual([firstCardId, secondCardId]);

    await runtime.submitIntent({
      matchId: 'phase1-runtime-match',
      seat: 'P0',
      intentId: 'undo-older-suffix',
      expectedRevision: runtime.revision(),
      intent: { type: 'UNSTAGE_CARD', cardId: firstCardId },
    });
    expect(runtime.state()).toEqual(turnBase);
    expect(runtime.transactions()).toHaveLength(transactionCount);

    await runtime.submitIntent(stageEnvelope(runtime, 'gun-store-restage', runtime.revision(), 'P0', firstCardId));
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
    const initialTransactionCount = runtime.transactions().length;
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
    expect(runtime.transactions()).toHaveLength(initialTransactionCount);
  });

  it('rejects non-contract envelope fields before rules resolution', async () => {
    const runtime = runtimeFixture();
    const initialTransactionCount = runtime.transactions().length;
    const envelope = {
      ...stageEnvelope(runtime, 'schema-invalid-envelope'),
      clientAuthority: 'P0',
    } as unknown as IntentEnvelope;

    await expect(runtime.submitIntent(envelope)).resolves.toMatchObject({
      status: 'illegal',
      code: 'RULES_INVALID',
      message: expect.stringContaining('additional properties'),
    });
    expect(runtime.transactions()).toHaveLength(initialTransactionCount);
  });

  it('exports bootstrap, genesis, and a non-overlapping transaction log that folds to current state', async () => {
    const runtime = runtimeFixture('phase1-runtime-replay-export');
    await runtime.submitIntent(stageEnvelope(runtime, 'replay-stage'));
    const exported = runtime.exportReplay();
    expect(exported.version).toBe(3);
    let replayed = exported.genesis;

    exported.transactions.forEach((transaction) => {
      expect(transaction.baseRevision + 1).toBe(transaction.revision);
      replayed = foldFramedEvents({
        transactionId: transaction.transactionId,
        initialState: replayed,
        framedEvents: transaction.framedEvents,
        manifest: BOOTSTRAP_MANIFEST,
      }).finalState;
    });

    expect(exported.genesis.timeline).toEqual({ frame: 0, scope: null });
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
      resolvedReplay = foldFramedEvents({
        transactionId: transaction.transactionId,
        initialState: resolvedReplay,
        framedEvents: transaction.framedEvents,
        manifest: BOOTSTRAP_MANIFEST,
      }).finalState;
    }
    expect(resolvedReplay).toEqual(runtime.state());
  });

  it('emits the resolution-start vocabulary before a legal turn cascade', async () => {
    const runtime = runtimeFixture();
    let resolutionPhaseObserved = false;
    runtime.subscribeCommittedTransactions((timeline) => {
      const first = timeline.transitions.find((frame) => frame.event.type === 'TURN_RESOLUTION_STARTED');
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

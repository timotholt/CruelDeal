import { describe, expect, it } from 'vitest';

import { DEBUG_DECKS } from '../../debug/debugDecks';
import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import type { CardId, LaneId } from '../../engine/types/ids';
import { LocalMatchSessionAdapter } from '../localMatchSessionAdapter';
import { MatchSession } from '../matchSession';
import { getLaneCardsForSeat } from '../../view';
import type {
  SeatCardToken,
  SeatPresentationBlock,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '../projection';
import { seatPresentationBlockToTransactionTimeline } from '../projection';

function fixture(seed: string) {
  const session = MatchSession.fromBootstrap(buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  ));
  return {
    session,
    adapter: new LocalMatchSessionAdapter(session, { developerAccess: true }),
  };
}

function assertProjectedState(state: SeatVisibleMatchState): void {
  expect(state).not.toHaveProperty('rng');
  expect(state).not.toHaveProperty('deck');
  expect(state).not.toHaveProperty('cardsById');
  expect(state).not.toHaveProperty('pendingEffects');
  expect(state).not.toHaveProperty('powerLedger');
  expect(state).not.toHaveProperty('trackedVariables');
}

function firstAffordableToken(
  adapter: LocalMatchSessionAdapter,
): SeatCardToken {
  const snapshot = adapter.snapshot();
  const viewer = adapter.bootstrap.viewerSeat;
  const token = snapshot.state.hands[viewer].find((candidate) => {
    const card = snapshot.state.cards.find(entry => entry.token === candidate);
    return card?.cost !== undefined
      && card.cost <= snapshot.state.energy[viewer];
  });
  if (!token) throw new Error('fixture has no affordable projected card');
  return token;
}

describe('LocalMatchSessionAdapter projected authority boundary', () => {
  it('exposes canonical replay only through an authorized developer capability', () => {
    const { session } = fixture('adapter-debug-authorization');
    const player = new LocalMatchSessionAdapter(
      session,
      { developerAccess: false },
    );
    expect(player.debug).toBeNull();
    expect(player).not.toHaveProperty('replay');

    const developerSession = fixture('adapter-debug-authorized').session;
    const developer = new LocalMatchSessionAdapter(
      developerSession,
      { developerAccess: true },
    );
    const replay = developer.debug!.replay();
    const eventStep = replay.steps.find(step => step.event !== null)!;

    expect(eventStep.event).toHaveProperty('type');
    expect(eventStep).toHaveProperty('description.summary');
    expect(eventStep).toHaveProperty('annotatedEventJson');
    assertProjectedState(eventStep.state);
  });

  it('exposes transaction publication without a per-frame streaming API', () => {
    const { adapter, session } = fixture('adapter-atomic-api-surface');

    expect(adapter.subscribePresentationBlocks).toEqual(expect.any(Function));
    expect(adapter).not.toHaveProperty('subscribeCommittedTransactions');
    expect(session.runtime.subscribeCommittedTransactions).toEqual(expect.any(Function));
    expect(adapter).not.toHaveProperty('subscribeFrames');
    expect(adapter).not.toHaveProperty('subscribeFrame');
    expect(session.runtime).not.toHaveProperty('subscribeFrames');
    expect(session.runtime).not.toHaveProperty('subscribeFrame');
  });

  it('projects bootstrap, setup, and frame-by-frame opening without secrets', () => {
    const { adapter } = fixture('adapter-bootstrap');
    const serializedBootstrap = JSON.stringify(adapter.bootstrap);

    expect(serializedBootstrap).not.toContain('"seed"');
    expect(serializedBootstrap).not.toContain('"entries"');
    expect(serializedBootstrap).not.toContain('"contentHash"');
    expect(adapter.bootstrap.decks.P0.cardCount).toBe(12);
    expect(adapter.bootstrap.decks.P1.cardCount).toBe(12);

    const initialization = adapter.initialization();
    expect(initialization.setup.state.hands.P0).toHaveLength(0);
    expect(initialization.opening.frames[0]?.event?.type).toBe('CARD_DRAWN');
    expect(initialization.opening.frames.some(
      frame => frame.event?.type === 'LANE_CREATED',
    )).toBe(false);
    expect(initialization.opening.postState.hands.P0).toHaveLength(4);
    expect(initialization.opening.postState.hands.P1).toHaveLength(4);
    for (const frame of initialization.opening.frames) {
      assertProjectedState(frame.after);
      expect(frame).not.toHaveProperty('framedEvent');
      expect(frame).not.toHaveProperty('before');
    }
    const hiddenOpponentCards = initialization.opening.postState.cards.filter(
      card => card.owner !== adapter.bootstrap.viewerSeat && !card.revealed,
    );
    expect(hiddenOpponentCards.length).toBeGreaterThan(0);
    expect(hiddenOpponentCards.every(card => card.defId === undefined))
      .toBe(true);
  });

  it('accepts opaque owned tokens and rejects canonical, stale, or enemy references', async () => {
    const { adapter, session } = fixture('adapter-token-command');
    const viewer = adapter.bootstrap.viewerSeat;
    const opponent = viewer === 'P0' ? 'P1' : 'P0';
    const token = firstAffordableToken(adapter);
    const canonicalId = session.runtime.state().hand[viewer][0] as CardId;
    const opponentToken = adapter.snapshot().state.hands[opponent][0]!;

    await expect(adapter.stageCard(canonicalId, 0)).resolves.toMatchObject({
      status: 'illegal',
      code: 'RULES_INVALID',
    });
    await expect(adapter.stageCard(opponentToken, 0)).resolves.toMatchObject({
      status: 'illegal',
      code: 'RULES_INVALID',
    });

    await expect(adapter.stageCard(token, 0)).resolves.toMatchObject({
      status: 'accepted',
      commit: 'PRIVATE',
    });
    expect(adapter.snapshot().state.hands[viewer]).not.toContain(token);
    expect(adapter.snapshot().state.stagedCards).toContain(token);

    await expect(adapter.stageCard(token, 1)).resolves.toMatchObject({
      status: 'illegal',
      code: 'RULES_INVALID',
    });
    await expect(adapter.unstageCard(token)).resolves.toMatchObject({
      status: 'accepted',
      commit: 'PRIVATE',
    });
    expect(adapter.snapshot().state.hands[viewer]).toContain(token);
    expect(adapter.snapshot().state.stagedCards).not.toContain(token);
  });

  it('publishes only projected transaction frames and latest projected state', async () => {
    const { adapter } = fixture('adapter-published-frames');
    const token = firstAffordableToken(adapter);
    const blocks: SeatPresentationBlock[] = [];
    const replayStepsBeforePrivatePlan = adapter.debug!.replay().steps.length;
    const unsubscribe = adapter.subscribePresentationBlocks(
      block => blocks.push(block),
    );

    await expect(adapter.stageCard(token, 0)).resolves.toMatchObject({
      status: 'accepted',
      commit: 'PRIVATE',
    });
    expect(blocks).toEqual([]);
    expect(adapter.debug!.replay().steps).toHaveLength(replayStepsBeforePrivatePlan);
    const endTurn = await adapter.endTurn();
    expect(endTurn).toMatchObject({
      status: 'accepted',
    });
    expect(endTurn).not.toHaveProperty('transaction');

    unsubscribe();
    expect(blocks).toHaveLength(1);
    const block = blocks[0]!;
    const timeline = seatPresentationBlockToTransactionTimeline(block);
    expect(timeline.frames.length).toBeGreaterThan(0);
    expect(timeline.frames.some(
      frame => frame.event?.type === 'TURN_RESOLUTION_STARTED',
    )).toBe(true);
    expect(timeline.finalState.turn).toBe(2);
    expect(adapter.snapshot().state).toEqual(block.postState);
    for (const frame of timeline.frames) {
      assertProjectedState(frame.before);
      assertProjectedState(frame.after);
      expect(frame).not.toHaveProperty('framedEvent');
      if (frame.event) {
        expect(frame.event).not.toHaveProperty('cardId');
        expect(frame.event).not.toHaveProperty('locationId');
      }
    }
  });

  it('redelivers one complete unacknowledged block and clears it on ack', async () => {
    const { adapter } = fixture('adapter-block-resync');
    const before = adapter.snapshot();
    const blocks: SeatPresentationBlock[] = [];
    const unsubscribe = adapter.subscribePresentationBlocks(
      block => blocks.push(block),
    );

    await adapter.endTurn();
    unsubscribe();
    expect(blocks).toHaveLength(1);

    const redelivery = await adapter.resync({
      version: 2,
      matchId: adapter.bootstrap.matchId,
      viewerSeat: adapter.bootstrap.viewerSeat,
      publicRevision: before.publicRevision,
      planRevision: before.planRevision,
      frame: before.frame,
      postStateHash: null,
    });
    expect(redelivery.type).toBe('PRESENTATION_BLOCK');
    if (redelivery.type !== 'PRESENTATION_BLOCK') return;
    expect(redelivery.block.basePublicRevision).toBe(before.publicRevision);
    expect(redelivery.block.postState).toEqual(adapter.snapshot().state);

    await adapter.acknowledgePresentationBlock({
      version: 2,
      matchId: adapter.bootstrap.matchId,
      viewerSeat: adapter.bootstrap.viewerSeat,
      publicRevision: redelivery.block.publicRevision,
      frame: redelivery.block.lastFrame,
      postStateHash: redelivery.block.postStateHash,
    });

    await expect(adapter.resync({
      version: 2,
      matchId: adapter.bootstrap.matchId,
      viewerSeat: adapter.bootstrap.viewerSeat,
      publicRevision: before.publicRevision,
      planRevision: before.planRevision,
      frame: before.frame,
      postStateHash: null,
    })).resolves.toMatchObject({
      type: 'SNAPSHOT',
      snapshot: {
        publicRevision: adapter.snapshot().publicRevision,
      },
    });
  });

  it('preserves enemy staged plays in both the live timeline and replay', async () => {
    const { adapter } = fixture('bug-stage-1');
    const viewer = adapter.bootstrap.viewerSeat;
    const opponent = viewer === 'P0' ? 'P1' : 'P0';
    const blocks: SeatPresentationBlock[] = [];
    const unsubscribe = adapter.subscribePresentationBlocks(
      block => blocks.push(block),
    );

    await expect(adapter.endTurn()).resolves.toMatchObject({
      status: 'accepted',
    });
    unsubscribe();

    expect(blocks).toHaveLength(1);
    const timeline = seatPresentationBlockToTransactionTimeline(blocks[0]!);
    const enemyStage = timeline.frames.find(
      frame => frame.event?.type === 'CARD_STAGED'
        && frame.event.data.owner === opponent,
    );
    expect(enemyStage).toBeDefined();
    const token = enemyStage!.event!.data.card;
    expect(typeof token).toBe('string');
    expect(enemyStage!.before.hands[opponent]).toContain(token);
    expect(enemyStage!.after.hands[opponent]).not.toContain(token);
    expect(enemyStage!.after.stagedCards).toContain(token);
    const stagedCard = enemyStage!.after.cards.find(card => card.token === token);
    expect(stagedCard)
      .toMatchObject({ owner: opponent, zone: 'LANE', revealed: false });
    expect(stagedCard).not.toHaveProperty('defId');
    expect(enemyStage!.event!.data).not.toHaveProperty('defId');

    const committedReveal = timeline.frames.find(
      frame => frame.frame > enemyStage!.frame
        && frame.event?.type === 'CARD_REVEALED'
        && frame.event.data.card === token,
    );
    expect(committedReveal?.event?.data.defId).toEqual(expect.any(String));

    const replayStage = adapter.debug!.replay().steps.find(
      step => step.frame === enemyStage!.frame,
    );
    expect(replayStage?.event).toMatchObject({
      type: 'CARD_STAGED',
      owner: opponent,
      lane: enemyStage!.event!.data.lane,
      cardId: expect.any(String),
    });
    expect(replayStage?.description.summary).toContain('played');
    expect(replayStage?.state.stagedCards).toContain(token);
    const lane = enemyStage!.event!.data.lane;
    expect(typeof lane).toBe('number');
    expect(getLaneCardsForSeat(
      replayStage!.state,
      lane as LaneId,
      opponent,
      adapter.content,
    ).map(card => card.id)).toContain(token);
  });

  it('undo-last uses authority internally without exposing a card ID', async () => {
    const { adapter } = fixture('adapter-undo-last');
    const token = firstAffordableToken(adapter);

    await adapter.stageCard(token, 0);
    await expect(adapter.undoLastStagedCard()).resolves.toMatchObject({
      status: 'accepted',
      commit: 'PRIVATE',
    });
    await expect(adapter.undoLastStagedCard()).resolves.toMatchObject({
      status: 'illegal',
      code: 'RULES_INVALID',
    });
  });

  it('projects card history and lane power into label-only read models', async () => {
    const { adapter } = fixture('adapter-read-models');
    const viewer = adapter.bootstrap.viewerSeat;
    const opponent = viewer === 'P0' ? 'P1' : 'P0';
    const token = firstAffordableToken(adapter);
    const hiddenOpponentToken = adapter.snapshot().state.hands[opponent][0]!;

    expect(adapter.cardStatReadModel(hiddenOpponentToken)).toBeNull();
    await adapter.stageCard(token, 0);
    await adapter.endTurn();

    const card = adapter.cardStatReadModel(token);
    expect(card).toMatchObject({
      token,
      baseCost: expect.any(Number),
      effectiveCost: expect.any(Number),
    });
    expect(JSON.stringify(card)).not.toContain('sourceId');
    expect(JSON.stringify(card)).not.toContain('cardId');
    expect(JSON.stringify(card)).not.toContain('powerLedger');

    const lane = adapter.lanePowerReadModel(0, viewer);
    expect(lane).toMatchObject({
      lane: 0,
      owner: viewer,
      total: expect.any(Number),
    });
    expect(JSON.stringify(lane)).not.toContain('sourceId');
    expect(JSON.stringify(lane)).not.toContain('cardId');
    expect(adapter.lanePowerReadModel(99, viewer)).toBeNull();
  });
});

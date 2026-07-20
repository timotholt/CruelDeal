import { describe, expect, it } from 'vitest';

import { DEBUG_DECKS } from '../../debug/debugDecks';
import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import type { CardId } from '../../engine/types/ids';
import { LocalMatchSessionAdapter } from '../localMatchSessionAdapter';
import { MatchSession } from '../matchSession';
import type {
  SeatCardToken,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '../projection';

function fixture(seed: string) {
  const session = MatchSession.fromBootstrap(buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  ));
  return {
    session,
    adapter: new LocalMatchSessionAdapter(session),
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
    expect(initialization.opening.finalState.hands.P0).toHaveLength(4);
    expect(initialization.opening.finalState.hands.P1).toHaveLength(4);
    for (const frame of initialization.opening.frames) {
      assertProjectedState(frame.before);
      assertProjectedState(frame.after);
      expect(frame).not.toHaveProperty('framedEvent');
    }
    const hiddenOpponentCards = initialization.opening.finalState.cards.filter(
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
    const timelines: SeatTransactionTimeline[] = [];
    const unsubscribe = adapter.subscribeCommittedTransactions(
      timeline => timelines.push(timeline),
    );

    await expect(adapter.stageCard(token, 0)).resolves.toMatchObject({
      status: 'accepted',
    });
    const endTurn = await adapter.endTurn();
    expect(endTurn).toMatchObject({
      status: 'accepted',
    });
    expect(endTurn).not.toHaveProperty('transaction');

    unsubscribe();
    expect(timelines).toHaveLength(1);
    const timeline = timelines[0]!;
    expect(timeline.frames.length).toBeGreaterThan(0);
    expect(timeline.frames.some(
      frame => frame.event?.type === 'TURN_RESOLUTION_STARTED',
    )).toBe(true);
    expect(timeline.finalState.turn).toBe(2);
    expect(adapter.snapshot().state).toEqual(timeline.finalState);
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

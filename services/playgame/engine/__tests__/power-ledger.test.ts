import { describe, expect, it } from 'vitest';
import { foldFramedEvents, frameAndFoldEvents } from '../transactionTimeline';
import {
  activePowerContributions,
  getStoredCardPowerDelta,
  storedPowerDelta,
} from '../powerLedger';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { MatchEvent } from '../types/events';
import type { CardId } from '../types/ids';

const CARD_ID = 'ledger-card' as CardId;
const SOURCE_ID = 'ledger-source' as CardId;
const CAUSE = { sourceId: SOURCE_ID, effectKind: 'SYSTEM' } as const;
const manifest = testManifest([testCardDef('ledger-card-def', { power: 3 })]);

function initialState() {
  return buildRuntimeFixture({
    seed: 'power-ledger',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [{ id: CARD_ID, defId: 'ledger-card-def', revealed: true }], P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
}

function powerEvent(
  mutation: Extract<MatchEvent, { type: 'CARD_POWER_CHANGED' }>['mutation'],
): MatchEvent {
  return {
    type: 'CARD_POWER_CHANGED',
    cardId: CARD_ID,
    mutation,
    cause: CAUSE,
  };
}

describe('semantic power ledger', () => {
  it('folds ADD, SET, and RESET while preserving the complete immutable history', () => {
    const folded = frameAndFoldEvents({
      transactionId: 'power-ledger:semantic-fold',
      initialState: initialState(),
      events: [
        powerEvent({ kind: 'ADD', delta: 4 }),
        powerEvent({ kind: 'ADD', delta: -2 }),
        powerEvent({ kind: 'SET', value: 8 }),
        powerEvent({ kind: 'ADD', delta: -1 }),
        powerEvent({ kind: 'RESET' }),
        powerEvent({ kind: 'ADD', delta: 2 }),
      ],
      manifest,
    });
    const card = folded.finalState.cards[CARD_ID]!;

    expect(card.powerLedger).toHaveLength(6);
    expect(card.powerLedger.map((entry) => entry.mutation.kind))
      .toEqual(['ADD', 'ADD', 'SET', 'ADD', 'RESET', 'ADD']);
    expect(storedPowerDelta(card, 3)).toBe(2);
    expect(activePowerContributions(card, 3).map((entry) => entry.delta)).toEqual([2]);
    expect(card.powerLedger.map((entry) => entry.frame))
      .toEqual(folded.framedEvents.map((entry) => entry.frame));
    expect(card.powerLedger.every((entry) => entry.turn === 4)).toBe(true);
  });

  it('replays the canonical framed events into the identical ledger and result', () => {
    const live = frameAndFoldEvents({
      transactionId: 'power-ledger:live',
      initialState: initialState(),
      events: [
        powerEvent({ kind: 'ADD', delta: 4 }),
        powerEvent({ kind: 'ADD', delta: -2 }),
        powerEvent({ kind: 'SET', value: 7 }),
        powerEvent({ kind: 'RESET' }),
      ],
      manifest,
    });
    const replay = foldFramedEvents({
      transactionId: 'power-ledger:replay',
      initialState: initialState(),
      framedEvents: live.framedEvents,
      manifest,
    });

    expect(replay.finalState.cards[CARD_ID]?.powerLedger)
      .toEqual(live.finalState.cards[CARD_ID]?.powerLedger);
    expect(getStoredCardPowerDelta(replay.finalState, CARD_ID, manifest)).toBe(0);
    expect(replay.finalState).toEqual(live.finalState);
  });
});

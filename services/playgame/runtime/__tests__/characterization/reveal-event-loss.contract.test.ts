import { describe, expect, test } from 'vitest';
import type { MatchEvent } from '../../../engine/types/events';
import { planCommittedEventPacing } from '../../../presentation/committedTimeline';

function dispatchCurrentLiveRevealHandoff(
  events: readonly MatchEvent[],
  _alreadyRevealed: ReadonlySet<string>,
) {
  const pacing = planCommittedEventPacing(events);
  return {
    consumedUpTo: pacing.beforeTurnEndIndexes.length,
    dispatched: pacing.beforeTurnEndIndexes.map((index) => events[index]),
  };
}

describe('known live reveal event-loss contracts', () => {
  test('does not lose events before the first CARD_REVEALED', async () => {
    const events: MatchEvent[] = [
      { type: 'ENERGY_CHANGED', owner: 'P0', delta: 1, reason: 'EFFECT' },
      { type: 'CARD_REVEALED', cardId: 'card-1' as never, cause: { sourceId: 'card-1' as never, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } },
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, mutation: { kind: 'ADD', delta: 2 }, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL', reason: 'TEST' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = dispatchCurrentLiveRevealHandoff(events, new Set());

    expect(consumedUpTo).toBe(3);
    expect(dispatched).toEqual(events.slice(0, 3));
  });

  test('does not lose pre-TURN_ENDED events when every engine flip is already revealed in UI state', async () => {
    const events: MatchEvent[] = [
      { type: 'CARD_REVEALED', cardId: 'card-1' as never, cause: { sourceId: 'card-1' as never, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } },
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, mutation: { kind: 'ADD', delta: 2 }, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL', reason: 'TEST' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = dispatchCurrentLiveRevealHandoff(
      events,
      new Set(['card-1']),
    );

    expect(consumedUpTo).toBe(2);
    expect(dispatched).toEqual(events.slice(0, 2));
  });

  test('does not lose pre-TURN_ENDED effects when the engine emitted no flips', async () => {
    const events: MatchEvent[] = [
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, mutation: { kind: 'ADD', delta: 3 }, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL', reason: 'TEST' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = dispatchCurrentLiveRevealHandoff(
      events,
      new Set(['card-1']),
    );

    expect(consumedUpTo).toBe(1);
    expect(dispatched).toEqual(events.slice(0, 1));
  });
});

import { describe, expect, test } from 'vitest';
import type { MatchEvent } from '../../../engine/types/events';
import type { CardId } from '../../../engine/types/ids';
import { planLiveRevealHandoff } from '../../../script/liveRevealHandoff';

function dispatchCurrentLiveRevealHandoff(
  events: readonly MatchEvent[],
  alreadyRevealed: ReadonlySet<CardId>,
) {
  const handoff = planLiveRevealHandoff(
    events,
    (cardId) => alreadyRevealed.has(cardId),
  );
  const dispatched: MatchEvent[] = [];
  for (const flip of handoff.activeFlips) {
    dispatched.push({ type: 'CARD_FLIPPED', cardId: flip.cardId });
    dispatched.push(...flip.eventsAfter);
  }
  return { consumedUpTo: handoff.consumedUpTo, dispatched };
}

describe('known live reveal event-loss contracts', () => {
  test.fails('does not lose events before the first CARD_FLIPPED', async () => {
    const events: MatchEvent[] = [
      { type: 'ENERGY_CHANGED', owner: 'P0', delta: 1, reason: 'EFFECT' },
      { type: 'CARD_FLIPPED', cardId: 'card-1' as never },
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, delta: 2, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = dispatchCurrentLiveRevealHandoff(events, new Set());

    expect(consumedUpTo).toBe(3);
    expect(dispatched).toEqual(events.slice(0, 3));
  });

  test.fails('does not lose pre-TURN_ENDED events when every engine flip is already revealed in UI state', async () => {
    const events: MatchEvent[] = [
      { type: 'CARD_FLIPPED', cardId: 'card-1' as never },
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, delta: 2, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = dispatchCurrentLiveRevealHandoff(
      events,
      new Set(['card-1' as CardId]),
    );

    expect(consumedUpTo).toBe(2);
    expect(dispatched).toEqual(events.slice(0, 2));
  });

  test.fails('does not lose pre-TURN_ENDED effects when the engine emitted no flips', async () => {
    const events: MatchEvent[] = [
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, delta: 3, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = dispatchCurrentLiveRevealHandoff(
      events,
      new Set(['card-1' as CardId]),
    );

    expect(consumedUpTo).toBe(1);
    expect(dispatched).toEqual(events.slice(0, 1));
  });
});

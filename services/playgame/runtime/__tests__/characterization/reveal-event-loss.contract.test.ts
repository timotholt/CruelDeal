import { describe, expect, test } from 'vitest';
import type { MatchEvent } from '../../../engine/types/events';
import type { CardId } from '../../../engine/types/ids';

/**
 * Executable transcription of the three relevant branches in the current
 * revealByPriorityFromEngine/advanceTurnFromEngine handoff. Keeping it local
 * avoids pulling DOM animation dependencies into a runtime contract test.
 */
function runCurrentLiveRevealHandoff(
  events: readonly MatchEvent[],
  alreadyRevealed: ReadonlySet<string>,
) {
  const flippedIndices: Array<{ cardId: string; idx: number }> = [];
  let consumedUpTo = events.length;
  events.forEach((event, index) => {
    if (event.type === 'CARD_FLIPPED') flippedIndices.push({ cardId: event.cardId, idx: index });
    if (event.type === 'TURN_ENDED' && consumedUpTo === events.length) consumedUpTo = index;
  });
  const dispatched: MatchEvent[] = [];
  if (flippedIndices.length === 0) return { consumedUpTo, dispatched };
  const activeFlipped = flippedIndices.filter(({ cardId }) => !alreadyRevealed.has(cardId));
  if (activeFlipped.length === 0) return { consumedUpTo, dispatched };

  for (const { cardId, idx } of activeFlipped) {
    dispatched.push({ type: 'CARD_FLIPPED', cardId: cardId as CardId });
    const nextIdx = flippedIndices.find((flip) => flip.idx > idx)?.idx ?? consumedUpTo;
    dispatched.push(...events.slice(idx + 1, nextIdx).filter((event) => event.type !== 'CARD_FLIPPED'));
  }
  return { consumedUpTo, dispatched };
}

describe('known live reveal event-loss contracts', () => {
  test.fails('does not lose events before the first CARD_FLIPPED', async () => {
    const events: MatchEvent[] = [
      { type: 'ENERGY_CHANGED', owner: 'P0', delta: 1, reason: 'EFFECT' },
      { type: 'CARD_FLIPPED', cardId: 'card-1' as never },
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, delta: 2, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = runCurrentLiveRevealHandoff(events, new Set());

    expect(consumedUpTo).toBe(3);
    expect(dispatched).toEqual(events.slice(0, 3));
  });

  test.fails('does not lose pre-TURN_ENDED events when every engine flip is already revealed in UI state', async () => {
    const events: MatchEvent[] = [
      { type: 'CARD_FLIPPED', cardId: 'card-1' as never },
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, delta: 2, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = runCurrentLiveRevealHandoff(events, new Set(['card-1']));

    expect(consumedUpTo).toBe(2);
    expect(dispatched).toEqual(events.slice(0, 2));
  });

  test.fails('does not lose pre-TURN_ENDED effects when the engine emitted no flips', async () => {
    const events: MatchEvent[] = [
      { type: 'CARD_POWER_CHANGED', cardId: 'card-1' as never, delta: 3, cause: { sourceId: 'card-1' as never, effectKind: 'ON_REVEAL' } },
      { type: 'TURN_ENDED', turn: 2 },
    ];
    const { consumedUpTo, dispatched } = runCurrentLiveRevealHandoff(events, new Set(['card-1']));

    expect(consumedUpTo).toBe(1);
    expect(dispatched).toEqual(events.slice(0, 1));
  });
});

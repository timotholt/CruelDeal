import type { ResolvedCard } from '@/services/playgame/view';

export const selectInteractiveHand = (
  hand: readonly ResolvedCard[],
  reservedIds: ReadonlySet<string>,
): ResolvedCard[] => hand.filter((card) => !reservedIds.has(card.id));

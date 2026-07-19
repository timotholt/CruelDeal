import type {
  CardBoardPosition,
  CardPositionCriteria,
} from '../types/cardPosition';
import type { CardInstance, MatchState } from '../types/state';

const arrayOrOne = <T>(value: T | readonly T[]): readonly T[] =>
  Array.isArray(value) ? value as readonly T[] : [value as T];

/** Resolve a live lane card's owner-relative 2×2 position. */
export function getCardBoardPosition(
  card: CardInstance,
  state: MatchState,
): CardBoardPosition | null {
  if (card.zone !== 'LANE' || card.lane === null) return null;
  const lane = state.lanesById[card.lane];
  if (!lane) return null;

  const index = lane.cards[card.owner].indexOf(card.id);
  if (index < 0 || index > 3) return null;

  const slot = index + 1 as CardBoardPosition['slot'];
  return {
    slot,
    row: (Math.floor(index / 2) + 1) as CardBoardPosition['row'],
    column: ((index % 2) + 1) as CardBoardPosition['column'],
  };
}

export function matchesCardPosition(
  card: CardInstance,
  state: MatchState,
  criteria: CardPositionCriteria,
): boolean {
  const position = getCardBoardPosition(card, state);
  if (!position) return false;

  if (criteria.slot !== undefined &&
      !arrayOrOne(criteria.slot).includes(position.slot)) return false;
  if (criteria.row !== undefined &&
      !arrayOrOne(criteria.row).includes(position.row)) return false;
  if (criteria.column !== undefined &&
      !arrayOrOne(criteria.column).includes(position.column)) return false;

  return true;
}

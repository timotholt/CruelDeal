import type {
  CardLifecycleState,
  CardStatusKind,
  CardTag,
} from '../types/state';

export interface CardStatusSource {
  readonly tags: readonly CardTag[];
  readonly lifecycle: CardLifecycleState;
}

/**
 * Read authored card status without conflating engine lifecycle with mutable
 * card metadata. HAS_TAG remains a stable DSL surface while lifecycle markers
 * are derived from their canonical indexes.
 */
export function hasCardStatus(
  card: CardStatusSource,
  status: CardStatusKind | string,
  currentTurn: number,
): boolean {
  switch (status) {
    case 'PLAYED_THIS_TURN':
      return card.lifecycle.turnPlayed === currentTurn;
    case 'MOVED_THIS_TURN':
      return card.lifecycle.turnLastMoved === currentTurn;
    case 'DESTROYED_THIS_TURN':
      return card.lifecycle.turnDestroyed === currentTurn;
    case 'EVER_MOVED':
      return card.lifecycle.frameLastMoved !== undefined
        || card.lifecycle.turnLastMoved !== undefined;
    default:
      return card.tags.some(tag => tag.kind === status);
  }
}

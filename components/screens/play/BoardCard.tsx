/**
 * BoardCard — a card sitting in a lane slot.
 *
 * Face-down logic: unrevealed remote cards are always face-down. Unrevealed
 * local cards in the current staging order stay face-up while planning, then
 * the presentation lock turns them face-down before the reveal walk. Older
 * delayed cards remain face-down after their staging order is cleared.
 */

import { useVfx } from '../../game/VfxHost';
import { useMatchSession } from '@/contexts/MatchSessionContext';
import { usePlayUi } from '@/contexts/PlayUiContext';
import type { ResolvedCard } from '@/services/playgame/view';
import type { Seat } from '@/services/playgame/engine/types/ids';
import { isBoardCardFaceDown } from '@/services/playgame/presentation/cardFacing';
import { CardFace } from './CardFace';

interface BoardCardProps {
  card: ResolvedCard;
  side: 'top' | 'bottom';
  laneIdx: number;
  interactive?: boolean;
  inspectable?: boolean;
  viewerSeat?: Seat;
  stagedCardIds?: readonly string[];
  resolutionLocked?: boolean;
}

export const BoardCard = (props: BoardCardProps) => {
  const match = useMatchSession();
  const { ui, presentedState, isResolving, actions } = usePlayUi();
  const { bindCardRef, cardVfxRegistry } = useVfx();
  const viewerSeat = (): Seat => props.viewerSeat ?? match.localSeat;

  const stagedCardIds = (): readonly string[] =>
    props.stagedCardIds ?? presentedState().stagedCards;
  const interactive = (): boolean => props.interactive ?? true;
  const inspectable = (): boolean => props.inspectable ?? interactive();

  /**
   * True if this is a player card that was staged THIS turn and can still
   * be dragged back to hand. We key off `stagedCardIds` (the engine's source
   * of truth) rather than `revealed` to avoid a false positive on the first
   * frame after TURN_STARTED.
   */
  const isDraggablePending = (): boolean => {
    if (!interactive()) return false;
    if (props.side !== 'bottom') return false;
    if (props.card.owner !== viewerSeat()) return false;
    if (isResolving()) return false;
    return stagedCardIds().includes(props.card.id);
  };

  const isFaceDown = (): boolean => {
    return isBoardCardFaceDown({
      cardId: props.card.id,
      owner: props.card.owner,
      viewerSeat: viewerSeat(),
      revealed: props.card.revealed,
      stagedCardIds: stagedCardIds(),
      resolutionLocked: props.resolutionLocked ?? ui.isFlipped,
    });
  };
  const isPending = isFaceDown;

  // Deterministic tilt per id so cards don't jitter between re-renders.
  const tilt = (): string => {
    let h = 0;
    for (let i = 0; i < props.card.id.length; i++) {
      h = ((h << 5) - h + props.card.id.charCodeAt(i)) | 0;
    }
    const direction = h % 2 === 0 ? 1 : -1;
    const magnitude = 0.1 + (Math.abs(h) % 10) / 10;
    return (direction * magnitude).toFixed(1) + 'deg';
  };

  const onClick = (e: MouseEvent): void => {
    if (!inspectable()) return;
    if (isFaceDown()) return;
    e.stopPropagation();
    actions.openInspector({
      kind: 'card',
      card: props.card,
      zone: 'board',
      side: props.side,
      laneIdx: props.laneIdx,
      element: e.currentTarget as HTMLElement,
    });
  };

  return (
    <div
      ref={bindCardRef(props.card.id)}
      class={
        'card lane-card' +
        (props.side === 'top' ? ' enemy' : '') +
        (isFaceDown() ? ' facedown' : '') +
        (isPending() ? ' pending' : '') +
        (isDraggablePending() ? ' undoable' : '') +
        (props.card.textDisabled ? ' text-disabled' : '')
      }
      data-card-id={props.card.id}
      data-card-type={props.card.type}
      data-card-resting-rotation={tilt()}
      data-drag-source="lane"
      data-drag-enabled={String(isDraggablePending())}
      role={isDraggablePending() ? 'button' : undefined}
      tabIndex={isDraggablePending() ? 0 : undefined}
      aria-label={isDraggablePending() ? `Select ${props.card.name} to return to hand` : undefined}
      aria-pressed={isDraggablePending() ? 'false' : undefined}
      style={{
        '--card-tilt': tilt(),
        cursor: isDraggablePending() ? 'grab' : isFaceDown() ? 'default' : 'pointer',
      }}
      onClick={onClick}
    >
      <CardFace card={props.card} variant="play" vfxRegistry={cardVfxRegistry} />
    </div>
  );
};

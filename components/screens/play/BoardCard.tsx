/**
 * BoardCard — a card sitting in a lane slot.
 *
 * Face-down logic: unrevealed remote cards are always face-down; unrevealed
 * local cards are face-down only during resolution (ui.isFlipped = true),
 * so the Snap UX (your cards show face-up while staging) stays intact.
 */

import { useVfx } from '../../game/VfxHost';
import { usePlayGame } from '@/contexts/PlayGameContext';
import type { ResolvedCard } from '@/services/playgame/view';
import { openInspect } from './inspector';
import { dragState } from './useDragDrop';

interface BoardCardProps {
  card: ResolvedCard;
  side: 'top' | 'bottom';
  laneIdx: number;
}

export const BoardCard = (props: BoardCardProps) => {
  const { ui, engineState, isResolving, localSeat } = usePlayGame();
  const { bindCardRef } = useVfx();

  /**
   * True if this is a player card that was staged THIS turn and can still
   * be dragged back to hand. We key off `stagingOrder` (the engine's source
   * of truth) rather than `revealed` to avoid a false positive on the first
   * frame after TURN_STARTED.
   */
  const isDraggablePending = (): boolean => {
    if (props.side !== 'bottom') return false;
    if (props.card.owner !== localSeat) return false;
    if (isResolving()) return false;
    return engineState.stagingOrder.includes(props.card.id as never);
  };

  const onDragStart = (e: DragEvent): void => {
    if (!isDraggablePending()) {
      e.preventDefault();
      return;
    }
    dragState.id = props.card.id;
    e.dataTransfer?.setData('text/plain', props.card.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };
  const onDragEnd = (): void => {
    dragState.id = null;
  };

  const isFaceDown = (): boolean => {
    if (props.card.revealed) return false;
    if (props.card.owner !== localSeat) return true;
    return ui.isFlipped;
  };
  const isPending = isFaceDown;

  const powerClass = (): string => {
    const c = props.card;
    if (c.power > c.basePower) return 'buffed';
    if (c.power < c.basePower) return 'debuffed';
    return '';
  };

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
    if (isFaceDown()) return;
    e.stopPropagation();
    openInspect({
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
        'card' +
        (props.side === 'top' ? ' enemy' : '') +
        (isFaceDown() ? ' facedown' : '') +
        (isPending() ? ' pending' : '') +
        (isDraggablePending() ? ' undoable' : '')
      }
      data-card-id={props.card.id}
      draggable={isDraggablePending()}
      style={{
        '--card-tilt': tilt(),
        cursor: isDraggablePending() ? 'grab' : isFaceDown() ? 'default' : 'pointer',
      }}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div class="cost">{props.card.cost}</div>
      <div class={'power ' + powerClass()}>{props.card.power}</div>
      {props.card.portraitPath
        ? <img class="portrait" src={props.card.portraitPath} alt="" aria-hidden="true" />
        : <div class="bar" style={{ background: props.card.art }} />
      }
      <div class="name">{props.card.name}</div>
      <div class="type">{props.card.type}</div>
    </div>
  );
};

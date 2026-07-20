/**
 * BoardCard — a card sitting in a lane slot.
 *
 * Face-down logic: unrevealed remote cards are always face-down. Unrevealed
 * local cards in the current staging order stay face-up while planning, then
 * the presentation lock turns them face-down before the reveal walk. Older
 * delayed cards remain face-down after their staging order is cleared.
 */

import { createEffect } from 'solid-js';
import { useVfx } from '../../game/VfxHost';
import { usePlayGame } from '@/contexts/PlayGameContext';
import type { ResolvedCard } from '@/services/playgame/view';
import type { CardId, Seat } from '@/services/playgame/engine/types/ids';
import { openInspect } from './inspector';
import { CardVfxStack } from '../../card/CardVfxStack';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';
import { isBoardCardFaceDown } from '@/services/playgame/presentation/cardFacing';

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
  const { ui, engineState, isResolving, localSeat } = usePlayGame();
  const { bindCardRef } = useVfx();
  const viewerSeat = (): Seat => props.viewerSeat ?? localSeat;

  const cardId = () => props.card.id as CardId;

  createEffect(() => {
    const sources = props.card.textDisabled
      ? [{ id: `${props.card.id}-glitch`, sourceId: props.card.id, kind: 'glitch' as const, intensity: 1, priority: 5 }]
      : [];
    cardVfxRegistry.reconcilePersistent(cardId(), sources);
  });
  const stagedCardIds = (): readonly string[] =>
    props.stagedCardIds
    ?? engineState().stagedPlays.map(staged => staged.cardId);
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
    if (!inspectable()) return;
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
        'card lane-card' +
        (props.side === 'top' ? ' enemy' : '') +
        (isFaceDown() ? ' facedown' : '') +
        (isPending() ? ' pending' : '') +
        (isDraggablePending() ? ' undoable' : '') +
        (props.card.textDisabled ? ' text-disabled' : '')
      }
      data-card-id={props.card.id}
      data-card-resting-rotation={tilt()}
      data-drag-source="lane"
      data-drag-enabled={String(isDraggablePending())}
      style={{
        '--card-tilt': tilt(),
        cursor: isDraggablePending() ? 'grab' : isFaceDown() ? 'default' : 'pointer',
      }}
      onClick={onClick}
    >
      <CardVfxStack cardId={cardId()}>
        <div class="cost">{props.card.cost}</div>
        {props.card.type !== 'spell'
          ? <div class={'power ' + powerClass()}>{props.card.power}</div>
          : null}
        {props.card.portraitPath
          ? <img class="portrait" src={props.card.portraitPath} alt="" aria-hidden="true" />
          : <div class="bar" style={{ background: props.card.art }} />
        }
        <div class="name">{props.card.name}</div>
        <div class="type">{props.card.type}</div>
        {props.card.textDisabled ? <div class="text-disabled-mark" aria-hidden="true" /> : null}
      </CardVfxStack>
    </div>
  );
};

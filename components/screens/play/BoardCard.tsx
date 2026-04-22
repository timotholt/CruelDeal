/**
 * BoardCard — a card sitting in a lane slot.
 *
 * Face-down logic: unrevealed enemy cards are always face-down; unrevealed
 * player cards are face-down only during resolution (ui.isFlipped = true),
 * so the Snap UX (your cards show face-up while staging) stays intact.
 */

import { useVfx } from '../../game/VfxHost';
import { usePlayGame } from '@/contexts/PlayGameContext';
import type { ResolvedCard } from '@/services/playgame/view';
import { openInspect } from './inspector';

interface BoardCardProps {
  card: ResolvedCard;
  enemy?: boolean;
  side: 'player' | 'enemy';
  laneIdx: number;
}

export const BoardCard = (props: BoardCardProps) => {
  const { ui } = usePlayGame();
  const { bindCardRef } = useVfx();

  const isFaceDown = (): boolean => {
    if (props.card.revealed) return false;
    if (props.card.owner === 'OPP') return true;
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
        (props.enemy ? ' enemy' : '') +
        (isFaceDown() ? ' facedown' : '') +
        (isPending() ? ' pending' : '')
      }
      data-card-id={props.card.id}
      style={{ '--card-tilt': tilt(), cursor: isFaceDown() ? 'default' : 'pointer' }}
      onClick={onClick}
    >
      <div class="cost">{props.card.cost}</div>
      <div class={'power ' + powerClass()}>{props.card.power}</div>
      <div class="bar" style={{ background: props.card.art }} />
      <div class="name">{props.card.name}</div>
      <div class="type">{props.card.type}</div>
    </div>
  );
};

/**
 * HandCard — a card sitting in the player's hand row.
 *
 * Same DOM as BoardCard minus the tilt/placement, plus an opacity dim when
 * unplayable (cost > current energy). Draggable; clicking opens the zoom
 * inspector.
 *
 * Lives in its own module so UX tweaks (hover, cursor, tooltip) can be
 * iterated without touching engine-coupled files.
 */

import { useVfx } from '../../game/VfxHost';
import type { ResolvedCard } from '@/services/playgame/view';
import { dragState } from './useDragDrop';
import { openInspect } from './inspector';

interface HandCardProps {
  card: ResolvedCard;
  playable: boolean;
  interactive?: boolean;
}

export const HandCard = (props: HandCardProps) => {
  const { bindCardRef } = useVfx();

  const powerClass = (): string => {
    const c = props.card;
    if (c.power > c.basePower) return 'buffed';
    if (c.power < c.basePower) return 'debuffed';
    return '';
  };

  const onDragStart = (e: DragEvent): void => {
    if (props.interactive === false) {
      e.preventDefault();
      return;
    }
    dragState.id = props.card.id;
    (e.currentTarget as HTMLElement).classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', props.card.id);
    }
  };
  const onDragEnd = (e: DragEvent): void => {
    (e.currentTarget as HTMLElement).classList.remove('dragging');
    dragState.id = null;
  };
  const onClick = (e: MouseEvent): void => {
    e.stopPropagation();
    openInspect({
      kind: 'card',
      card: props.card,
      zone: 'hand',
      side: 'local',
      element: e.currentTarget as HTMLElement,
    });
  };

  return (
    <div
      ref={bindCardRef(props.card.id)}
      class="card"
      data-card-id={props.card.id}
      // NOTE: the `transition` list MUST include the CSS hover properties
      // (transform, box-shadow, border-color) or the inline `transition`
      // shorthand wipes the :hover animation defined in playgame.css.
      style={{
        opacity: props.playable ? 1 : 0.5,
        cursor: 'pointer',
        transition: 'opacity 0.5s ease, transform 0.15s, box-shadow 0.15s, border-color 0.15s',
      }}
      draggable={props.interactive !== false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
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

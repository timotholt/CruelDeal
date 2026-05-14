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

import { createEffect } from 'solid-js';
import { useVfx } from '../../game/VfxHost';
import type { ResolvedCard } from '@/services/playgame/view';
import { dragState } from './useDragDrop';
import { openInspect } from './inspector';
import { CardVfxStack } from '../../card/CardVfxStack';
import type { CardId } from '@/services/playgame/engine/types/ids';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';

interface HandCardProps {
  card: ResolvedCard;
  playable: boolean;
  interactive?: boolean;
  hidden?: boolean;
}

export const HandCard = (props: HandCardProps) => {
  const { bindCardRef } = useVfx();
  const cardId = () => props.card.id as CardId;

  createEffect(() => {
    const sources = props.card.textDisabled
      ? [{ id: `${props.card.id}-glitch`, sourceId: props.card.id, kind: 'glitch' as const, intensity: 1, priority: 5 }]
      : [];
    cardVfxRegistry.reconcilePersistent(cardId(), sources);
  });

  const powerClass = (): string => {
    const c = props.card;
    if (c.power > c.basePower) return 'buffed';
    if (c.power < c.basePower) return 'debuffed';
    return '';
  };

  const onDragStart = (e: DragEvent): void => {
    if (props.interactive === false || props.hidden) {
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
    if (props.interactive === false || props.hidden) return;
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
      class={'hand-card-motion' + (props.hidden ? ' hand-card-motion--reserved' : '')}
      data-card-id={props.card.id}
      style={{
        visibility: props.hidden ? 'hidden' : 'visible',
        'pointer-events': props.hidden ? 'none' : 'auto',
        cursor: props.interactive === false || props.hidden ? 'default' : 'pointer',
      }}
      draggable={props.interactive !== false && !props.hidden}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div
        class={'card' + (props.card.textDisabled ? ' text-disabled' : '')}
        // NOTE: the `transition` list MUST include the CSS hover properties
        // (transform, box-shadow, border-color) or the inline `transition`
        // shorthand wipes the :hover animation defined in playgame.css.
        style={{
          opacity: props.playable ? 1 : 0.5,
          cursor: props.interactive === false || props.hidden ? 'default' : 'pointer',
          transition: 'opacity 0.5s ease, transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        }}
      >
        <CardVfxStack cardId={props.card.id as CardId}>
          <div class="cost">{props.card.cost}</div>
          <div class={'power ' + powerClass()}>{props.card.power}</div>
          {props.card.portraitPath
            ? <img class="portrait" src={props.card.portraitPath} alt="" aria-hidden="true" />
            : <div class="bar" style={{ background: props.card.art }} />
          }
          <div class="name">{props.card.name}</div>
          <div class="type">{props.card.type}</div>
          {props.card.textDisabled ? <div class="text-disabled-mark" aria-hidden="true" /> : null}
        </CardVfxStack>
      </div>
    </div>
  );
};

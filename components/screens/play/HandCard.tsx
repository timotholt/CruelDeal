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

import { createEffect, createMemo } from 'solid-js';
import { CardVfxStack } from '@/components/card/CardVfxStack';
import { useVfx } from '../../game/VfxHost';
import { usePlayUi } from '@/contexts/PlayUiContext';
import type { ResolvedCard } from '@/services/playgame/view';
import { cardSurfaceModel } from '@/services/playgame/presentation/appearance';
import { CardRenderer } from './rendering/CardRenderer';

interface HandCardProps {
  card: ResolvedCard;
  playable: boolean;
  interactive?: boolean;
  inspectable?: boolean;
  hidden?: boolean;
}

export const HandCard = (props: HandCardProps) => {
  const { bindCardRef, cardVfxRegistry } = useVfx();
  const { actions } = usePlayUi();
  const isHidden = createMemo(() => Boolean(props.hidden));
  const isInteractive = createMemo(() => props.interactive !== false && !isHidden());
  const isInspectable = createMemo(() => props.inspectable !== false && !isHidden());
  const isPlayable = createMemo(() => isInteractive() && props.playable);
  const surfaceModel = createMemo(() => cardSurfaceModel(props.card));

  createEffect(() => {
    cardVfxRegistry.reconcilePersistent(props.card.id, props.card.textDisabled ? [{
      id: `${props.card.id}-glitch`,
      sourceId: props.card.id,
      kind: 'glitch',
      intensity: 1,
      priority: 5,
    }] : []);
  });

  const onClick = (e: MouseEvent): void => {
    if (!isInspectable()) return;
    e.stopPropagation();
    actions.openInspector({
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
      class={'hand-card-motion' + (isHidden() ? ' hand-card-motion--reserved' : '')}
      data-card-id={props.card.id}
      data-drag-source="hand"
      data-drag-enabled={String(isPlayable())}
      style={{
        visibility: isHidden() ? 'hidden' : 'visible',
        'pointer-events': isHidden() ? 'none' : 'auto',
        cursor: isInspectable() ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div
        class={'card' + (props.card.textDisabled ? ' text-disabled' : '')}
        data-card-type={props.card.type}
        style={{
          opacity: props.playable ? 1 : 0.5,
          cursor: isInspectable() ? 'pointer' : 'default',
        }}
      >
        <CardVfxStack cardId={props.card.id} registry={cardVfxRegistry}>
          <CardRenderer model={surfaceModel()} />
        </CardVfxStack>
      </div>
    </div>
  );
};

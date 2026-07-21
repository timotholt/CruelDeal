import { createEffect, createMemo, Show, type JSX } from 'solid-js';

import { CardVfxStack } from '@/components/card/CardVfxStack';
import type { ResolvedCard } from '@/services/playgame/view';
import type { CardVfxRegistry } from '@/services/vfx/card-effects/types';
import { RegularCardFace } from '../card-faces/RegularCardFace';
import { SpellCardFace } from '../card-faces/SpellCardFace';
import { resolveCardRenderPlan } from './renderCache';

interface CardRendererProps {
  readonly card: ResolvedCard;
  readonly vfxRegistry?: CardVfxRegistry;
}

/**
 * The only play-card painter. It always lays out at the inspector-sized
 * 500x700 coordinate system; the SVG viewport scales that finished visual for
 * hand, lane, pile, inspector, and motion surfaces without relaying out text.
 */
export const CardRenderer = (props: CardRendererProps): JSX.Element => {
  const model = createMemo(() => resolveCardRenderPlan(props.card));

  createEffect(() => {
    const registry = props.vfxRegistry;
    if (!registry) return;
    const card = model();
    registry.reconcilePersistent(props.card.id, card.textDisabled ? [{
      id: `${props.card.id}-glitch`,
      sourceId: props.card.id,
      kind: 'glitch' as const,
      intensity: 1,
      priority: 5,
    }] : []);
  });

  const face = () => model().type === 'spell'
    ? <SpellCardFace card={model()} />
    : <RegularCardFace card={model()} />;

  const contents = () => (
    <Show when={props.vfxRegistry} keyed fallback={face()}>
      {(registry) => (
        <CardVfxStack cardId={props.card.id} registry={registry}>
          {face()}
        </CardVfxStack>
      )}
    </Show>
  );

  return (
    <svg
      class="card-renderer"
      viewBox="0 0 500 700"
      preserveAspectRatio="none"
      overflow="visible"
      data-card-render-key={model().key}
    >
      <foreignObject x="0" y="0" width="500" height="700" overflow="visible">
        <div class="card-renderer__canvas" data-card-type={model().type}>
          {contents()}
        </div>
      </foreignObject>
    </svg>
  );
};

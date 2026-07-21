import { createEffect, createMemo, Show, type JSX } from 'solid-js';

import { CardVfxStack } from '@/components/card/CardVfxStack';
import type { ResolvedCard } from '@/services/playgame/view';
import type { CardVfxRegistry } from '@/services/vfx/card-effects/types';
import { RegularCardFace } from './card-faces/RegularCardFace';
import { SpellCardFace } from './card-faces/SpellCardFace';
import { toCardFaceModel } from './card-faces/cardFaceModel';

type CardFaceProps =
  | {
      readonly card: ResolvedCard;
      readonly variant: 'play';
      readonly vfxRegistry: CardVfxRegistry;
    }
  | {
      readonly card: ResolvedCard;
      readonly variant: 'pile';
    };

export const CardFace = (props: CardFaceProps): JSX.Element => {
  const model = createMemo(() => toCardFaceModel(props.card));

  createEffect(() => {
    if (props.variant !== 'play') return;
    const registry = props.vfxRegistry;
    const card = model();
    const sources = card.textDisabled
      ? [
          {
            id: `${card.id}-glitch`,
            sourceId: card.id,
            kind: 'glitch' as const,
            intensity: 1,
            priority: 5,
          },
        ]
      : [];
    registry.reconcilePersistent(card.id, sources);
  });

  const renderedFace = () => model().type === 'spell'
    ? <SpellCardFace card={model()} variant={props.variant} />
    : <RegularCardFace card={model()} variant={props.variant} />;
  const playRegistry = () => props.variant === 'play' ? props.vfxRegistry : null;

  return (
    <Show when={playRegistry()} keyed fallback={renderedFace()}>
      {(registry) => (
        <CardVfxStack cardId={model().id} registry={registry}>
          {renderedFace()}
        </CardVfxStack>
      )}
    </Show>
  );
};

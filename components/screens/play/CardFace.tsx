import { Show, createEffect, createMemo, type JSX } from 'solid-js';

import { CardVfxStack } from '@/components/card/CardVfxStack';
import { cardStatTone, type ResolvedCard } from '@/services/playgame/view';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';

interface CardFaceProps {
  readonly card: ResolvedCard;
  readonly variant: 'play' | 'pile';
}

interface CardFaceModel {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly cost: number;
  readonly power: number;
  readonly showPower: boolean;
  readonly portraitPath: string | null;
  readonly art: string;
  readonly textDisabled: boolean;
  readonly costTone: string;
  readonly powerTone: string;
}

const toCardFaceModel = (card: ResolvedCard): CardFaceModel => ({
  id: card.id,
  name: card.name,
  type: card.type,
  cost: card.cost,
  power: card.power,
  showPower: card.type !== 'spell',
  portraitPath: card.portraitPath,
  art: card.art,
  textDisabled: card.textDisabled,
  costTone: cardStatTone(card, 'cost'),
  powerTone: cardStatTone(card, 'power'),
});

export const CardFace = (props: CardFaceProps): JSX.Element => {
  const model = createMemo(() => toCardFaceModel(props.card));

  createEffect(() => {
    if (props.variant !== 'play') return;
    const card = model();
    const sources = card.textDisabled
      ? [{
          id: `${card.id}-glitch`,
          sourceId: card.id,
          kind: 'glitch' as const,
          intensity: 1,
          priority: 5,
        }]
      : [];
    cardVfxRegistry.reconcilePersistent(card.id, sources);
  });

  const playFace = () => {
    const card = model();
    return (
      <CardVfxStack cardId={card.id}>
        <div class={'cost ' + card.costTone}>{card.cost}</div>
        {card.showPower
          ? <div class={'power ' + card.powerTone}>{card.power}</div>
          : null}
        {card.portraitPath
          ? <img class="portrait" src={card.portraitPath} alt="" aria-hidden="true" />
          : <div class="bar" style={{ background: card.art }} />}
        <div class="name">{card.name}</div>
        <div class="type">{card.type}</div>
        {card.textDisabled ? <div class="text-disabled-mark" aria-hidden="true" /> : null}
      </CardVfxStack>
    );
  };

  const pileFace = () => {
    const card = model();
    return (
      <div class="pile-card" data-card-type={card.type}>
        <div class="pile-card__badges">
          <span class="pile-card__cost">{card.cost}</span>
          {card.showPower
            ? <span class="pile-card__power">{card.power}</span>
            : null}
        </div>
        <div class="pile-card__name">{card.name}</div>
        <div class="pile-card__type">{card.type}</div>
      </div>
    );
  };

  return (
    <Show when={props.variant === 'play'} fallback={pileFace()}>
      {playFace()}
    </Show>
  );
};

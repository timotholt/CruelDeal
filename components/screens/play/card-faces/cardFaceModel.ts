import { cardStatTone, type ResolvedCard } from '@/services/playgame/view';
import type { CardDomain } from '@/services/playgame/engine/manifest/types';

export interface CardFaceModel {
  readonly id: string;
  readonly name: string;
  readonly type: CardDomain | '';
  readonly cost: number;
  readonly power: number;
  readonly portraitPath: string | null;
  readonly art: string;
  readonly textDisabled: boolean;
  readonly costTone: string;
  readonly powerTone: string;
}

export const toCardFaceModel = (card: ResolvedCard): CardFaceModel => ({
  id: card.id,
  name: card.name,
  type: card.type,
  cost: card.cost,
  power: card.power,
  portraitPath: card.portraitPath,
  art: card.art,
  textDisabled: card.textDisabled,
  costTone: cardStatTone(card, 'cost'),
  powerTone: cardStatTone(card, 'power'),
});

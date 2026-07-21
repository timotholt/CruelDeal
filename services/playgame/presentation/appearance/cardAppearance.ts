import type {
  CardContentSpec,
  CardSurfaceModel,
  StatVisual,
  VisualColor,
} from '@/components/game-surfaces/contracts';
import { cardStatTone, type ResolvedCard } from '@/services/playgame/view';
import { visualKey } from './visualKey';

const CARD_CONTENT_REVISION = 'card-content-v1';
const CARD_CHROME_REVISION = 'card-chrome-v1';

export interface CardAppearanceOptions {
  readonly face?: 'front' | 'back';
  readonly borderTone?: 'neutral' | 'friendly' | 'enemy';
}

const contentSpec = (card: ResolvedCard): CardContentSpec => {
  const layout = card.type === 'spell' ? 'spell' : 'regular';
  const artwork = card.portraitPath
    ? { src: card.portraitPath, revision: card.portraitPath }
    : null;
  const fields = [layout, card.name, card.text, artwork, card.art];
  return Object.freeze({
    cacheKey: visualKey('card', CARD_CONTENT_REVISION, fields),
    layout,
    name: card.name,
    rulesText: card.text,
    artwork,
    accent: card.art as VisualColor,
    contentRevision: CARD_CONTENT_REVISION,
  });
};

const stat = (card: ResolvedCard, kind: 'cost' | 'power'): StatVisual => Object.freeze({
  value: kind === 'cost' ? card.cost : card.power,
  tone: cardStatTone(card, kind),
});

export const cardSurfaceModel = (
  card: ResolvedCard,
  options: CardAppearanceOptions = {},
): CardSurfaceModel => {
  const requestedFace = options.face ?? (card.defId ? 'front' : 'back');
  const front = requestedFace === 'front' && card.defId !== null;
  return Object.freeze({
    kind: 'card' as const,
    face: front
      ? Object.freeze({ kind: 'front' as const, content: contentSpec(card) })
      : Object.freeze({ kind: 'back' as const, backStyle: 'default' as const }),
    chrome: Object.freeze({
      borderStyle: 'standard' as const,
      borderTone: options.borderTone ?? 'neutral',
      backStyle: 'default' as const,
      chromeRevision: CARD_CHROME_REVISION,
    }),
    cost: front ? stat(card, 'cost') : null,
    power: front && card.type !== 'spell' ? stat(card, 'power') : null,
    statuses: front && card.textDisabled
      ? Object.freeze([{ key: 'disabled', kind: 'disabled' as const }])
      : Object.freeze([]),
  });
};

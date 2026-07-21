import type { StatVisual, VisualAssetRef, VisualColor } from './primitives';

export interface CardContentSpec {
  readonly cacheKey: string;
  readonly layout: 'regular' | 'spell';
  readonly name: string;
  readonly rulesText: string;
  readonly artwork: VisualAssetRef | null;
  readonly accent: VisualColor;
  readonly contentRevision: string;
}

export interface CardChromeVisual {
  readonly borderStyle: 'standard';
  readonly borderTone: 'neutral' | 'friendly' | 'enemy';
  readonly backStyle: 'default';
  readonly chromeRevision: string;
}

export type CardStatusVisual =
  | {
      readonly key: string;
      readonly kind: 'timer';
      readonly value: number;
      readonly tone: 'neutral' | 'warning' | 'danger';
    }
  | {
      readonly key: string;
      readonly kind: 'disabled';
    }
  | {
      readonly key: string;
      readonly kind: 'status-icon';
      readonly icon: VisualAssetRef;
      readonly label: string | null;
      readonly tone: 'neutral' | 'positive' | 'negative';
    };

export type CardFaceVisual =
  | { readonly kind: 'back'; readonly backStyle: 'default' }
  | { readonly kind: 'front'; readonly content: CardContentSpec };

export interface CardSurfaceModel {
  readonly kind: 'card';
  readonly face: CardFaceVisual;
  readonly chrome: CardChromeVisual;
  readonly cost: StatVisual | null;
  readonly power: StatVisual | null;
  readonly statuses: readonly CardStatusVisual[];
}

export type CardHitPart = 'content' | 'cost' | 'power' | 'status';

export interface CardHitResult {
  readonly part: CardHitPart;
  readonly statusKey?: string;
}

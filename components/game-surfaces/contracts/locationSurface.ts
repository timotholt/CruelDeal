import type { VisualAssetRef, VisualColor } from './primitives';

export interface LocationContentSpec {
  readonly cacheKey: string;
  readonly name: string;
  readonly rulesText: string;
  readonly artwork: VisualAssetRef | null;
  readonly accent: VisualColor;
  readonly contentRevision: string;
}

export type LocationFaceVisual =
  | { readonly kind: 'back'; readonly backStyle: 'default' }
  | { readonly kind: 'front'; readonly content: LocationContentSpec };

export interface LocationChromeVisual {
  readonly borderStyle: 'standard';
  readonly chromeRevision: string;
}

export type LocationStatusVisual = {
  readonly key: string;
  readonly kind: 'status-icon' | 'timer' | 'disabled';
  readonly value: string | number | null;
  readonly tone: 'neutral' | 'positive' | 'negative' | 'warning';
};

export interface LocationSurfaceModel {
  readonly kind: 'location';
  readonly face: LocationFaceVisual;
  readonly chrome: LocationChromeVisual;
  readonly statuses: readonly LocationStatusVisual[];
}

export interface ScoreVisual {
  readonly value: number;
  readonly tone: 'local' | 'remote';
}

export interface LaneVisualModel {
  readonly location: LocationSurfaceModel;
  readonly topScore: ScoreVisual;
  readonly bottomScore: ScoreVisual;
  readonly laneArtwork: VisualAssetRef | null;
}

export type LocationHitPart = 'content' | 'status';

export interface LocationHitResult {
  readonly part: LocationHitPart;
  readonly statusKey?: string;
}

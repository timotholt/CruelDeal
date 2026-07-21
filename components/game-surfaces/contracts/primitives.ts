export interface VisualAssetRef {
  readonly src: string;
  readonly revision: string;
}

export interface RasterSize {
  readonly width: number;
  readonly height: number;
}

export type VisualColor = `#${string}`;
export type StatTone = 'base' | 'buffed' | 'debuffed';

export interface StatVisual {
  readonly value: number;
  readonly tone: StatTone;
}

export interface SurfacePoint {
  readonly x: number;
  readonly y: number;
}

export const CARD_RASTER_SIZE: RasterSize = Object.freeze({ width: 500, height: 700 });
export const LOCATION_RASTER_SIZE: RasterSize = Object.freeze({ width: 700, height: 525 });

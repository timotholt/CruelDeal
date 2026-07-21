import { CARD_RASTER_SIZE, type CardContentSpec } from '../contracts';
import { RasterArtifactCache } from '../system/rasterArtifactCache';
import { CardContentRasterizer } from './CardContentRasterizer';

export const cardBitmapCache = new RasterArtifactCache(
  512,
  CARD_RASTER_SIZE,
  new CardContentRasterizer(),
);

export const clearCardBitmapCacheForTests = (): void => cardBitmapCache.clear();

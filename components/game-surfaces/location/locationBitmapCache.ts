import { LOCATION_RASTER_SIZE } from '../contracts';
import { RasterArtifactCache } from '../system/rasterArtifactCache';
import { LocationContentRasterizer } from './LocationContentRasterizer';

export const locationBitmapCache = new RasterArtifactCache(
  64,
  LOCATION_RASTER_SIZE,
  new LocationContentRasterizer(),
);

export const clearLocationBitmapCacheForTests = (): void => locationBitmapCache.clear();

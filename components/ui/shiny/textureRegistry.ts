import { SHINY_MATERIALS, toShinyMaterialId } from './materials';
import { bakeShinyTextureFromStops } from './textureBake';
import type { MetalId, ShinyMaterialId, ShinyTextureOptions } from './types';

const MAX_TEXTURE_CACHE_ENTRIES = 32;

let textureOpts: Required<Pick<ShinyTextureOptions, 'size' | 'grain'>> = { size: 512, grain: 8 };
const textureCache = new Map<string, string>();

const rememberTexture = (key: string, value: string) => {
  if (textureCache.size >= MAX_TEXTURE_CACHE_ENTRIES) {
    const oldest = textureCache.keys().next().value;
    if (oldest) textureCache.delete(oldest);
  }
  textureCache.set(key, value);
};

export function makeShinyTexture(id: MetalId, opts: ShinyTextureOptions = {}): string {
  const materialId = toShinyMaterialId(id);
  const spec = SHINY_MATERIALS[materialId];
  const size = opts.size ?? textureOpts.size;
  const grain = opts.grain ?? textureOpts.grain;
  const angle = opts.angle ?? spec.angle;
  const seed = opts.seed ?? spec.seed;
  const key = `${materialId}:${size}:${grain}:${angle}:${seed}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const value = bakeShinyTextureFromStops(spec.stops, { size, grain, angle, seed });
  rememberTexture(key, value);
  return value;
}

export function makeMetalTexture(id: MetalId, opts: ShinyTextureOptions = {}): string {
  return makeShinyTexture(id, opts);
}

export const setShinyTextureOptions = (opts: Partial<typeof textureOpts>) => {
  textureOpts = { ...textureOpts, ...opts };
  textureCache.clear();
};

export const setMetalTextureOptions = setShinyTextureOptions;

export const getShinyTextureCacheSize = () => textureCache.size;

export const getShinyMaterialTextureSizes = (id: ShinyMaterialId) => {
  const material = SHINY_MATERIALS[id];
  return {
    large: material.textureSize,
    small: material.smallTextureSize,
  };
};

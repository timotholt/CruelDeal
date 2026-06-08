export {
  LEGACY_AUTHORING_PRESETS,
  PRESETS,
  PROFILE_TO_METAL,
} from '../../authoring/shiny/presets';
export {
  METALS,
  SHINY_MATERIALS,
  metalCssGradient,
  metalSvgStops,
  toShinyMaterialId,
} from '../shiny/engine/materials';
export { bakeShinyTextureFromStops, makeMetalTextureFromStops } from '../shiny/engine/textureBake';
export {
  getShinyMaterialTextureSizes,
  getShinyTextureCacheSize,
  makeMetalTexture,
  makeShinyTexture,
  setMetalTextureOptions,
  setShinyTextureOptions,
} from '../shiny/engine/textureRegistry';
export {
  injectMetalVars,
  metalSurfaceStyle,
  publishShinyCssVars,
  publishShinyTextureVars,
} from '../shiny/engine/cssVars';
export type {
  MetalId,
  MetalSpec,
  MetalStop,
  MetalTextureOptions,
  ShinyMaterialDefinition,
  ShinyMaterialId,
  ShinyMaterialKey,
  ShinyStop,
  ShinyTextureOptions,
} from '../shiny';

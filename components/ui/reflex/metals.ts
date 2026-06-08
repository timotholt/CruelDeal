export {
  LEGACY_AUTHORING_PRESETS,
  METALS,
  PRESETS,
  PROFILE_TO_METAL,
  SHINY_MATERIALS,
  metalCssGradient,
  metalSvgStops,
  toShinyMaterialId,
} from '../shiny/materials';
export { bakeShinyTextureFromStops, makeMetalTextureFromStops } from '../shiny/textureBake';
export {
  getShinyMaterialTextureSizes,
  getShinyTextureCacheSize,
  makeMetalTexture,
  makeShinyTexture,
  setMetalTextureOptions,
  setShinyTextureOptions,
} from '../shiny/textureRegistry';
export {
  injectMetalVars,
  metalSurfaceStyle,
  publishShinyCssVars,
  publishShinyTextureVars,
} from '../shiny/cssVars';
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

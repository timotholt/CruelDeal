export type {
  MetalId,
  MetalSpec,
  MetalStop,
  MetalTextureOptions,
  ReflexDirection,
  ReflexPointer,
  ReflexShift,
  SheenMethod,
  SheenType,
  ShinyLegacyMaterialId,
  ShinyMaterialDefinition,
  ShinyMaterialId,
  ShinyMaterialKey,
  ShinyStop,
  ShinySurfaceProps,
  ShinyTextureOptions,
} from './types';
export {
  LEGACY_AUTHORING_PRESETS,
  METALS,
  PRESETS,
  PROFILE_TO_METAL,
  SHINY_MATERIALS,
  metalCssGradient,
  metalSvgStops,
  toShinyMaterialId,
} from './materials';
export { bakeShinyTextureFromStops, makeMetalTextureFromStops } from './textureBake';
export {
  getShinyMaterialTextureSizes,
  getShinyTextureCacheSize,
  makeMetalTexture,
  makeShinyTexture,
  setMetalTextureOptions,
  setShinyTextureOptions,
} from './textureRegistry';
export {
  injectMetalVars,
  metalSurfaceStyle,
  publishShinyCssVars,
  publishShinyTextureVars,
} from './cssVars';
export {
  direction,
  enableGyro,
  gyroActive,
  initReflex,
  pointer,
  setSheenEnabled,
  sheenEnabled,
} from './reflexController';
export {
  createReflexShift,
  REFLEX_CSS_SHIFT,
  REFLEX_SVG_UNITS,
} from './useReflex';
export { KanIcon } from './KanIcon';
export type { KanIconProps } from './KanIcon';
export { ReflectiveText, EmbossedReflectiveText } from './ReflectiveText';
export type { ReflectiveTextProps } from './ReflectiveText';
export { ReflectiveButton } from './ReflectiveButton';
export type { ReflectiveButtonProps } from './ReflectiveButton';
export { ReflectiveProgressBar } from './ReflectiveProgressBar';
export type { ReflectiveProgressBarProps } from './ReflectiveProgressBar';
export { enableGyro as enableMobileGyroscope } from './reflexController';

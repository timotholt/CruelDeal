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
} from './engine/types';
export {
  METALS,
  SHINY_MATERIALS,
  metalCssGradient,
  metalSvgStops,
  toShinyMaterialId,
} from './engine/materials';
export { bakeShinyTextureFromStops, makeMetalTextureFromStops } from './engine/textureBake';
export {
  getShinyMaterialTextureSizes,
  getShinyTextureCacheSize,
  makeMetalTexture,
  makeShinyTexture,
  setMetalTextureOptions,
  setShinyTextureOptions,
} from './engine/textureRegistry';
export {
  injectMetalVars,
  metalSurfaceStyle,
  publishShinyCssVars,
  publishShinyTextureVars,
} from './engine/cssVars';
export {
  direction,
  enableGyro,
  gyroActive,
  initReflex,
  pointer,
  setSheenEnabled,
  sheenEnabled,
} from './engine/reflexController';
export {
  createReflexShift,
  REFLEX_CSS_SHIFT,
  REFLEX_SVG_UNITS,
} from './engine/useReflex';
export { KanIcon } from './components/KanIcon';
export type { KanIconProps } from './components/KanIcon';
export { ReflectiveText, EmbossedReflectiveText } from './components/ReflectiveText';
export type { ReflectiveTextProps } from './components/ReflectiveText';
export { ReflectiveButton } from './components/ReflectiveButton';
export type { ReflectiveButtonProps } from './components/ReflectiveButton';
export { ReflectiveProgressBar } from './components/ReflectiveProgressBar';
export type { ReflectiveProgressBarProps } from './components/ReflectiveProgressBar';
export { enableGyro as enableMobileGyroscope } from './engine/reflexController';

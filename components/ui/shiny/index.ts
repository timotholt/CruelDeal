export type {
  ReflexDirection,
  ReflexPointer,
  ReflexShift,
  SheenMethod,
  SheenType,
  ShinyMaterialDefinition,
  ShinyMaterialId,
  ShinyStop,
  ShinySurfaceProps,
  ShinyTextureOptions,
} from './engine/types';
export {
  SHINY_MATERIALS,
  SHINY_MATERIAL_IDS,
  shinyCssGradient,
  shinySvgStops,
} from './engine/materials';
export { bakeShinyTextureFromStops } from './engine/textureBake';
export {
  getShinyMaterialTextureSizes,
  getShinyTextureCacheSize,
  makeShinyTexture,
  setShinyTextureOptions,
} from './engine/textureRegistry';
export {
  shinySurfaceStyle,
  publishShinyCssVars,
  publishShinyTextureVars,
} from './engine/cssVars';
export {
  LOCKED_METALLIC_REFLECTION,
  METALLIC_MATERIAL_COLORS,
  METALLIC_REFLECTION_DATA_URL,
} from './engine/reflectionFilm';
export type { MetallicMaterialId } from './engine/reflectionFilm';
export {
  direction,
  enableGyro,
  getReflexFpsCap,
  gyroActive,
  initReflex,
  disposeReflex,
  pointer,
  setReflexFpsCap,
  setSheenEnabled,
  sheenEnabled,
} from './engine/reflexController';
export type { ReflexFpsCap } from './engine/reflexController';
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

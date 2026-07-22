/**
 * Public VFX surface. Import from `@/services/vfx` rather than deep paths.
 *
 * Example:
 *   import { VFXEngine, vfxSfx } from '@/services/vfx';
 */

export { VFXEngine, lerp, rand, pick } from './engine';
export type {
  VFXEngineOpts,
  VfxContext,
  VfxPlayArgs,
  VfxPlayOpts,
  RegisteredEffect,
  Particle,
  LongLivedEffect,
  ResolvedPoint,
  SfxHook,
} from './engine';

export { Timeline } from './timeline';
export type { VfxVars } from './timeline';

export { defaultTheme, detectQuality, qualityScale } from './theme';
export type { VfxTheme, EasingFn, QualityLevel, ShakeConfig } from './theme';

export { vfxSfx } from './sfx';

export { captureCardRects, playCardLayoutSlide } from './animations/layout-flip';
export type { LayoutSlideOpts } from './animations/layout-flip';

import type { JSX } from 'solid-js';
import type { SurfaceOptions } from './surfaceSchema';
import { surfaceLayerFlags } from './surfaceFeatures';

// Emitter for the minimal 3-element surface (docs/surface-emitter-rewrite-spec.md).
//
// The static template (src/styles/material-minimal.css) defines a FIXED 9-slot background
// stack on `.cdm__fill` whose slots are these vars; the blend list is positional. This
// module emits a slot's gradient ONLY when its effect is active (a missing var resolves
// to `none` and paints nothing), so the emitted CSS is exactly what a hand author would
// write for that slider combo. Gradient definitions reference the EXISTING var system
// (--glass-alpha, --tint-rgb, ...) emitted by `surfaceStyle`, so live editor slider
// tweaks propagate without re-emitting.

type CssVarMap = Record<string, string>;

// Glass base — the old `.cd-surface__glass` background, split per slot.
const GLASS_A = 'linear-gradient(180deg, rgb(255 255 255 / calc(var(--glass-alpha) * 0.16)), transparent 30%)';
const GLASS_B = 'linear-gradient(180deg, rgb(255 255 255 / calc(var(--glass-alpha) * 0.07)), transparent 38% 72%, rgb(0 0 0 / calc(var(--glass-alpha) * 0.05)))';
const GLASS_C = 'linear-gradient(rgb(255 255 255 / calc(var(--glass-alpha) * 0.04)) 0 0)';

// Gradient modes — the old `.cd-surface--gradient-*  > .cd-surface__gradient` rules.
const GRAD_BOTH_A = 'linear-gradient(180deg, rgb(255 255 255 / var(--light-alpha)), transparent 36%, rgb(0 0 0 / var(--dark-alpha)))';
const GRAD_BOTH_B = 'linear-gradient(115deg, rgb(255 255 255 / calc(var(--light-alpha) * 0.45)), transparent 38%, rgb(0 0 0 / calc(var(--dark-alpha) * 0.69)))';
const GRAD_TOP_LIGHT = 'linear-gradient(180deg, rgb(255 255 255 / var(--light-alpha)), transparent 50%)';
const GRAD_BOTTOM_DARK = 'linear-gradient(180deg, transparent 34%, rgb(0 0 0 / var(--dark-alpha)))';

// Tint — the old `.cd-surface__tint` (mix-blend-mode: color; screen for white tint).
const TINT_IMG = 'linear-gradient(rgb(var(--tint-rgb) / var(--tint-alpha)) 0 0)';

// Base fill — the old `.cd-surface__material`.
const BASE_IMG = 'linear-gradient(var(--material-base-color) 0 0)';

// Texture dilution veil: per-layer opacity does not exist in background stacks, so the
// old `opacity: var(--texture-strength)` becomes a veil of the base color at alpha
// (1 - strength) painted OVER the texture — identical composite math over the base.
const TEXTURE_VEIL = 'linear-gradient(color-mix(in srgb, var(--material-base-color) calc((1 - var(--texture-strength, 0.58)) * 100%), transparent) 0 0)';

export const minimalSurfaceVars = (options: SurfaceOptions): JSX.CSSProperties => {
  const flags = surfaceLayerFlags(options);
  const vars: CssVarMap = {};

  if (flags.material) {
    vars['--mf-base'] = BASE_IMG;
  }
  if (flags.texture) {
    vars['--mf-texture'] = 'var(--texture-image)';
    // Veil only dilutes toward a real base; without a base the texture paints as-is.
    if (flags.material) vars['--mf-veil'] = TEXTURE_VEIL;
  }
  if (flags.tinted) {
    vars['--mf-tint'] = TINT_IMG;
    vars['--mf-tint-blend'] = options.tint === 'white' ? 'screen' : 'color';
  }
  if (flags.gradient) {
    const mode = options.gradient || 'both';
    if (mode === 'both') {
      vars['--mf-grad-a'] = GRAD_BOTH_A;
      if (options.sheen !== false) vars['--mf-grad-b'] = GRAD_BOTH_B;
    } else if (mode === 'top-light') {
      vars['--mf-grad-a'] = GRAD_TOP_LIGHT;
    } else if (mode === 'bottom-dark') {
      vars['--mf-grad-a'] = GRAD_BOTTOM_DARK;
    }
  }
  if (flags.glass) {
    vars['--mf-glass-a'] = GLASS_A;
    vars['--mf-glass-b'] = GLASS_B;
    vars['--mf-glass-c'] = GLASS_C;
  }
  if (flags.border) {
    vars['--ml-border-width'] = '1px';
  }

  return vars as JSX.CSSProperties;
};

// Which children the minimal surface needs for this recipe (active-effects-only DOM).
export const minimalSurfaceChildren = (options: SurfaceOptions) => {
  const flags = surfaceLayerFlags(options);
  return {
    // fill paints base/texture/tint/gradient/glass; render it when any are active.
    fill: flags.material || flags.texture || flags.tinted || flags.gradient || flags.glass,
    // light paints border/edges/corners/glow/emission.
    light: flags.border || flags.glowing || flags.emitting,
    wear: flags.edgeWear,
  };
};

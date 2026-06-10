import type { SurfaceOptions } from '../../ui/material-lab';

// JSON-driven permutation matrix for the minimal 3-element surface.
// Each spec is plain data: it feeds the renderer(s) AND the JSON inspector verbatim.
// `expect` tells a human (and an agent) what correct rendering looks like, so broken
// cells are identifiable without tribal knowledge.

export interface SurfacePermutation {
  id: string;
  group: string;
  label: string;
  expect: string;
  contentMode?: 'flow' | 'label';
  text?: string;
  options: SurfaceOptions;
}

const spec = (
  group: string,
  id: string,
  label: string,
  expect: string,
  options: SurfaceOptions,
  extra: Partial<Pick<SurfacePermutation, 'contentMode' | 'text'>> = {},
): SurfacePermutation => ({
  id,
  group,
  label,
  expect,
  // SurfaceOptions defaults texture to 'road012a' when unset — for an isolation matrix
  // every effect must be explicitly off unless the spec turns it on.
  options: { texture: 'none', ...options },
  ...extra,
});

export const surfacePermutations: SurfacePermutation[] = [
  // ---- base fill -------------------------------------------------------------
  spec('base', 'bare', 'Everything off', 'Nothing paints — fully transparent box, no fill/border/effects.', {
    material: 'none', gradient: 'none', border: 'none',
  }),
  spec('base', 'base-black', 'Base black', 'Flat near-black rounded rect, no other effects.', {
    material: 'black', gradient: 'none', border: 'none',
  }),
  spec('base', 'base-white', 'Base white', 'Flat white rounded rect.', {
    material: 'white', gradient: 'none', border: 'none',
  }),
  spec('base', 'base-gray', 'Base gray', 'Flat mid-gray rounded rect.', {
    material: 'gray', gradient: 'none', border: 'none',
  }),
  spec('base', 'base-custom', 'Custom color #8a2be2', 'Flat purple fill.', {
    material: 'custom', materialColor: '#8a2be2', gradient: 'none', border: 'none',
  }),
  spec('base', 'radius-0', 'Radius 0', 'Sharp square corners, gray fill.', {
    material: 'gray', radius: 0, gradient: 'none', border: 'none',
  }),
  spec('base', 'radius-16', 'Radius 16', 'Strongly rounded corners, gray fill.', {
    material: 'gray', radius: 16, gradient: 'none', border: 'none',
  }),

  // ---- shape / bevel ---------------------------------------------------------
  spec('shape', 'bevel-tl', 'Bevel TL only', 'Top-left corner cut diagonally; others rounded.', {
    material: 'gray', shape: 'bevel', bevelCorners: ['top-left'], bevelSize: 18, gradient: 'none', border: 'none',
  }),
  spec('shape', 'bevel-cross', 'Bevel TR+BL', 'Opposite corners (top-right, bottom-left) cut.', {
    material: 'gray', shape: 'bevel', bevelCorners: ['top-right', 'bottom-left'], bevelSize: 18, gradient: 'none', border: 'none',
  }),
  spec('shape', 'bevel-all', 'Bevel all corners', 'All four corners cut — octagon look.', {
    material: 'gray', shape: 'bevel', bevelCorners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'], bevelSize: 18, gradient: 'none', border: 'none',
  }),
  spec('shape', 'bevel-small', 'Bevel size 6', 'Tiny corner cuts.', {
    material: 'gray', shape: 'bevel', bevelCorners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'], bevelSize: 6, gradient: 'none', border: 'none',
  }),
  spec('shape', 'bevel-large', 'Bevel size 28', 'Deep corner cuts.', {
    material: 'gray', shape: 'bevel', bevelCorners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'], bevelSize: 28, gradient: 'none', border: 'none',
  }),
  spec('shape', 'bevel-border', 'Bevel + border', 'Beveled shape with a 1px light border following the clip.', {
    material: 'black', shape: 'bevel', bevelCorners: ['top-right'], bevelSize: 18, gradient: 'none', border: 'all', borderEnabled: true, borderOpacity: 70,
  }),

  // ---- texture ----------------------------------------------------------------
  spec('texture', 'tex-30', 'Stone04 @ 30%', 'Faint stone texture over white base.', {
    material: 'white', texture: 'stone04', textureStrength: 30, gradient: 'none', border: 'none',
  }),
  spec('texture', 'tex-100', 'Stone04 @ 100%', 'Full-strength stone texture, base barely visible.', {
    material: 'white', texture: 'stone04', textureStrength: 100, gradient: 'none', border: 'none',
  }),
  spec('texture', 'tex-scale-128', 'Texture scale 128', 'Small/tight texture tiling.', {
    material: 'white', texture: 'stone04', textureStrength: 70, textureScale: 128, gradient: 'none', border: 'none',
  }),
  spec('texture', 'tex-scale-512', 'Texture scale 512', 'Large/loose texture tiling.', {
    material: 'white', texture: 'stone04', textureStrength: 70, textureScale: 512, gradient: 'none', border: 'none',
  }),
  spec('texture', 'tex-on-black', 'Texture on black', 'Stone texture diluted toward black base.', {
    material: 'black', texture: 'stone04', textureStrength: 60, gradient: 'none', border: 'none',
  }),
  spec('texture', 'tex-leather', 'Black leather', 'Dark leather grain over black.', {
    material: 'black', texture: 'blackLeather01', textureStrength: 80, gradient: 'none', border: 'none',
  }),

  // ---- tint (the recolor) ------------------------------------------------------
  spec('tint', 'tint-black-50', 'Tint black 50', 'Gray base desaturated/darkened toward black.', {
    material: 'gray', tint: 'black', tintStrength: 50, gradient: 'none', border: 'none',
  }),
  spec('tint', 'tint-gold-60', 'Tint gold 60', 'Gray base recolored gold — THE recolor mechanism.', {
    material: 'gray', tint: 'gold', tintStrength: 60, gradient: 'none', border: 'none',
  }),
  spec('tint', 'tint-white-50', 'Tint white 50 (screen)', 'Brightened wash — white tint uses screen blend.', {
    material: 'gray', tint: 'white', tintStrength: 50, gradient: 'none', border: 'none',
  }),
  spec('tint', 'tint-cyan-80', 'Tint cyan 80', 'Strong cyan recolor of gray base.', {
    material: 'gray', tint: 'cyan', tintStrength: 80, gradient: 'none', border: 'none',
  }),
  spec('tint', 'tint-red-40', 'Tint red 40', 'Moderate red recolor.', {
    material: 'gray', tint: 'red', tintStrength: 40, gradient: 'none', border: 'none',
  }),
  spec('tint', 'tint-tex-gold', 'Gold tint over texture', 'Stone texture recolored gold (tint above texture).', {
    material: 'white', texture: 'stone04', textureStrength: 70, tint: 'gold', tintStrength: 70, gradient: 'none', border: 'none',
  }),

  // ---- gradient -----------------------------------------------------------------
  spec('gradient', 'grad-top', 'Top-light', 'White wash fading from the top edge.', {
    material: 'gray', gradient: 'top-light', lightStrength: 35, border: 'none',
  }),
  spec('gradient', 'grad-bottom', 'Bottom-dark', 'Dark wash rising from the bottom edge.', {
    material: 'gray', gradient: 'bottom-dark', darkStrength: 45, border: 'none',
  }),
  spec('gradient', 'grad-both', 'Both + diagonal sheen', 'Light top, dark bottom, plus a 115° diagonal sheen.', {
    material: 'gray', gradient: 'both', lightStrength: 30, darkStrength: 40, sheen: true, border: 'none',
  }),
  spec('gradient', 'grad-both-nosheen', 'Both, sheen off', 'Light top + dark bottom only — NO diagonal band.', {
    material: 'gray', gradient: 'both', lightStrength: 30, darkStrength: 40, sheen: false, border: 'none',
  }),
  spec('gradient', 'grad-none', 'Gradient none', 'Flat gray — identical to base-gray.', {
    material: 'gray', gradient: 'none', border: 'none',
  }),

  // ---- glass ----------------------------------------------------------------------
  spec('glass', 'glass-wash', 'Glass wash only', 'Subtle translucent white wash, no shine band.', {
    material: 'black', glass: true, glassShine: false, glassOpacity: 42, gradient: 'none', border: 'none',
  }),
  spec('glass', 'glass-shine', 'Glass + shine', 'Bright horizontal reflection band in upper third.', {
    material: 'black', glass: true, glassShine: true, glassOpacity: 42, gradient: 'none', border: 'none',
  }),
  spec('glass', 'glass-shine-dim', 'Shine, sheen-off variant', 'Dimmer, softer reflection band.', {
    material: 'black', glass: true, glassShine: true, sheen: false, glassOpacity: 42, gradient: 'none', border: 'none',
  }),
  spec('glass', 'glass-blur-4', 'Glass blur 4', 'Backdrop behind the cell blurs slightly (see page bg).', {
    material: 'none', glass: true, glassBlurEnabled: true, glassBlur: 4, gradient: 'none', border: 'all', borderEnabled: true,
  }),
  spec('glass', 'glass-blur-16', 'Glass blur 16', 'Heavy frosted-glass backdrop blur.', {
    material: 'none', glass: true, glassBlurEnabled: true, glassBlur: 16, gradient: 'none', border: 'all', borderEnabled: true,
  }),
  spec('glass', 'glass-reflect-low', 'Reflection 20%', 'Shine band barely visible.', {
    material: 'black', glass: true, glassShine: true, glassReflectionOpacity: 20, gradient: 'none', border: 'none',
  }),
  spec('glass', 'glass-band-low', 'Highlight band at 60%', 'Reflection band moved down to 60% height.', {
    material: 'black', glass: true, glassShine: true, glassHighlightY: 60, gradient: 'none', border: 'none',
  }),
  spec('glass', 'glass-full', 'Glass everything', 'Wash + bright band + blur + sheen together.', {
    material: 'black', glass: true, glassShine: true, glassBlurEnabled: true, glassBlur: 8, glassOpacity: 60, gradient: 'none', border: 'none',
  }),

  // ---- border / edges / corners ------------------------------------------------------
  spec('frame', 'border-all', 'Border all sides', 'Uniform 1px light border.', {
    material: 'black', border: 'all', borderEnabled: true, borderOpacity: 60, gradient: 'none',
  }),
  spec('frame', 'border-top', 'Border top only', '1px border on top edge only.', {
    material: 'black', border: 'top', borderEnabled: true, borderOpacity: 80, gradient: 'none',
  }),
  spec('frame', 'border-three', 'Three-sided border', 'Border on top/left/right, open bottom.', {
    material: 'black', border: 'three-sided', borderEnabled: true, borderOpacity: 70, gradient: 'none',
  }),
  spec('frame', 'border-lit', 'Border-lit', 'Inset light line top + dark line bottom (embossed frame).', {
    material: 'gray', border: 'all', borderEnabled: true, borderLit: true, borderOpacity: 60, gradient: 'none',
  }),
  spec('frame', 'border-custom', 'Custom border color', 'Crimson border.', {
    material: 'black', border: 'all', borderEnabled: true, borderColor: 'custom', borderCustomColor: '#dc3545', borderOpacity: 90, gradient: 'none',
  }),
  spec('frame', 'shadow', 'Drop shadow', 'Surface floats with a soft dark shadow below.', {
    material: 'gray', dropShadow: true, shadowOpacity: 65, shadowBlur: 18, shadowY: 9, gradient: 'none', border: 'none',
  }),
  spec('frame', 'corner-size', 'Corner size 30', 'When glow corners active, highlight arms are long. (Pair with glow group.)', {
    material: 'black', cornerSize: 30, gradient: 'none', border: 'none',
  }),

  // ---- glow / emission (state lighting; forced via stateless options) ------------------
  spec('lighting', 'glow-gold', 'Glow gold 60', 'Warm gold halo washes from edges/corners.', {
    material: 'black', glow: 'gold', glowStrength: 60, corners: 'all', edgeHighlight: ['top', 'bottom'], gradient: 'none', border: 'none', stateful: false,
  }),
  spec('lighting', 'glow-cyan-100', 'Glow cyan 100', 'Intense cyan halo all around.', {
    material: 'black', glow: 'cyan', glowStrength: 100, corners: 'all', edgeHighlight: ['top', 'right', 'bottom', 'left'], gradient: 'none', border: 'none', stateful: false,
  }),
  spec('lighting', 'glow-corners', 'Corner highlights only', 'Bright L-shaped corner marks, no edge wash.', {
    material: 'black', glow: 'gold', glowStrength: 70, corners: ['top-left', 'bottom-right'], edgeHighlight: 'none', gradient: 'none', border: 'none', stateful: false,
  }),
  spec('lighting', 'emit-line', 'Emission line', 'Thin glowing gold line centered on the bottom edge.', {
    material: 'black', emission: 'line', emissionTone: 'gold', emissionStrength: 90, emissionLength: 60, emissionThickness: 2, gradient: 'none', border: 'none', stateful: false,
  }),
  spec('lighting', 'emit-blip', 'Emission center blip', 'Small glowing dot centered on the bottom edge.', {
    material: 'black', emission: 'center-blip', emissionTone: 'cyan', emissionStrength: 90, emissionBlipSize: 16, gradient: 'none', border: 'none', stateful: false,
  }),
  spec('lighting', 'emit-rail-blip', 'Rail + blip', 'Glowing line AND center dot on the bottom edge.', {
    material: 'black', emission: 'rail-and-blip', emissionTone: 'gold', emissionStrength: 100, emissionLength: 70, emissionThickness: 1, emissionBlipSize: 14, gradient: 'none', border: 'none', stateful: false,
  }),
  spec('lighting', 'emit-red-thick', 'Emission red thick', 'Fat red glowing line, alarm look.', {
    material: 'black', emission: 'line', emissionTone: 'red', emissionStrength: 100, emissionLength: 80, emissionThickness: 4, gradient: 'none', border: 'none', stateful: false,
  }),
  spec('lighting', 'glow-and-emit', 'Glow + emission', 'Gold halo AND bottom emission line together.', {
    material: 'black', glow: 'gold', glowStrength: 50, corners: 'all', edgeHighlight: ['bottom'], emission: 'line', emissionTone: 'gold', emissionStrength: 80, emissionLength: 50, gradient: 'none', border: 'none', stateful: false,
  }),

  // ---- edge wear ---------------------------------------------------------------------
  spec('wear', 'wear-light', 'Edge wear light', 'Subtle dark grunge nibbling the border ring.', {
    material: 'gray', texture: 'stone04', textureStrength: 40, edgeWear: true, edgeWearTexture: 'edge-bw-noise-dense', edgeWearOpacity: 35, edgeWearWidth: 5, gradient: 'none', border: 'none',
  }),
  spec('wear', 'wear-heavy', 'Edge wear heavy', 'Strong grunge ring eating into the edges.', {
    material: 'gray', texture: 'stone04', textureStrength: 40, edgeWear: true, edgeWearTexture: 'edge-bw-noise-dense', edgeWearOpacity: 90, edgeWearWidth: 10, gradient: 'none', border: 'none',
  }),
  spec('wear', 'wear-above', 'Wear above highlights', 'Grunge ring painted on top of glow highlights.', {
    material: 'black', texture: 'stone04', textureStrength: 40, edgeWear: true, edgeWearTexture: 'edge-bw-noise-dense', edgeWearOpacity: 70, edgeWearLayer: 'above-highlights', glow: 'gold', glowStrength: 60, corners: 'all', gradient: 'none', border: 'none', stateful: false,
  }),

  // ---- content / typography (label mode) ------------------------------------------------
  spec('content', 'label-default', 'Label default', 'Centered uppercase italic label, embossed shadow.', {
    material: 'gray', gradient: 'both', border: 'none',
  }, { contentMode: 'label', text: 'Confirm' }),
  spec('content', 'label-big', 'Font size 1.4rem', 'Larger label text.', {
    material: 'gray', gradient: 'both', textSizeRem: 1.4, border: 'none',
  }, { contentMode: 'label', text: 'Big Label' }),
  spec('content', 'label-gold', 'Gold content tone', 'Label rendered in gold.', {
    material: 'black', contentTone: 'gold', gradient: 'none', border: 'none',
  }, { contentMode: 'label', text: 'Reward' }),
  spec('content', 'label-glow', 'Content glow', 'Label with a soft self-glow.', {
    material: 'black', contentTone: 'cyan', contentGlowStrength: 80, gradient: 'none', border: 'none',
  }, { contentMode: 'label', text: 'Online' }),
  spec('content', 'label-top-left', 'Top-left aligned', 'Label pinned to top-left via textAlign/textY.', {
    material: 'gray', textAlign: 'left', textY: -30, gradient: 'none', border: 'none',
  }, { contentMode: 'label', text: 'TL' }),
  spec('content', 'label-tracking', 'Wide letter-spacing', 'Spread-out uppercase tracking.', {
    material: 'black', letterSpacing: 0.18, gradient: 'none', border: 'none',
  }, { contentMode: 'label', text: 'Sector 07' }),

  // ---- interactive states ----------------------------------------------------------------
  spec('states', 'interactive-hover', 'Interactive (hover me)', 'Brightens + lifts on hover via the state var machinery.', {
    material: 'gray', gradient: 'both', interactive: true, border: 'all', borderEnabled: true,
  }, { contentMode: 'label', text: 'Hover Me' }),
  spec('states', 'hover-preview', 'Hover preview forced', 'Statically shows the hover brightness boost.', {
    material: 'gray', gradient: 'both', hoverPreview: true, border: 'all', borderEnabled: true,
  }, { contentMode: 'label', text: 'Hovered' }),
  spec('states', 'selected', 'Selected', 'Selected-state styling (if any visible).', {
    material: 'gray', gradient: 'both', selected: true, border: 'all', borderEnabled: true,
  }, { contentMode: 'label', text: 'Selected' }),
  spec('states', 'motion', 'State scale/translate', 'Rendered 4% larger and raised 2px (motion vars).', {
    material: 'gray', gradient: 'both', stateScale: 1.04, stateTranslateY: -2, border: 'none',
  }, { contentMode: 'label', text: 'Lifted' }),

  // ---- kitchen sink ------------------------------------------------------------------------
  spec('kitchen-sink', 'sink-light', 'Everything on (light)', 'White+texture+gold tint+gradient+glass shine+blur+border+glow+emission+wear at once.', {
    material: 'white', texture: 'stone04', textureStrength: 60, tint: 'gold', tintStrength: 40,
    gradient: 'both', sheen: true, glass: true, glassShine: true, glassBlurEnabled: true, glassBlur: 4,
    border: 'all', borderEnabled: true, borderLit: true, glow: 'gold', glowStrength: 50, corners: 'all',
    edgeHighlight: ['top', 'bottom'], emission: 'rail-and-blip', emissionTone: 'gold', emissionStrength: 80,
    emissionLength: 60, edgeWear: true, edgeWearTexture: 'edge-bw-noise-dense', edgeWearOpacity: 45, dropShadow: true, shadowOpacity: 60, stateful: false,
  }, { contentMode: 'label', text: 'Maximal' }),
  spec('kitchen-sink', 'sink-dark', 'Everything on (dark)', 'Black/cyan variant of the maximal combo.', {
    material: 'black', texture: 'blackLeather01', textureStrength: 70, tint: 'cyan', tintStrength: 35,
    gradient: 'both', sheen: true, glass: true, glassShine: true, glassBlurEnabled: true, glassBlur: 6,
    border: 'all', borderEnabled: true, glow: 'cyan', glowStrength: 70, corners: 'all',
    edgeHighlight: ['top', 'right', 'bottom', 'left'], emission: 'line', emissionTone: 'cyan',
    emissionStrength: 100, emissionLength: 70, edgeWear: true, edgeWearTexture: 'edge-bw-noise-dense', edgeWearOpacity: 60, stateful: false,
  }, { contentMode: 'label', text: 'Night Ops' }),
  spec('kitchen-sink', 'sink-bevel', 'Maximal + bevel', 'The full combo on a beveled octagon shape.', {
    material: 'gray', shape: 'bevel', bevelCorners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'], bevelSize: 16,
    texture: 'stone04', textureStrength: 50, tint: 'brass', tintStrength: 45, gradient: 'both',
    glass: true, glassShine: true, border: 'all', borderEnabled: true, glow: 'brass', glowStrength: 60,
    corners: 'all', emission: 'center-blip', emissionTone: 'brass', emissionStrength: 90, stateful: false,
  }, { contentMode: 'label', text: 'Forge' }),
];

export const surfacePermutationGroups = (): string[] => {
  const seen: string[] = [];
  for (const p of surfacePermutations) if (!seen.includes(p.group)) seen.push(p.group);
  return seen;
};

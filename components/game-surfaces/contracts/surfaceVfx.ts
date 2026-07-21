export type SurfaceVfxChannel = 'below-chrome' | 'above-chrome' | 'outside-surface';

export type CardVfxCue =
  | { readonly kind: 'power-flash'; readonly tone: 'buff' | 'debuff'; readonly intensity: number; readonly channel: 'above-chrome' }
  | { readonly kind: 'glitch'; readonly intensity: number; readonly channel: 'above-chrome' }
  | { readonly kind: 'reveal'; readonly channel: 'outside-surface' }
  | { readonly kind: 'destroy'; readonly intensity: number; readonly channel: 'outside-surface' };

export type LocationVfxCue =
  | { readonly kind: 'reveal'; readonly channel: 'outside-surface' }
  | { readonly kind: 'glitch'; readonly intensity: number; readonly channel: 'above-chrome' };

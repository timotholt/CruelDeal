/**
 * Canonical metal definitions — the SINGLE source of truth for every reflective
 * surface (KanIcon SVG hexes, reflective text, buttons, progress bars, lines,
 * and [gold]/[silver]/[brass]... rich-text tokens).
 *
 * Each metal is defined once here as a rich multi-stop gradient (the same detail
 * KanIcon's profiles carried). Both consumers read from this one place:
 *   - SVG: metalSvgStops(spec) → <stop offset color> array
 *   - CSS: injected to :root as --metal-<id>-gradient / --metal-<id>-highlight,
 *          which index.css .metal-* and rich-token rules reference.
 * Change a color here and the hex, the text, and the button all move together.
 */

export type MetalId = 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';

export interface MetalStop {
  offset: number; // 0..100
  color: string;
}

export interface MetalSpec {
  id: MetalId;
  stops: MetalStop[];
  highlight: string;
  /** Angle (deg) for the CSS linear-gradient mirror of the stop list. */
  angle: number;
}

// Global Stops Registry for all visual gradient presets
export const PRESETS: Record<string, MetalStop[]> = {
  A: [
    { offset: 0, color: '#FFF3C2' },
    { offset: 25, color: '#E2B857' },
    { offset: 50, color: '#FCF6BA' },
    { offset: 75, color: '#B28424' },
    { offset: 100, color: '#FCD267' }
  ],
  B: [
    { offset: 0, color: '#251502' },
    { offset: 25, color: '#E5B842' },
    { offset: 50, color: '#FFF7C7' },
    { offset: 75, color: '#E5B842' },
    { offset: 100, color: '#251502' }
  ],
  C: [
    { offset: 0, color: '#FFF2C2' },
    { offset: 30, color: '#C5A44E' },
    { offset: 50, color: '#A48748' },
    { offset: 70, color: '#EDCD75' },
    { offset: 100, color: '#B7984A' }
  ],
  D: [
    { offset: 0, color: '#EBEFF5' },
    { offset: 25, color: '#B5B9BF' },
    { offset: 50, color: '#EDF1F7' },
    { offset: 75, color: '#83878D' },
    { offset: 100, color: '#CED2D8' }
  ],
  E: [
    { offset: 0, color: '#D1D5DB' },
    { offset: 30, color: '#6B7280' },
    { offset: 50, color: '#374151' },
    { offset: 70, color: '#9CA3AF' },
    { offset: 100, color: '#4B5563' }
  ],
  F: [
    { offset: 0, color: '#9CA3AF' },
    { offset: 25, color: '#4B5563' },
    { offset: 50, color: '#1F2937' },
    { offset: 75, color: '#111827' },
    { offset: 100, color: '#374151' }
  ],
  G: [
    { offset: 0, color: '#55411B' },
    { offset: 15, color: '#997E47' },
    { offset: 30, color: '#55411B' },
    { offset: 45, color: '#FFFDDA' },
    { offset: 60, color: '#D5BB8A' },
    { offset: 75, color: '#B8A269' },
    { offset: 85, color: '#55411B' },
    { offset: 100, color: '#FBECA9' }
  ],
  I: [
    { offset: 0, color: '#7C6535' },
    { offset: 15, color: '#997E47' },
    { offset: 30, color: '#7C6535' },
    { offset: 45, color: '#FFFDDA' },
    { offset: 60, color: '#D5BB8A' },
    { offset: 75, color: '#B8A269' },
    { offset: 85, color: '#7C6535' },
    { offset: 100, color: '#FBECA9' }
  ],
  J: [
    { offset: 0, color: '#7C6535' },
    { offset: 8, color: '#997E47' },
    { offset: 26, color: '#B8A269' },
    { offset: 30, color: '#7C6535' },
    { offset: 34, color: '#FFFDDA' },
    { offset: 60, color: '#D5BB8A' },
    { offset: 81, color: '#B8A269' },
    { offset: 85, color: '#7C6535' },
    { offset: 93, color: '#FBECA9' },
    { offset: 100, color: '#7C6535' }
  ],
  K: [
    { offset: 0, color: '#FFFDDA' },
    { offset: 31, color: '#D5BB8A' },
    { offset: 44, color: '#7C6535' },
    { offset: 100, color: '#55411B' }
  ],
  R1: [
    { offset: 0, color: '#FFFDDA' },
    { offset: 15, color: '#D5BB8A' },
    { offset: 35, color: '#7C6535' },
    { offset: 55, color: '#FFFDDA' },
    { offset: 75, color: '#D5BB8A' },
    { offset: 90, color: '#7C6535' },
    { offset: 100, color: '#55411B' }
  ],
  R2: [
    { offset: 0, color: '#FFFDDA' },
    { offset: 25, color: '#D5BB8A' },
    { offset: 60, color: '#7C6535' },
    { offset: 100, color: '#55411B' }
  ]
};

export const METALS: Record<MetalId, MetalSpec> = {
  gold: { id: 'gold', highlight: '#FFFDDA', angle: 135, stops: PRESETS.J },
  kan: { id: 'kan', highlight: '#FFFDDA', angle: 135, stops: PRESETS.J },
  silver: { id: 'silver', highlight: '#EBEFF5', angle: 135, stops: PRESETS.D },
  brass: { id: 'brass', highlight: '#FFFDDA', angle: 135, stops: PRESETS.G },
  mark: { id: 'mark', highlight: '#f3f4f6', angle: 135, stops: PRESETS.F },
  credit: {
    id: 'credit',
    highlight: '#93c5fd',
    angle: 135,
    stops: [
      { offset: 0, color: '#1e3a8a' },
      { offset: 50, color: '#3b82f6' },
      { offset: 100, color: '#1d4ed8' },
    ],
  },
};

/** SVG <stop> array for a KanIcon linearGradient/radialGradient. */
export const metalSvgStops = (spec: MetalSpec) =>
  spec.stops.map((s) => ({ offset: `${s.offset}%`, color: s.color }));

/** CSS linear-gradient() string mirroring the same stop list. */
export const metalCssGradient = (spec: MetalSpec) =>
  `linear-gradient(${spec.angle}deg, ${spec.stops.map((s) => `${s.color} ${s.offset}%`).join(', ')})`;

/** KanIcon gradientProfile → canonical metal (the showcase profiles). */
export const PROFILE_TO_METAL: Partial<Record<string, MetalId>> = {
  J: 'gold',
  D: 'silver',
  G: 'brass',
  F: 'mark',
};


// ---------------------------------------------------------------------------
// BAKED METAL TEXTURE
// One canvas-baked PNG per metal: the SAME METALS stops drawn as a gradient,
// with subtle brushed grain composited in. This is the "canvas metal" method —
// the single texture that text, buttons, and (optionally) icons all reveal
// through their own mask, slid by the reflex direction. Tuned to look as close
// as possible to the vector SVG gradient.
// ---------------------------------------------------------------------------

export interface MetalTextureOptions {
  size?: number; // px, square. Default 512.
  grain?: number; // 0 = none, ~8 = subtle brushed grain, higher = noisier.
  angle?: number; // gradient angle in deg. Defaults to the metal's own angle.
}

let textureOpts: Required<Pick<MetalTextureOptions, 'size' | 'grain'>> = { size: 512, grain: 8 };
const metalTextureCache = new Map<string, string>();

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * THE baker. Bakes a metal texture data-URL from an explicit stop list, so the
 * static metals AND the live gradient editor go through one path — vector and
 * baked share a single source. Cached by spec only (never by reflex), so coins
 * sharing a spec share one bake and nothing re-bakes on pointer move.
 */
export function makeMetalTextureFromStops(stops: MetalStop[], opts: MetalTextureOptions = {}): string {
  if (typeof document === 'undefined' || stops.length === 0) return '';
  const size = opts.size ?? textureOpts.size;
  const grain = opts.grain ?? textureOpts.grain;
  const angle = opts.angle ?? 135;
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  const key = `${size}:${grain}:${angle}:${sorted.map((s) => `${s.offset}${s.color}`).join(',')}`;
  const cached = metalTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Gradient spanning corner-to-corner through the centre at `angle` — same
  // stop colours as the vector path so the metal reads identically.
  const rad = (angle * Math.PI) / 180;
  const half = size / 2;
  const dx = Math.cos(rad) * half;
  const dy = Math.sin(rad) * half;
  const g = ctx.createLinearGradient(half - dx, half - dy, half + dx, half + dy);
  sorted.forEach((s) => g.addColorStop(clamp01(s.offset / 100), s.color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Subtle brushed grain: per-row streak + per-pixel jitter. Kept low so the
  // baked texture stays close to the clean vector gradient.
  if (grain > 0) {
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let y = 0; y < size; y++) {
      const streak = (Math.random() - 0.5) * grain;
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n = streak + (Math.random() - 0.5) * grain * 0.5;
        data[idx] = Math.max(0, Math.min(255, data[idx] + n));
        data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + n));
        data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + n));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const url = canvas.toDataURL('image/png');
  metalTextureCache.set(key, url);
  return url;
}

/** Bake from a canonical metal id — thin wrapper over makeMetalTextureFromStops. */
export function makeMetalTexture(id: MetalId, opts: MetalTextureOptions = {}): string {
  const spec = METALS[id];
  return makeMetalTextureFromStops(spec.stops, { angle: spec.angle, ...opts });
}

/** Re-bake all metal textures with new tuning + republish the CSS vars. */
export const setMetalTextureOptions = (opts: Partial<typeof textureOpts>) => {
  textureOpts = { ...textureOpts, ...opts };
  metalTextureCache.clear();
  publishMetalTextureVars();
};

const publishMetalTextureVars = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  (Object.keys(METALS) as MetalId[]).forEach((id) => {
    root.setProperty(`--metal-${id}-texture`, `url(${makeMetalTexture(id)})`);
    // Small variant for CSS background-clip:text — glyphs show little texture
    // detail, and a 128px bitmap is ~16x cheaper to re-clip per frame than 512px.
    root.setProperty(`--metal-${id}-texture-sm`, `url(${makeMetalTexture(id, { size: 128 })})`);
  });
};

/**
 * The single source of the reflex-driven texture formula. Reused by the test
 * bed today and (later) by the material `cd-surface__metal` layer. `shiftPx` is
 * how far the highlight travels at full tilt.
 */
export const metalSurfaceStyle = (id: MetalId, shiftPx = 60) => ({
  'background-image': `var(--metal-${id}-texture)`,
  'background-size': '180% 180%',
  'background-position': `calc(50% + var(--reflex-gx) * ${shiftPx}px) calc(50% + var(--reflex-gy) * ${shiftPx}px)`,
});

let injected = false;

/**
 * Write the canonical gradients/highlights to :root as CSS custom properties so
 * index.css metal classes can reference one source. Runs once, before paint.
 */
export const injectMetalVars = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;

  if (!injected) {
    (Object.keys(METALS) as MetalId[]).forEach((id) => {
      const spec = METALS[id];
      root.setProperty(`--metal-${id}-gradient`, metalCssGradient(spec));
      root.setProperty(`--metal-${id}-highlight`, spec.highlight);
    });
    injected = true;
  }

  // Baked per-metal textures (the "canvas metal" method).
  publishMetalTextureVars();
};

// Inject at module load (before any component renders) so CSS vars are ready.
injectMetalVars();

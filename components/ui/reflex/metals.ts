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

import { createSignal } from 'solid-js';

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

// Procedural noise state: off by default
export const [proceduralNoiseEnabled, setProceduralNoiseEnabled] = createSignal(false);

export const setProceduralNoise = (val: boolean) => {
  setProceduralNoiseEnabled(val);
  injectMetalVars(val);
};

let noiseTextureCache = '';

/**
 * Generates a seamless tileable grey brushed-metal noise grain Base64 data URL.
 * Filled with mid-gray #808080 (mathematical neutral for overlay blend mode)
 * overlaid with random horizontal scratch streaks.
 */
export function getBrushedNoiseTexture(): string {
  if (noiseTextureCache) return noiseTextureCache;
  if (typeof document === 'undefined') return '';
  
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Neutral grey background
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Add horizontal streaks and micro-scratches
  for (let y = 0; y < size; y++) {
    // Horizontal scratch streak (larger random offset per row)
    const streak = (Math.random() - 0.5) * 45;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Per-pixel high-frequency grain
      const grain = (Math.random() - 0.5) * 15;
      const noise = streak + grain;

      const val = Math.max(0, Math.min(255, 128 + noise));
      data[idx + 0] = val; // R
      data[idx + 1] = val; // G
      data[idx + 2] = val; // B
      data[idx + 3] = 255; // Fully opaque
    }
  }

  ctx.putImageData(imgData, 0, 0);
  noiseTextureCache = canvas.toDataURL('image/jpeg', 0.8);
  return noiseTextureCache;
}

let injected = false;

/**
 * Write the canonical gradients/highlights to :root as CSS custom properties so
 * index.css metal classes can reference one source. Runs once, before paint.
 */
export const injectMetalVars = (enableNoise = false) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  
  // Update the CSS noise layer URL
  root.setProperty('--brushed-noise-url', enableNoise ? `url(${getBrushedNoiseTexture()})` : 'none');

  (Object.keys(METALS) as MetalId[]).forEach((id) => {
    const spec = METALS[id];
    if (!injected) {
      root.setProperty(`--metal-${id}-gradient`, metalCssGradient(spec));
      root.setProperty(`--metal-${id}-highlight`, spec.highlight);
    }
    
    // Set procedural background image variable to stack the noise overlay on top of the base gradient
    if (enableNoise) {
      root.setProperty(`--metal-${id}-procedural-texture`, `var(--brushed-noise-url), var(--metal-${id}-gradient)`);
    } else {
      root.setProperty(`--metal-${id}-procedural-texture`, `var(--metal-${id}-gradient)`);
    }
  });
  injected = true;
};

// Inject at module load (before any component renders) so CSS vars are ready.
injectMetalVars(false);

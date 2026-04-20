/**
 * VFX theme — colors, timings, easings, camera shake presets, and quality level.
 * Ported from the vanilla-JS demo (ccg/vfx-engine/project/vfx/theme.js).
 */

export type EasingFn = (t: number) => number;

export type QualityLevel = 'low' | 'med' | 'high' | 'auto';

export interface ShakeConfig {
  amp: number;
  dur: number;
}

export interface VfxTheme {
  colors: Record<string, string[]>;
  timings: Record<string, number>;
  easings: Record<string, EasingFn>;
  camera: Record<string, ShakeConfig>;
  quality: QualityLevel;
}

export const defaultTheme: VfxTheme = {
  colors: {
    // Energy types
    fire:    ['#ffedb0', '#ffb347', '#ff5a1f', '#8b1a00'],
    ice:     ['#ffffff', '#bfefff', '#6cc3ff', '#2a6fb0'],
    arcane:  ['#ffffff', '#e3bdff', '#a66dff', '#4a1d8c'],
    laser:   ['#ffffff', '#ff6bd6', '#c724b1', '#5a0a6a'],
    poison:  ['#e8ffbc', '#9cff4a', '#3db820', '#0e4a0b'],
    holy:    ['#ffffff', '#fff2b5', '#ffd95a', '#c98f1a'],
    wind:    ['#ffffff', '#cfe8ff', '#8fb3d4', '#3e4f66'],
    shadow:  ['#b088c9', '#6b3ea0', '#2d0e5a', '#090016'],
    // Game events
    buff:    ['#ffffff', '#b8ffe3', '#2dd4a7', '#064e3b'],
    debuff:  ['#ffeaea', '#ff8080', '#b02a2a', '#3a0606'],
    destroy: ['#fff0c9', '#ff9d3b', '#c42020', '#1a0000'],
    heal:    ['#ffffff', '#d4ffdd', '#4ade80', '#14532d'],
  },
  timings: {
    revealFlip: 700,
    onRevealBurst: 900,
    buffPulse: 800,
    debuffPulse: 900,
    destroyShatter: 1100,
    moveLane: 650,
    laserBeam: 700,
    fireBlast: 1000,
    iceStorm: 1400,
    rainStorm: 1800,
    windGust: 900,
    knifeThrow: 600,
    auraLoop: 2400,
  },
  easings: {
    outExpo:    (t) => 1 - Math.pow(2, -10 * t),
    outCubic:   (t) => 1 - Math.pow(1 - t, 3),
    inCubic:    (t) => t * t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack:    (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
  },
  camera: {
    shakeSmall: { amp: 3,  dur: 200 },
    shakeMed:   { amp: 8,  dur: 320 },
    shakeBig:   { amp: 16, dur: 500 },
  },
  quality: 'auto',
};

export function detectQuality(): Exclude<QualityLevel, 'auto'> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Mobi|Android/i.test(navigator.userAgent);
  if (mobile && (mem < 4 || cores < 4)) return 'low';
  if (mobile) return 'med';
  if (mem >= 8 && cores >= 8) return 'high';
  return 'med';
}

export function qualityScale(theme: VfxTheme): number {
  const q = theme.quality === 'auto' ? detectQuality() : theme.quality;
  return { low: 0.4, med: 0.7, high: 1.0 }[q];
}

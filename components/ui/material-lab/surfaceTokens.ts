import type { MaterialTone } from './MaterialRecipeTypes';
import type { BorderColorKind, CornerName, MaterialKind } from './surfaceSchema';

// Color/tone tables and hex utilities for the surface. Pure data — the feature
// pipeline reads these to build CSS variables.

export const allCorners: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

// Single source of truth for every color, as space-separated RGB channels.
// Channel strings compose alpha directly in CSS: rgb(var(--x) / 0.9).
const rgb = {
  // Pure values (used by base fills and border colors).
  pureBlack: '0 0 0',
  pureWhite: '255 255 255',
  pureGray: '128 128 128',
  // Warm/branded tone palette (used by glow + tint).
  none: '0 0 0',
  inherit: '244 238 224',
  black: '23 20 15',
  brass: '255 188 72',
  gold: '248 215 112',
  cyan: '55 190 255',
  white: '255 255 255',
  muted: '143 137 124',
  gray: '188 184 174',
  red: '255 75 64',
  green: '86 218 142',
  // Border-only inherit (slightly darker than the glow/tint inherit).
  borderInherit: '235 226 205',
} as const;

const rgbToHex = (channels: string) => (
  `#${channels.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`
);

const rgba = (channels: string, alpha: number) => `rgba(${channels.replaceAll(' ', ', ')}, ${alpha})`;

// Glow exposes a display color that may differ from its tint channels
// (brass/cyan/red read brighter when glowing). Default display = the tone's rgb.
const glow = (tone: MaterialTone, alpha: number, display: string = rgb[tone]) => ({
  color: rgba(display, alpha),
  rgb: rgb[tone],
});

export const glowColors: Record<MaterialTone, { color: string; rgb: string }> = {
  none: { color: 'transparent', rgb: rgb.none },
  inherit: glow('inherit', 0.92),
  black: glow('black', 0.98),
  brass: glow('brass', 0.98, '255 210 105'),
  gold: glow('gold', 0.98),
  cyan: glow('cyan', 0.95, '77 220 255'),
  white: glow('white', 0.92),
  muted: glow('muted', 0.92),
  gray: glow('gray', 0.94),
  red: glow('red', 0.96, '255 92 83'),
  green: glow('green', 0.96),
};

export const tintColors: Record<MaterialTone, { rgb: string }> = {
  none: { rgb: rgb.none },
  inherit: { rgb: rgb.inherit },
  black: { rgb: rgb.black },
  brass: { rgb: rgb.brass },
  gold: { rgb: rgb.gold },
  cyan: { rgb: rgb.cyan },
  white: { rgb: rgb.white },
  muted: { rgb: rgb.muted },
  gray: { rgb: rgb.gray },
  red: { rgb: rgb.red },
  green: { rgb: rgb.green },
};

export const baseColors: Record<Exclude<MaterialKind, 'none' | 'custom'>, string> = {
  black: rgbToHex(rgb.pureBlack),
  white: rgbToHex(rgb.pureWhite),
  gray: rgbToHex(rgb.pureGray),
};

export const borderColorRgb: Record<Exclude<BorderColorKind, 'custom'>, string> = {
  inherit: rgb.borderInherit,
  black: rgb.pureBlack,
  white: rgb.pureWhite,
  gray: rgb.pureGray,
};

export const normalizeHexColor = (value: string | undefined) => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#808080'
);

export const hexToRgb = (value: string | undefined) => {
  const hex = normalizeHexColor(value).slice(1);
  const channels = hex.match(/.{2}/g)?.map((channel) => parseInt(channel, 16)) || [128, 128, 128];
  return channels.join(' ');
};

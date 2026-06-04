import type { MaterialTone } from './MaterialRecipeTypes';
import type { BorderColorKind, CornerName, MaterialKind } from './surfaceSchema';

// Color/tone tables and hex utilities for the surface. Pure data — the feature
// pipeline reads these to build CSS variables.

export const allCorners: CornerName[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

export const glowColors: Record<MaterialTone, { color: string; rgb: string }> = {
  none: { color: 'transparent', rgb: '0 0 0' },
  inherit: { color: 'rgba(244, 238, 224, 0.92)', rgb: '244 238 224' },
  black: { color: 'rgba(23, 20, 15, 0.98)', rgb: '23 20 15' },
  brass: { color: 'rgba(255, 210, 105, 0.98)', rgb: '255 188 72' },
  gold: { color: 'rgba(248, 215, 112, 0.98)', rgb: '248 215 112' },
  cyan: { color: 'rgba(77, 220, 255, 0.95)', rgb: '55 190 255' },
  white: { color: 'rgba(255, 255, 255, 0.92)', rgb: '255 255 255' },
  muted: { color: 'rgba(143, 137, 124, 0.92)', rgb: '143 137 124' },
  gray: { color: 'rgba(188, 184, 174, 0.94)', rgb: '188 184 174' },
  red: { color: 'rgba(255, 92, 83, 0.96)', rgb: '255 75 64' },
  green: { color: 'rgba(86, 218, 142, 0.96)', rgb: '86 218 142' },
};

export const tintColors: Record<MaterialTone, { rgb: string }> = {
  none: { rgb: '0 0 0' },
  inherit: { rgb: '244 238 224' },
  black: { rgb: '23 20 15' },
  brass: { rgb: '255 188 72' },
  gold: { rgb: '248 215 112' },
  cyan: { rgb: '55 190 255' },
  white: { rgb: '255 255 255' },
  muted: { rgb: '143 137 124' },
  gray: { rgb: '188 184 174' },
  red: { rgb: '255 75 64' },
  green: { rgb: '86 218 142' },
};

export const baseColors: Record<Exclude<MaterialKind, 'none' | 'custom'>, string> = {
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
};

export const borderColorRgb: Record<Exclude<BorderColorKind, 'custom'>, string> = {
  inherit: '235 226 205',
  black: '0 0 0',
  white: '255 255 255',
  gray: '128 128 128',
};

export const normalizeHexColor = (value: string | undefined) => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#808080'
);

export const hexToRgb = (value: string | undefined) => {
  const hex = normalizeHexColor(value).slice(1);
  const channels = hex.match(/.{2}/g)?.map((channel) => parseInt(channel, 16)) || [128, 128, 128];
  return channels.join(' ');
};

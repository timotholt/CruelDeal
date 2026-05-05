import type { MicroLandmarkShape } from './types';

export const VIEW_W = 1440;
export const VIEW_H = 1792;
export const MAP_SLOT_HALF_W = 54;
export const MAP_SLOT_HALF_H = 76;
export const MAP_SLOT_EDGE_PAD = 120;

export const LAND_RX = VIEW_W * 0.68;
export const LAND_RY = VIEW_H * 0.68;

export const CELL_UNIT = 104;

export const DISTRICT_NAMES = [
  'DOWNTOWN',
  'ROPPONGI',
  'SHIBUYA',
  'ASAKUSA',
  'SHINJUKU',
  'AKIHABARA',
  'GINZA',
  'UENO',
  'HARAJUKU',
  'EBISU',
  'MEGURO',
  'SETAGAYA',
  'KOTO',
  'OTSUKA',
  'NAKANO',
] as const;

export type DistrictName = (typeof DISTRICT_NAMES)[number];

export const DISTRICT_SHORT_NAMES: Partial<Record<DistrictName, string>> = {
  DOWNTOWN: 'DWN',
  ROPPONGI: 'RPN',
  SHIBUYA: 'SHB',
  ASAKUSA: 'ASA',
  SHINJUKU: 'SNJ',
  AKIHABARA: 'AKB',
  HARAJUKU: 'HRJ',
  SETAGAYA: 'STG',
  MEGURO: 'MGR',
  OTSUKA: 'OTS',
  NAKANO: 'NKN',
};

export const DISTRICT_COLORS = [
  '#ff6ea0',
  '#5dffe6',
  '#ffd05d',
  '#a98dff',
  '#7dff9b',
  '#ff945d',
] as const;

export const MICRO_LANDMARK_SHAPES: readonly MicroLandmarkShape[] = [
  { unitSize: 3, points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }] },
  { unitSize: 4, points: [{ x: 0, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 3 }, { x: 0, y: 3 }] },
  { unitSize: 4, points: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 1, y: 4 }] },
  { unitSize: 4, points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 0, y: 4 }] },
  { unitSize: 4, points: [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 2 }, { x: 2, y: 2 }] },
  { unitSize: 4, points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 2 }, { x: 0, y: 2 }] },
  { unitSize: 4, points: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 3 }, { x: 0, y: 3 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { unitSize: 5, points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }, { x: 0, y: 2 }] },
  { unitSize: 4, points: [{ x: 0, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 0, y: 4 }] },
] as const;

export const MAP_HUE = 223;
export const MAP_SAT = 100;

export const PAL = {
  water: `hsl(${MAP_HUE}, 58%, 9%)`,
  land: `hsl(${MAP_HUE}, 58%, 18%)`,
  bldgA: `hsla(${MAP_HUE}, 54%, 38%, 0.43)`,
  bldgB: `hsla(${MAP_HUE}, 50%, 47%, 0.40)`,
  roundBldg: `hsla(${MAP_HUE}, 62%, 46%, 0.58)`,
  streetLocal: `hsla(${MAP_HUE}, 88%, 68%, 0.88)`,
  streetMain: `hsla(${MAP_HUE}, 88%, 74%, 0.90)`,
  coastRoad: `hsla(${MAP_HUE}, 88%, 45%, 0.78)`,
  riverOutline: `hsla(${MAP_HUE}, 88%, 52%, 0.65)`,
  avenue: `hsla(${MAP_HUE}, 88%, 70%, 0.82)`,
  hwyOuter: `hsla(${MAP_HUE}, 88%, 54%, 0.42)`,
  hwyInner: `hsla(${MAP_HUE}, 88%, 76%, 0.88)`,
  regionLine: `hsla(${MAP_HUE}, 88%, 68%, 0.78)`,
  regionGlow: `hsla(${MAP_HUE}, 88%, 60%, 0.38)`,
  park: `hsla(${MAP_HUE}, 58%, 42%, 0.38)`,
  plaza: `hsla(${MAP_HUE}, 48%, 40%, 0.58)`,
  stadium: `hsla(${MAP_HUE}, 54%, 36%, 0.62)`,
  stadiumField: `hsla(${MAP_HUE}, 56%, 44%, 0.66)`,
  fieldLine: `hsla(${MAP_HUE}, 88%, 66%, 0.55)`,
  diamond: `hsla(${MAP_HUE}, 50%, 48%, 0.72)`,
  mall: `hsla(${MAP_HUE}, 82%, 42%, 0.28)`,
  mallAccent: `hsla(${MAP_HUE}, 96%, 70%, 0.48)`,
  mallHighlight: `hsla(${MAP_HUE}, 100%, 74%, 0.12)`,
  label: `hsl(${MAP_HUE}, 82%, 68%)`,
  labelGlow: `hsla(${MAP_HUE}, 88%, 60%, 0.58)`,
  labelStroke: `hsla(${MAP_HUE}, 70%, 18%, 0.24)`,
} as const;

export const CSS_VARS = {
  coastRoad: '--map-coast-road',
  riverOutline: '--map-river-outline',
} as const;

export const CITY_MAP_CONFIG = {
  VIEW_W,
  VIEW_H,
  MAP_SLOT_HALF_W,
  MAP_SLOT_HALF_H,
  MAP_SLOT_EDGE_PAD,
  LAND_RX,
  LAND_RY,
  CELL_UNIT,
  DISTRICT_NAMES,
  DISTRICT_SHORT_NAMES,
  DISTRICT_COLORS,
  MICRO_LANDMARK_SHAPES,
  MAP_HUE,
  MAP_SAT,
  PAL,
  CSS_VARS,
} as const;

import type { ShinyMaterialDefinition, ShinyMaterialId, ShinyStop } from './types';

const goldStops: ShinyStop[] = [
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
];

const silverStops: ShinyStop[] = [
  { offset: 0, color: '#EBEFF5' },
  { offset: 25, color: '#B5B9BF' },
  { offset: 50, color: '#EDF1F7' },
  { offset: 75, color: '#83878D' },
  { offset: 100, color: '#CED2D8' }
];

const bronzeStops: ShinyStop[] = [
  { offset: 0, color: '#55411B' },
  { offset: 15, color: '#997E47' },
  { offset: 30, color: '#55411B' },
  { offset: 45, color: '#FFFDDA' },
  { offset: 60, color: '#D5BB8A' },
  { offset: 75, color: '#B8A269' },
  { offset: 85, color: '#55411B' },
  { offset: 100, color: '#FBECA9' }
];

const markStops: ShinyStop[] = [
  { offset: 0, color: '#9CA3AF' },
  { offset: 25, color: '#4B5563' },
  { offset: 50, color: '#1F2937' },
  { offset: 75, color: '#111827' },
  { offset: 100, color: '#374151' }
];

const engravedStops: ShinyStop[] = [
  { offset: 0, color: '#DAA520' },
  { offset: 26, color: '#D5AD6D' },
  { offset: 35, color: '#E2BA78' },
  { offset: 45, color: '#A37E43' },
  { offset: 61, color: '#D4AF37' },
  { offset: 100, color: '#D5AD6D' }
];

export const SHINY_MATERIALS: Record<ShinyMaterialId, ShinyMaterialDefinition> = {
  gold: { id: 'gold', displayName: 'Gold', highlight: '#FFFDDA', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 1337, stops: goldStops },
  silver: { id: 'silver', displayName: 'Silver', highlight: '#EBEFF5', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 2112, stops: silverStops },
  bronze: { id: 'bronze', displayName: 'Bronze', highlight: '#FFFDDA', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 3001, stops: bronzeStops },
  kan: { id: 'kan', displayName: 'Kan', highlight: '#FFFDDA', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 4001, stops: goldStops },
  credit: {
    id: 'credit',
    displayName: 'Credit',
    highlight: '#93c5fd',
    angle: 135,
    textureSize: 512,
    smallTextureSize: 128,
    grain: 8,
    seed: 5001,
    stops: [
      { offset: 0, color: '#1e3a8a' },
      { offset: 50, color: '#3b82f6' },
      { offset: 100, color: '#1d4ed8' },
    ],
  },
  mark: { id: 'mark', displayName: 'Mark', highlight: '#f3f4f6', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 6001, stops: markStops },
  engraved: { id: 'engraved', displayName: 'Engraved', highlight: '#FFF3C2', angle: 180, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 7001, stops: engravedStops },
};

export const SHINY_MATERIAL_IDS = Object.keys(SHINY_MATERIALS) as ShinyMaterialId[];

export const shinySvgStops = (spec: Pick<ShinyMaterialDefinition, 'stops'>) =>
  spec.stops.map((s) => ({ offset: `${s.offset}%`, color: s.color }));

export const shinyCssGradient = (spec: Pick<ShinyMaterialDefinition, 'angle' | 'stops'>) =>
  `linear-gradient(${spec.angle}deg, ${spec.stops.map((s) => `${s.color} ${s.offset}%`).join(', ')})`;

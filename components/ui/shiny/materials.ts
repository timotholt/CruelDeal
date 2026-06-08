import type { MetalId, MetalSpec, ShinyMaterialDefinition, ShinyMaterialId, ShinyStop } from './types';

export const LEGACY_AUTHORING_PRESETS: Record<string, ShinyStop[]> = {
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
  ],
  Engraved: [
    { offset: 0, color: '#DAA520' },
    { offset: 26, color: '#D5AD6D' },
    { offset: 35, color: '#E2BA78' },
    { offset: 45, color: '#A37E43' },
    { offset: 61, color: '#D4AF37' },
    { offset: 100, color: '#D5AD6D' }
  ]
};

export const PRESETS = LEGACY_AUTHORING_PRESETS;

export const SHINY_MATERIALS: Record<ShinyMaterialId, ShinyMaterialDefinition> = {
  gold: { id: 'gold', displayName: 'Gold', highlight: '#FFFDDA', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 1337, stops: PRESETS.J },
  silver: { id: 'silver', displayName: 'Silver', highlight: '#EBEFF5', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 2112, stops: PRESETS.D },
  bronze: { id: 'bronze', displayName: 'Bronze', highlight: '#FFFDDA', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 3001, stops: PRESETS.G },
  kan: { id: 'kan', displayName: 'Kan', highlight: '#FFFDDA', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 4001, stops: PRESETS.J },
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
  mark: { id: 'mark', displayName: 'Mark', highlight: '#f3f4f6', angle: 135, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 6001, stops: PRESETS.F },
  engraved: { id: 'engraved', displayName: 'Engraved', highlight: '#FFF3C2', angle: 180, textureSize: 512, smallTextureSize: 128, grain: 8, seed: 7001, stops: PRESETS.Engraved },
};

export const METALS: Record<MetalId, MetalSpec> = {
  ...SHINY_MATERIALS,
  brass: { ...SHINY_MATERIALS.bronze, id: 'brass', displayName: 'Brass' },
};

export const PROFILE_TO_METAL: Partial<Record<string, MetalId>> = {
  J: 'gold',
  D: 'silver',
  G: 'brass',
  F: 'mark',
  Engraved: 'engraved',
};

export const toShinyMaterialId = (id: MetalId): ShinyMaterialId => (id === 'brass' ? 'bronze' : id);

export const metalSvgStops = (spec: Pick<MetalSpec, 'stops'>) =>
  spec.stops.map((s) => ({ offset: `${s.offset}%`, color: s.color }));

export const metalCssGradient = (spec: Pick<MetalSpec, 'angle' | 'stops'>) =>
  `linear-gradient(${spec.angle}deg, ${spec.stops.map((s) => `${s.color} ${s.offset}%`).join(', ')})`;

import type { ShinyMaterialId, ShinyStop } from '../../ui/shiny';

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

export const PROFILE_TO_METAL: Partial<Record<string, ShinyMaterialId>> = {
  J: 'gold',
  D: 'silver',
  G: 'bronze',
  F: 'mark',
  Engraved: 'engraved',
};

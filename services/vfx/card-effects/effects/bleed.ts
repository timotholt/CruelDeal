import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const bleedCardFx: CardFxDefinition = {
  kind: 'bleed',
  className: 'card-fx-bleed',
  defaultPalette: { primary: '#cc1122', secondary: '#ff4455', accent: '#440008' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#cc1122',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#ff4455',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#440008',
      },
    };
  },
};

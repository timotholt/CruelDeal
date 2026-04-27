import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const electricCardFx: CardFxDefinition = {
  kind: 'electric',
  className: 'card-fx-electric',
  defaultPalette: { primary: '#70e1f5', secondary: '#ffffff', accent: '#0055aa' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#70e1f5',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#ffffff',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#0055aa',
        '--card-fx-seed': String(Math.floor(Math.random() * 100)),
      },
    };
  },
};

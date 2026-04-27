import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const poisonCardFx: CardFxDefinition = {
  kind: 'poison',
  className: 'card-fx-poison',
  defaultPalette: { primary: '#7b2d8b', secondary: '#4a7c40', accent: '#1a0a1f' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#7b2d8b',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#4a7c40',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#1a0a1f',
      },
    };
  },
};

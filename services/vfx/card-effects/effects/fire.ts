import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const fireCardFx: CardFxDefinition = {
  kind: 'fire',
  className: 'card-fx-fire',
  defaultPalette: { primary: '#ff6a1a', secondary: '#ffcf5a', accent: '#7a1200' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#ff6a1a',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#ffcf5a',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#7a1200',
      },
    };
  },
};

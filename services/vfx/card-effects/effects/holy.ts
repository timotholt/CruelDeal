import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const holyCardFx: CardFxDefinition = {
  kind: 'holy',
  className: 'card-fx-holy',
  defaultPalette: { primary: '#ffd700', secondary: '#fffbe6', accent: '#c8860a' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#ffd700',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#fffbe6',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#c8860a',
      },
    };
  },
};

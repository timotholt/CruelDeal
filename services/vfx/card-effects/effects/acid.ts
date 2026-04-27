import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const acidCardFx: CardFxDefinition = {
  kind: 'acid',
  className: 'card-fx-acid',
  defaultPalette: { primary: '#aaff00', secondary: '#ccff44', accent: '#3a5c00' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 3 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(Math.min(sumIntensity(sources), 3)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#aaff00',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#ccff44',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#3a5c00',
      },
    };
  },
};

import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const iceCardFx: CardFxDefinition = {
  kind: 'ice',
  className: 'card-fx-ice',
  defaultPalette: { primary: '#7ee8fa', secondary: '#b2f0ff', accent: '#1a6080' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#7ee8fa',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#b2f0ff',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#1a6080',
      },
    };
  },
};

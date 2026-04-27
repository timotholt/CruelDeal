import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const barrierCardFx: CardFxDefinition = {
  kind: 'barrier',
  className: 'card-fx-barrier',
  defaultPalette: { primary: '#4488ff', secondary: '#88bbff', accent: '#001a44' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#4488ff',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#88bbff',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#001a44',
      },
    };
  },
};

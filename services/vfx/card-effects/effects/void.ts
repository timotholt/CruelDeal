import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const voidCardFx: CardFxDefinition = {
  kind: 'void',
  className: 'card-fx-void',
  defaultPalette: { primary: '#330066', secondary: '#6600cc', accent: '#000011' },
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#330066',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#6600cc',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#000011',
      },
    };
  },
};

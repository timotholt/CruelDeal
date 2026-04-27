import type { CardFxDefinition, CardPersistentFxSource } from '../types';

export const stealthCardFx: CardFxDefinition = {
  kind: 'stealth',
  className: 'card-fx-stealth',
  defaultPalette: { primary: '#aaccdd', secondary: '#ffffff', accent: '#224433' },
  aggregate(sources) {
    return {
      renderMode: 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sources[0]?.intensity ?? 1),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#aaccdd',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#ffffff',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#224433',
        '--card-fx-opacity': '0.65',
      },
    };
  },
};

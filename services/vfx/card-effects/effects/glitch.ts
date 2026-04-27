import type { CardFxDefinition, CardPersistentFxSource } from '../types';

const sumIntensity = (sources: readonly CardPersistentFxSource[]): number =>
  sources.reduce((s, src) => s + (src.intensity ?? 1), 0);

export const glitchCardFx: CardFxDefinition = {
  kind: 'glitch',
  className: 'card-fx-glitch',
  defaultPalette: { primary: '#ff2255', secondary: '#00ffcc', accent: '#2200ff' },
  aggregate(sources) {
    return {
      renderMode: 'prioritized',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(Math.min(sumIntensity(sources), 2)),
        '--card-fx-primary': sources[0]?.palette?.primary ?? '#ff2255',
        '--card-fx-secondary': sources[0]?.palette?.secondary ?? '#00ffcc',
        '--card-fx-accent': sources[0]?.palette?.accent ?? '#2200ff',
      },
    };
  },
};

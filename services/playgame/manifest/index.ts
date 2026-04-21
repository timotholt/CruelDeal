/**
 * Manifest — public surface.
 *
 * Exports the bootstrap manifest that the engine consumes during the
 * refactor. Phase 1 will populate `cards` and `locations` by migrating
 * the current `CARD_POOL` + `LOCATIONS` into per-card/-location
 * subdirectories with `card.ts` / `location.ts` files, globbed at build
 * time via `import.meta.glob`.
 *
 * For now this is an empty stub so engine signatures can accept
 * `manifest: GameManifest` from day one without a chicken-and-egg
 * situation.
 */

import type { GameManifest } from './types';

export type * from './types';

/**
 * Placeholder manifest used while Phase 1 is in flight. Contains no
 * cards or locations; all downstream code that reads from it must
 * tolerate empty pools during the migration window.
 */
export const BOOTSTRAP_MANIFEST: GameManifest = {
  version: 0,
  protocolVersion: 1,
  constants: {
    energyCurve: [1, 2, 3, 4, 5, 6],
    turnLimit: 6,
    handCap: 7,
    laneCapacity: 4,
    deckSize: 12,
  },
  cards: [],
  locations: [],
  cosmetics: {
    cards: {},
    locations: {},
  },
  disabled: {
    cards: [],
    locations: [],
  },
};

/**
 * Launch location set (3 entries) for Galactic Snap / Spec 0.2.
 *
 * Each location is pinned 1:1 to one of the three map images under
 * `public/art/maps/`. Ability designs are deliberately varied so the
 * Step 4 projection tests exercise three different Ongoing primitives:
 *
 *   - Cathedral    → ON_REVEAL_MULTIPLIER  (Kamar-Taj / Wong-style)
 *   - Jungle Trail → POWER_ADD w/ dynamic COUNT delta (density reward)
 *   - Science Lab  → LANE_POWER_MULTIPLIER (Iron-Man-as-location)
 *
 * Context note for selectors used below:
 *   - Inside a location Ongoing, `{ kind: 'SELF' }` resolves to the
 *     location instance. `{ kind: 'SAME_LANE', of: SELF }` is therefore
 *     "cards in this location's lane", which is exactly what these
 *     effects want. The Step 4 evaluator documents that convention.
 *
 * Note on asset filename: `Cathedrawl.png` is the original (typo'd)
 * filename in `public/art/maps/`. The displayName here is the correct
 * spelling ("Cathedral"). A future content PR can rename the asset
 * and update only the `path` field — everything else in-game already
 * reads "Cathedral".
 */

import type { LocationDef } from '../types';

export const CATHEDRAL: LocationDef = {
  defId: 'cathedral',
  version: 1,
  name: 'Cathedral',
  rarity: 1,
  abilities: {
    ongoing: [
      {
        kind: 'ON_REVEAL_MULTIPLIER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'CATHEDRAL',
    description: 'On Reveal effects here trigger twice.',
    accent: '#d4b87a',
    art: {
      map: { path: '/art/maps/Cathedrawl.png', kind: 'image' },
    },
  },
};

export const JUNGLE_TRAIL: LocationDef = {
  defId: 'jungle-trail',
  version: 1,
  name: 'Jungle Trail',
  rarity: 1,
  abilities: {
    ongoing: [
      {
        kind: 'POWER_ADD',
        // Every card at this lane (both sides) gets the bonus, but the
        // count is per the buffed card's OWN side — so "your cards here
        // get +1 per other friendly here", applied symmetrically.
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        delta: {
          kind: 'COUNT',
          of: {
            kind: 'SAME_LANE',
            of: { kind: 'SELF' },
            ownerFilter: 'SELF_OWNER',
            exclude: { kind: 'SELF' },
          },
        },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'JUNGLE TRAIL',
    description: 'Cards here get +1 Power for each other friendly card here.',
    accent: '#4a7c3f',
    art: {
      map: { path: '/art/maps/Jungle.png', kind: 'image' },
    },
  },
};

export const SCIENCE_LAB: LocationDef = {
  defId: 'science-lab',
  version: 1,
  name: 'Science Lab',
  rarity: 1,
  abilities: {
    ongoing: [
      {
        // Identical primitive to Iron Man: lane-level ANY_OWNER doubles
        // the total Power on each side independently. Exercises the
        // getLanePower projection (spec §5.1).
        kind: 'LANE_POWER_MULTIPLIER',
        laneScope: { laneOf: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'SCIENCE LAB',
    description: 'Both players\u2019 total Power is doubled here.',
    accent: '#6aa9d6',
    art: {
      map: { path: '/art/maps/Laboratory.png', kind: 'image' },
    },
  },
};

export const LOCATIONS_INDEX: readonly LocationDef[] = [
  CATHEDRAL,
  JUNGLE_TRAIL,
  SCIENCE_LAB,
];

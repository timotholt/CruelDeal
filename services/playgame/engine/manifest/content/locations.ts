/**
 * Current location set for Cruel Deal / Spec 0.2.
 *
 * Each location is pinned 1:1 to a map image under `public/art/maps/`.
 * The roster mixes passive auras and reveal-time effects so the location
 * pool feels more varied without depending on unimplemented trigger hooks.
 *
 * Context note for selectors used below:
 *   - Inside a location ability, `{ kind: 'SELF' }` resolves to the
 *     location instance. `{ kind: 'SAME_LANE', of: SELF }` therefore
 *     means "cards in this location's lane".
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
      map: { path: '/art/maps/Cathedral.png', kind: 'image' },
    },
  },
};

export const CATHEDRAL_CLOISTER: LocationDef = {
  defId: 'cathedral-cloister',
  version: 1,
  name: 'Cathedral Cloister',
  rarity: 1,
  abilities: {
    ongoing: [
      {
        kind: 'BOOST_ONGOINGS',
        scope: { laneOf: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'CATHEDRAL CLOISTER',
    description: 'Ongoing cards here have their Ongoing abilities doubled.',
    accent: '#b88f57',
    art: {
      map: { path: '/art/maps/Cathedral2.png', kind: 'image' },
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

export const FOOD_COURT: LocationDef = {
  defId: 'food-court',
  version: 1,
  name: 'Food Court',
  rarity: 1,
  abilities: {
    onReveal: [
      { kind: 'DRAW', owner: 'P0', count: { kind: 'LIT', n: 1 } },
      { kind: 'DRAW', owner: 'P1', count: { kind: 'LIT', n: 1 } },
    ],
  },
  cosmetic: {
    displayName: 'FOOD COURT',
    description: 'When revealed, each player draws a card.',
    accent: '#d96c3c',
    art: {
      map: { path: '/art/maps/FoodCourt.png', kind: 'image' },
    },
  },
};

export const HACKERS_LAIR: LocationDef = {
  defId: 'hackers-lair',
  version: 1,
  name: "Hackers' Lair",
  rarity: 1,
  abilities: {
    onReveal: [
      {
        kind: 'ADJUST_COST',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'HAND_OF', owner: 'P0' },
        },
        delta: { kind: 'LIT', n: 1 },
      },
      {
        kind: 'ADJUST_COST',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'HAND_OF', owner: 'P1' },
        },
        delta: { kind: 'LIT', n: 1 },
      },
    ],
  },
  cosmetic: {
    displayName: "HACKERS' LAIR",
    description: 'When revealed, a random card in each player hand costs 1 more.',
    accent: '#31d28a',
    art: {
      map: { path: '/art/maps/HackersLair.png', kind: 'image' },
    },
  },
};

export const ICY_ROAD: LocationDef = {
  defId: 'icy-road',
  version: 1,
  name: 'Icy Road',
  rarity: 1,
  abilities: {
    ongoing: [
      {
        kind: 'POWER_ADD',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        delta: { kind: 'LIT', n: -1 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'ICY ROAD',
    description: 'Cards here have -1 Power.',
    accent: '#8fd5e8',
    art: {
      map: { path: '/art/maps/IcyRoad.png', kind: 'image' },
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

export const LAVA_FLOW: LocationDef = {
  defId: 'lava-flow',
  version: 1,
  name: 'Lava Flow',
  rarity: 1,
  abilities: {
    ongoing: [
      {
        kind: 'POWER_ADD',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        delta: { kind: 'LIT', n: -2 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'LAVA FLOW',
    description: 'Cards here have -2 Power.',
    accent: '#ef6a2e',
    art: {
      map: { path: '/art/maps/LavaFlow.png', kind: 'image' },
    },
  },
};

export const TROPICAL_BEACH: LocationDef = {
  defId: 'tropical-beach',
  version: 1,
  name: 'Tropical Beach',
  rarity: 1,
  abilities: {
    ongoing: [
      {
        kind: 'POWER_ADD',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'TROPICAL BEACH',
    description: 'Cards here have +1 Power.',
    accent: '#f0c86a',
    art: {
      map: { path: '/art/maps/TropicalBeach.png', kind: 'image' },
    },
  },
};

export const ALIEN_STARSHIP: LocationDef = {
  defId: 'alien-starship',
  version: 1,
  name: 'Alien Starship',
  rarity: 1,
  abilities: {
    onReveal: [
      { kind: 'ADJUST_ENERGY', owner: 'P0', delta: { kind: 'LIT', n: 1 } },
      { kind: 'ADJUST_ENERGY', owner: 'P1', delta: { kind: 'LIT', n: 1 } },
    ],
  },
  cosmetic: {
    displayName: 'ALIEN STARSHIP',
    description: 'When revealed, each player gains 1 Energy.',
    accent: '#8d78ff',
    art: {
      map: { path: '/art/maps/AlienStarship.png', kind: 'image' },
    },
  },
};

export const LOCATIONS_INDEX: readonly LocationDef[] = [
  CATHEDRAL,
  CATHEDRAL_CLOISTER,
  JUNGLE_TRAIL,
  FOOD_COURT,
  HACKERS_LAIR,
  ICY_ROAD,
  SCIENCE_LAB,
  LAVA_FLOW,
  TROPICAL_BEACH,
  ALIEN_STARSHIP,
];

/**
 * Vantaris location set for Cruel Deal.
 *
 * Playable locations use ability primitives the current engine already
 * supports. Design-only locations are still exported into the manifest with
 * rarity 0 and are listed in `disabled.locations`; their desired rules are
 * preserved in cosmetic.description so the design work does not live only in
 * chat history.
 *
 * Context note for selectors used below:
 *   - Inside a location ability, `{ kind: 'SELF' }` resolves to the location
 *     instance. `{ kind: 'SAME_LANE', of: SELF }` means "cards in this lane".
 */

import type { EffectExpr, OngoingExpr, Predicate, Selector } from '../../types/ability';
import type { LocationDef } from '../types';

export const CRUEL_DEAL_CITY = {
  name: 'Vantaris',
  fullName: 'Vantaris Free Metro',
  publicSlogan: 'Tomorrow, financed today.',
  streetSlogan: 'Every miracle has interest.',
} as const;

type LocationStatus = 'playable' | 'unimplemented';

export interface LocationDesignEntry {
  status: LocationStatus;
  /** Short reason this is disabled, or the implementation primitive used. */
  implementationNote: string;
  def: LocationDef;
}

const MAPS = {
  cathedral: '/art/maps/Cathedral.png',
  cathedral2: '/art/maps/Cathedral2.png',
  jungle: '/art/maps/Jungle.png',
  foodCourt: '/art/maps/FoodCourt.png',
  hackersLair: '/art/maps/HackersLair.png',
  icyRoad: '/art/maps/IcyRoad.png',
  laboratory: '/art/maps/Laboratory.png',
  lavaFlow: '/art/maps/LavaFlow.png',
  beach: '/art/maps/TropicalBeach.png',
  starship: '/art/maps/AlienStarship.png',
} as const;

const self: Selector = { kind: 'SELF' };

const sameLane = (ownerFilter: 'ANY_OWNER' | 'SELF_OWNER' | 'OPP_OWNER' = 'ANY_OWNER'): Selector => ({
  kind: 'SAME_LANE',
  of: self,
  ownerFilter,
});

const cardsHereWhere = (pred: Predicate): Selector => ({
  kind: 'WHERE',
  of: sameLane(),
  pred,
});

const drawBoth = (count: number): EffectExpr[] => [
  { kind: 'DRAW', owner: 'P0', count: { kind: 'LIT', n: count } },
  { kind: 'DRAW', owner: 'P1', count: { kind: 'LIT', n: count } },
];

const randomHandCard = (owner: 'P0' | 'P1'): Selector => ({
  kind: 'RANDOM_N',
  count: { kind: 'LIT', n: 1 },
  of: { kind: 'HAND_OF', owner },
});

const powerHere = (delta: number): OngoingExpr[] => [{
  kind: 'POWER_ADD',
  target: sameLane(),
  delta: { kind: 'LIT', n: delta },
  stack: 'ADDITIVE',
}];

const playable = (
  defId: string,
  name: string,
  description: string,
  accent: string,
  mapPath: string,
  abilities: LocationDef['abilities'],
  implementationNote: string,
): LocationDesignEntry => ({
  status: 'playable',
  implementationNote,
  def: {
    defId,
    version: 1,
    name,
    rarity: 1,
    abilities,
    cosmetic: {
      displayName: name.toUpperCase(),
      description,
      accent,
      art: { map: { path: mapPath, kind: 'image' } },
    },
  },
});

const unimplemented = (
  defId: string,
  name: string,
  desiredEffect: string,
  accent: string,
  mapPath: string,
  implementationNote: string,
): LocationDesignEntry => ({
  status: 'unimplemented',
  implementationNote,
  def: {
    defId,
    version: 1,
    name,
    rarity: 0,
    abilities: {},
    cosmetic: {
      displayName: name.toUpperCase(),
      description: `UNIMPLEMENTED - ${desiredEffect}`,
      accent,
      art: { map: { path: mapPath, kind: 'image' } },
    },
  },
});

export const LOCATION_CATALOG: readonly LocationDesignEntry[] = [
  playable(
    'neon-reliquary',
    'Neon Reliquary',
    'On Reveal effects here trigger twice.',
    '#d4b87a',
    MAPS.cathedral,
    {
      ongoing: [{
        kind: 'ON_REVEAL_MULTIPLIER',
        target: sameLane(),
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      }],
    },
    'Implemented with ON_REVEAL_MULTIPLIER.',
  ),

  playable(
    'nanobot-factory',
    'Nanobot Factory',
    'Cards here get +1 Power for each other friendly card here.',
    '#31d28a',
    MAPS.jungle,
    {
      ongoing: [{
        kind: 'POWER_ADD',
        target: sameLane(),
        delta: {
          kind: 'COUNT',
          of: {
            kind: 'SAME_LANE',
            of: self,
            ownerFilter: 'SELF_OWNER',
            exclude: self,
          },
        },
        stack: 'ADDITIVE',
      }],
    },
    'Implemented with per-target friendly COUNT.',
  ),

  playable(
    'market-sprawl',
    'Market Sprawl',
    'When revealed, each player draws a card.',
    '#d96c3c',
    MAPS.foodCourt,
    { onReveal: drawBoth(1) },
    'Implemented with DRAW for both players.',
  ),

  playable(
    'noodle-bar',
    'Noodle Bar',
    'Cards here have +1 Power.',
    '#f0c86a',
    MAPS.foodCourt,
    { ongoing: powerHere(1) },
    'Implemented with POWER_ADD.',
  ),

  playable(
    'the-last-terminal',
    'The Last Terminal',
    'When revealed, a random card in each player hand costs 1 more.',
    '#31d28a',
    MAPS.hackersLair,
    {
      onReveal: [
        { kind: 'ADJUST_COST', target: randomHandCard('P0'), delta: { kind: 'LIT', n: 1 } },
        { kind: 'ADJUST_COST', target: randomHandCard('P1'), delta: { kind: 'LIT', n: 1 } },
      ],
    },
    'Implemented with ADJUST_COST against each hand.',
  ),

  playable(
    'cryo-storage',
    'Cryo-Storage',
    'Cards here have -1 Power.',
    '#8fd5e8',
    MAPS.icyRoad,
    { ongoing: powerHere(-1) },
    'Implemented with POWER_ADD -1.',
  ),

  playable(
    'helixdyne-lab',
    'HelixDyne Lab',
    'Both players total Power is doubled here.',
    '#6aa9d6',
    MAPS.laboratory,
    {
      ongoing: [{
        kind: 'LANE_POWER_MULTIPLIER',
        laneScope: { laneOf: self, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    'Implemented with LANE_POWER_MULTIPLIER.',
  ),

  playable(
    'fusion-plant',
    'Fusion Plant',
    'When revealed, each player gains 1 Energy.',
    '#8d78ff',
    MAPS.starship,
    {
      onReveal: [
        { kind: 'ADJUST_ENERGY', owner: 'P0', delta: { kind: 'LIT', n: 1 } },
        { kind: 'ADJUST_ENERGY', owner: 'P1', delta: { kind: 'LIT', n: 1 } },
      ],
    },
    'Implemented with ADJUST_ENERGY for both players.',
  ),

  playable(
    'chrome-beach',
    'Chrome Beach',
    'Cards here have +1 Power.',
    '#f0c86a',
    MAPS.beach,
    { ongoing: powerHere(1) },
    'Implemented with POWER_ADD.',
  ),

  playable(
    'charging-station',
    'Charging Station',
    'Ongoing cards here have +1 Power.',
    '#44c6ff',
    MAPS.starship,
    {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({ kind: 'HAS_ONGOING', target: self }),
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    'Implemented with HAS_ONGOING predicate plus POWER_ADD.',
  ),

  playable(
    'meridian-tower',
    'Meridian Tower',
    'Cards that cost 4, 5, or 6 have +2 Power here.',
    '#f7d06b',
    MAPS.cathedral2,
    {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({
          kind: 'AND',
          all: [
            { kind: 'COST_CMP', target: self, op: '>=', value: { kind: 'LIT', n: 4 } },
            { kind: 'COST_CMP', target: self, op: '<=', value: { kind: 'LIT', n: 6 } },
          ],
        }),
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    'Implemented with COST_CMP predicates.',
  ),

  playable(
    'kurotek-atrium',
    'KuroTek Atrium',
    'Ongoing cards here have their Ongoing abilities doubled.',
    '#b88f57',
    MAPS.cathedral2,
    {
      ongoing: [{
        kind: 'BOOST_ONGOINGS',
        scope: { laneOf: self, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    'Implemented with BOOST_ONGOINGS.',
  ),

  unimplemented(
    'organ-bank',
    'Organ Bank',
    'When revealed, give each player lowest-Power card here +3 Power.',
    '#ff6f91',
    MAPS.laboratory,
    'Needs per-owner location targeting from a neutral location source.',
  ),

  unimplemented(
    'chrome-depot',
    'Chrome Depot',
    'Cards added to this location have +2 Power.',
    '#c0c7d4',
    MAPS.starship,
    'Needs a location-level card-entered-lane trigger.',
  ),

  unimplemented(
    'red-needle',
    'Red Needle',
    'When a card is destroyed here, give a random friendly card here +2 Power.',
    '#ff365f',
    MAPS.lavaFlow,
    'Needs a location-level on-card-destroyed-here trigger.',
  ),

  playable(
    'grub-hub',
    'Grub Hub',
    'When revealed, each player draws a card, then discards a random card.',
    '#ff9f43',
    MAPS.foodCourt,
    {
      onReveal: [
        ...drawBoth(1),
        { kind: 'DISCARD', target: randomHandCard('P0') },
        { kind: 'DISCARD', target: randomHandCard('P1') },
      ],
    },
    'Implemented with DRAW plus DISCARD.',
  ),

  unimplemented(
    'black-halo',
    'Black Halo',
    'Cards with On Reveal have +2 Power here.',
    '#7b2ff7',
    MAPS.hackersLair,
    'Needs a HAS_ON_REVEAL predicate.',
  ),

  unimplemented(
    'the-cage',
    'The Cage',
    'Cards cannot move from this location.',
    '#d4af37',
    MAPS.icyRoad,
    'Needs a movement-blocking lane aura.',
  ),

  playable(
    'chip-swap',
    'Chip Swap',
    'When revealed, reduce a random card in each player hand by 1 Cost.',
    '#59ffa8',
    MAPS.hackersLair,
    {
      onReveal: [
        { kind: 'ADJUST_COST', target: randomHandCard('P0'), delta: { kind: 'LIT', n: -1 } },
        { kind: 'ADJUST_COST', target: randomHandCard('P1'), delta: { kind: 'LIT', n: -1 } },
      ],
    },
    'Implemented with ADJUST_COST -1.',
  ),

  playable(
    'netrunner-shrine',
    'Netrunner Shrine',
    'On Reveal effects here trigger twice.',
    '#b779ff',
    MAPS.cathedral,
    {
      ongoing: [{
        kind: 'ON_REVEAL_MULTIPLIER',
        target: sameLane(),
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      }],
    },
    'Implemented with ON_REVEAL_MULTIPLIER.',
  ),

  playable(
    'stock-exchange',
    'Stock Exchange',
    'Cards that had their Cost reduced have +3 Power here.',
    '#ffd166',
    MAPS.cathedral2,
    {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({ kind: 'COST_REDUCED', target: self }),
        delta: { kind: 'LIT', n: 3 },
        stack: 'ADDITIVE',
      }],
    },
    'Implemented with COST_REDUCED predicate.',
  ),

  unimplemented(
    'courthouse',
    'Courthouse',
    'Cards here cannot have their Power increased.',
    '#aab2bd',
    MAPS.cathedral2,
    'Needs a power-increase prevention aura.',
  ),

  playable(
    'data-chapel',
    'Data Chapel',
    'Cards with copied or disabled text have +3 Power here.',
    '#9cffcb',
    MAPS.cathedral,
    {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({
          kind: 'OR',
          any: [
            { kind: 'HAS_COPIED_TEXT', target: self },
            { kind: 'TEXT_DISABLED', target: self },
          ],
        }),
        delta: { kind: 'LIT', n: 3 },
        stack: 'ADDITIVE',
      }],
    },
    'Implemented with HAS_COPIED_TEXT/TEXT_DISABLED predicates.',
  ),

  playable(
    'ghost-market',
    'Ghost Market',
    'When revealed, add a random 1-Cost card to each player hand.',
    '#70e1f5',
    MAPS.foodCourt,
    {
      onReveal: [
        { kind: 'ADD_CARD_TO_HAND', pool: { kind: 'COST_RANGE', ownerDeck: 'P0', min: 1, max: 1 }, owner: 'P0' },
        { kind: 'ADD_CARD_TO_HAND', pool: { kind: 'COST_RANGE', ownerDeck: 'P1', min: 1, max: 1 }, owner: 'P1' },
      ],
    },
    'Implemented with ADD_CARD_TO_HAND and COST_RANGE.',
  ),

  unimplemented(
    'debt-alley',
    'Debt Alley',
    'The first card each player plays here gets -2 Power.',
    '#7f5af0',
    MAPS.icyRoad,
    'Needs per-owner first-card-played-here memory.',
  ),

  unimplemented(
    'skyrail',
    'Skyrail',
    'After you play a card here, move it to another location if possible.',
    '#58c7ff',
    MAPS.starship,
    'Needs a location-level after-card-played trigger.',
  ),

  unimplemented(
    'cold-vault',
    'Cold Vault',
    'Cards here cannot be destroyed.',
    '#8fd5e8',
    MAPS.icyRoad,
    'Needs a destroy-prevention lane aura for all destroy sources.',
  ),

  playable(
    'signal-pit',
    'Signal Pit',
    'Disable Ongoing effects here.',
    '#00f5d4',
    MAPS.hackersLair,
    {
      ongoing: [{
        kind: 'DISABLE_ONGOING',
        target: sameLane(),
        stack: 'SINGLE',
      }],
    },
    'Implemented with DISABLE_ONGOING aura.',
  ),

  playable(
    'drone-hive',
    'Drone Hive',
    'When revealed, add a 1-Power Drone here for each player.',
    '#adb5bd',
    MAPS.jungle,
    {
      onReveal: [
        { kind: 'ADD_CARD_TO_LANE', pool: { kind: 'DEF_ID_LIST', ids: ['cheap-drone'] }, owner: 'P0', to: self },
        { kind: 'ADD_CARD_TO_LANE', pool: { kind: 'DEF_ID_LIST', ids: ['cheap-drone'] }, owner: 'P1', to: self },
      ],
    },
    'Implemented with ADD_CARD_TO_LANE and cheap-drone token.',
  ),

  unimplemented(
    'patent-office',
    'Patent Office',
    'Cards with no ability text have +3 Power here.',
    '#d8dbe2',
    MAPS.cathedral2,
    'Needs a HAS_NO_ABILITY_TEXT predicate.',
  ),

  unimplemented(
    'backdoor',
    'Backdoor',
    'The next card each player plays here triggers its On Reveal twice.',
    '#5efc8d',
    MAPS.hackersLair,
    'Needs one-shot per-player lane memory.',
  ),

  unimplemented(
    'scrap-yard',
    'Scrap Yard',
    'Destroyed cards have +1 Power if they return to play.',
    '#a47148',
    MAPS.lavaFlow,
    'Needs returned-from-destroyed tracking.',
  ),

  playable(
    'power-sink',
    'Power Sink',
    'Cards here have -2 Power.',
    '#ef6a2e',
    MAPS.lavaFlow,
    { ongoing: powerHere(-2) },
    'Implemented with POWER_ADD -2.',
  ),

  unimplemented(
    'overclock-room',
    'Overclock Room',
    'The first card each player plays here gets +4 Power.',
    '#ffbe0b',
    MAPS.laboratory,
    'Needs per-owner first-card-played-here memory.',
  ),

  playable(
    'black-clinic',
    'Black Clinic',
    'When revealed, set the lowest-Power card here to 5 Power.',
    '#ff5d8f',
    MAPS.laboratory,
    {
      onReveal: [{
        kind: 'SET_POWER',
        target: { kind: 'MIN_POWER_OF', of: sameLane() },
        value: { kind: 'LIT', n: 5 },
      }],
    },
    'Implemented with SET_POWER and MIN_POWER_OF. Current version targets one lowest card overall.',
  ),
];

export const PLAYABLE_LOCATION_DEFS: readonly LocationDef[] = LOCATION_CATALOG
  .filter((entry) => entry.status === 'playable')
  .map((entry) => entry.def);

export const UNIMPLEMENTED_LOCATION_DEFS: readonly LocationDef[] = LOCATION_CATALOG
  .filter((entry) => entry.status === 'unimplemented')
  .map((entry) => entry.def);

export const DISABLED_LOCATION_IDS: readonly string[] = UNIMPLEMENTED_LOCATION_DEFS.map((loc) => loc.defId);

export const LOCATIONS_INDEX: readonly LocationDef[] = LOCATION_CATALOG.map((entry) => entry.def);

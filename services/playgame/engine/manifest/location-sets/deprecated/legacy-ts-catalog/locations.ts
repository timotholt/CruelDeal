/**
 * Vantaris location set for Cruel Deal.
 *
 * `LOCATION_SPECS` is the source of truth: one compact row per location, with
 * the map path next to the playable/design data. The manifest adapter below
 * derives `defId`, `displayName`, rarity, and disabled status so authors do
 * not have to repeat the same location name in multiple fields.
 *
 * Context note for selectors used below:
 *   - Inside a location ability, `{ kind: 'SELF' }` resolves to the location
 *     instance. `{ kind: 'SAME_LANE', of: SELF }` means "cards in this lane".
 */

import type { EffectExpr, OngoingExpr, OwnerFilter, OwnerRef, Predicate, Selector } from '../../types/ability';
import type { LocationCardDef } from '../types';

export const CRUEL_DEAL_CITY = {
  name: 'Vantaris',
  fullName: 'Vantaris Free Metro',
  publicSlogan: 'Tomorrow, financed today.',
  streetSlogan: 'Every miracle has interest.',
} as const;

type LocationStatus = 'playable' | 'unimplemented';
type LocationAbilities = LocationCardDef['abilities'];

export interface LocationDesignEntry {
  status: LocationStatus;
  /** Short reason this is disabled, or the implementation primitive used. */
  implementationNote: string;
  def: LocationCardDef;
}

interface LocationSpec {
  status: LocationStatus;
  name: string;
  text: string;
  map: string;
  accent: string;
  abilities?: LocationAbilities;
  note: string;
}

const self: Selector = { kind: 'SELF' };

const eventCard: Selector = { kind: 'EVENT_CARD' };

const sameLane = (ownerFilter: OwnerFilter = 'ANY_OWNER'): Selector => ({
  kind: 'SAME_LANE',
  of: self,
  ownerFilter,
});

const cardsHereWhere = (pred: Predicate): Selector => ({
  kind: 'WHERE',
  of: sameLane(),
  pred,
});

const randomHandCard = (owner: 'P0' | 'P1'): Selector => ({
  kind: 'RANDOM_N',
  count: { kind: 'LIT', n: 1 },
  of: { kind: 'HAND_OF', owner },
});

const randomCardToHand = (owner: 'P0' | 'P1'): EffectExpr => ({
  kind: 'CREATE_CARDS_IN_ZONE',
  count: { kind: 'LIT', n: 1 },
  replacement: 'WITH_REPLACEMENT',
  pool: { kind: 'ANY_RANDOM', ownerFilter: 'ANY_OWNER' },
  owner,
  destination: { kind: 'HAND' },
});

const randomCostCardToHand = (owner: 'P0' | 'P1', cost: number): EffectExpr => ({
  kind: 'CREATE_CARDS_IN_ZONE',
  count: { kind: 'LIT', n: 1 },
  replacement: 'WITH_REPLACEMENT',
  pool: { kind: 'COST_RANGE', ownerDeck: owner, min: cost, max: cost },
  owner,
  destination: { kind: 'HAND' },
});

const moveCardToHand = (owner: 'P0' | 'P1'): EffectExpr => ({
  kind: 'CREATE_CARDS_IN_ZONE',
  count: { kind: 'LIT', n: 1 },
  replacement: 'WITH_REPLACEMENT',
  pool: {
    kind: 'DEF_ID_LIST',
    ids: ['neon-courier', 'getaway-driver', 'rooftop-runner', 'traffic-spoofer', 'escape-route'],
  },
  owner,
  destination: { kind: 'HAND' },
});

const powerHere = (delta: number): OngoingExpr[] => [{
  kind: 'POWER_ADD',
  target: sameLane(),
  delta: { kind: 'LIT', n: delta },
  stack: 'ADDITIVE',
}];

const currentTurn = (op: '<' | '<=' | '==' | '>=' | '>', n: number): Predicate => ({
  kind: 'NUM_CMP',
  a: { kind: 'CURRENT_TURN' },
  op,
  b: { kind: 'LIT', n },
});

const locationCounterIs = (name: string, op: '<' | '<=' | '==' | '>=' | '>', n: number, owner?: OwnerRef): Predicate => ({
  kind: 'NUM_CMP',
  a: { kind: 'LOCATION_COUNTER', name, owner },
  op,
  b: { kind: 'LIT', n },
});

const bumpLocationCounter = (name: string, owner?: OwnerRef): EffectExpr => ({
  kind: 'MODIFY_LOCATION_COUNTER',
  lane: self,
  name,
  owner,
  delta: { kind: 'LIT', n: 1 },
});

const p = (spec: Omit<LocationSpec, 'status'>): LocationSpec => ({
  status: 'playable',
  ...spec,
});

const slug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const toCatalogEntry = (spec: LocationSpec): LocationDesignEntry => ({
  status: spec.status,
  implementationNote: spec.note,
  def: {
    defId: slug(spec.name),
    version: 1,
    name: spec.name,
    rarity: spec.status === 'playable' ? 1 : 0,
    abilities: spec.abilities ?? {},
    cosmetic: {
      displayName: spec.name.toUpperCase(),
      description: spec.status === 'playable' ? spec.text : `UNIMPLEMENTED - ${spec.text}`,
      accent: spec.accent,
      art: { map: { path: spec.map, kind: 'image' } },
    },
  },
});

export const LOCATION_SPECS: readonly LocationSpec[] = [
  p({
    name: 'Neon Reliquary',
    text: 'On Reveal effects here trigger twice.',
    map: '/art/maps/Cathedral.png',
    accent: '#d4b87a',
    abilities: {
      ongoing: [{
        kind: 'ON_REVEAL_MULTIPLIER',
        target: sameLane(),
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      }],
    },
    note: 'Implemented with ON_REVEAL_MULTIPLIER.',
  }),

  p({
    name: 'Dark Alley',
    text: 'Cards here get +1 Power for each other friendly card here.',
    map: '/art/maps/Jungle.png',
    accent: '#31d28a',
    abilities: {
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
    note: 'Implemented with per-target friendly COUNT.',
  }),

  p({
    name: 'Chrome Depot',
    text: 'When revealed, each player adds a random 1-Cost card to their hand.',
    map: '/art/maps/FoodCourt.png',
    accent: '#d96c3c',
    abilities: {
      onReveal: [
        randomCostCardToHand('P0', 1),
        randomCostCardToHand('P1', 1),
      ],
    },
    note: 'Implemented with CREATE_CARDS_IN_ZONE and COST_RANGE 1.',
  }),

  p({
    name: 'Ammo Club',
    text: 'Cards here have +1 Power.',
    map: '/art/maps/FoodCourt.png',
    accent: '#f0c86a',
    abilities: { ongoing: powerHere(1) },
    note: 'Implemented with POWER_ADD.',
  }),

  p({
    name: 'Cryo-Storage',
    text: 'When revealed, a random card in each player hand costs 1 more.',
    map: '/art/maps/HackersLair.png',
    accent: '#31d28a',
    abilities: {
      onReveal: [
        { kind: 'ADJUST_COST', target: randomHandCard('P0'), delta: { kind: 'LIT', n: 1 } },
        { kind: 'ADJUST_COST', target: randomHandCard('P1'), delta: { kind: 'LIT', n: 1 } },
      ],
    },
    note: 'Implemented with ADJUST_COST against each hand.',
  }),

  p({
    name: 'Public Pool',
    text: 'Cards here have -1 Power.',
    map: '/art/maps/IcyRoad.png',
    accent: '#8fd5e8',
    abilities: { ongoing: powerHere(-1) },
    note: 'Implemented with POWER_ADD -1.',
  }),

  p({
    name: 'HelixDyne Lab',
    text: 'Both players total Power is doubled here.',
    map: '/art/maps/Laboratory.png',
    accent: '#6aa9d6',
    abilities: {
      ongoing: [{
        kind: 'LANE_POWER_MULTIPLIER',
        laneScope: { laneOf: self, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    note: 'Implemented with LANE_POWER_MULTIPLIER.',
  }),

  p({
    name: 'Supercharging Station',
    text: 'When revealed, each player gains 1 Energy.',
    map: '/art/maps/AlienStarship.png',
    accent: '#8d78ff',
    abilities: {
      onReveal: [
        { kind: 'ADJUST_ENERGY', owner: 'P0', delta: { kind: 'LIT', n: 1 } },
        { kind: 'ADJUST_ENERGY', owner: 'P1', delta: { kind: 'LIT', n: 1 } },
      ],
    },
    note: 'Implemented with ADJUST_ENERGY for both players.',
  }),

  p({
    name: 'Chrome Beach',
    text: 'No cards can be played here after turn 5.',
    map: '/art/maps/TropicalBeach.png',
    accent: '#f0c86a',
    abilities: {
      ongoing: [{
        kind: 'BLOCK_PLAY',
        laneOf: self,
        when: currentTurn('>', 5),
        stack: 'SINGLE',
      }],
    },
    note: 'Implemented with turn-aware BLOCK_PLAY.',
  }),

  p({
    name: 'Charging Station',
    text: 'Ongoing cards here have +1 Power.',
    map: '/art/maps/AlienStarship.png',
    accent: '#44c6ff',
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({ kind: 'HAS_ONGOING', target: self }),
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    note: 'Implemented with HAS_ONGOING predicate plus POWER_ADD.',
  }),

  p({
    name: 'Meridian Tower',
    text: 'Cards that cost 4, 5, or 6 have +2 Power here.',
    map: '/art/maps/Cathedral2.png',
    accent: '#f7d06b',
    abilities: {
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
    note: 'Implemented with COST_CMP predicates.',
  }),

  p({
    name: 'KuroTek Atrium',
    text: 'Ongoing cards here have their Ongoing abilities doubled.',
    map: '/art/maps/Cathedral2.png',
    accent: '#b88f57',
    abilities: {
      ongoing: [{
        kind: 'BOOST_ONGOINGS',
        scope: { laneOf: self, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    note: 'Implemented with BOOST_ONGOINGS.',
  }),

  p({
    name: 'Organ Bank',
    text: 'After turn 4, give each player lowest-Power card here +3 Power.',
    map: '/art/maps/Laboratory.png',
    accent: '#ff6f91',
    abilities: {
      atTurnEnd: [{
        kind: 'CONDITIONAL',
        if: currentTurn('==', 4),
        then: [
          { kind: 'ADD_POWER', target: { kind: 'MIN_POWER_OF', of: sameLane('P0') }, delta: { kind: 'LIT', n: 3 } },
          { kind: 'ADD_POWER', target: { kind: 'MIN_POWER_OF', of: sameLane('P1') }, delta: { kind: 'LIT', n: 3 } },
        ],
      }],
    },
    note: 'Implemented with location atTurnEnd and concrete owner lane selectors.',
  }),

  p({
    name: 'Gun Store',
    text: 'Cards added to this location have +2 Power.',
    map: '/art/maps/AlienStarship.png',
    accent: '#c0c7d4',
    abilities: {
      onCardEnteredHere: [{ kind: 'ADD_POWER', target: eventCard, delta: { kind: 'LIT', n: 2 } }],
    },
    note: 'Implemented with location onCardEnteredHere and EVENT_CARD.',
  }),

  p({
    name: 'Red Needle',
    text: 'When a card is destroyed here, give a random friendly card here +2 Power.',
    map: '/art/maps/LavaFlow.png',
    accent: '#ff365f',
    abilities: {
      onCardDestroyedHere: [{
        kind: 'ADD_POWER',
        target: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 }, of: sameLane('EVENT_OWNER') },
        delta: { kind: 'LIT', n: 2 },
      }],
    },
    note: 'Implemented with location onCardDestroyedHere and EVENT_OWNER.',
  }),

  p({
    name: 'The Pineapple Club',
    text: 'When revealed, each player discards a card, then adds a random card to their hand.',
    map: '/art/maps/FoodCourt.png',
    accent: '#ff9f43',
    abilities: {
      onReveal: [
        { kind: 'DISCARD', target: randomHandCard('P0') },
        { kind: 'DISCARD', target: randomHandCard('P1') },
        randomCardToHand('P0'),
        randomCardToHand('P1'),
      ],
    },
    note: 'Implemented with DISCARD plus CREATE_CARDS_IN_ZONE.',
  }),

  p({
    name: 'Black Halo',
    text: 'Cards with On Reveal have +2 Power here.',
    map: '/art/maps/HackersLair.png',
    accent: '#7b2ff7',
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({ kind: 'HAS_ABILITY', target: self, slot: 'ON_REVEAL' }),
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    note: 'Implemented with HAS_ABILITY ON_REVEAL predicate.',
  }),

  p({
    name: 'The Cage',
    text: 'Cards cannot move from this location.',
    map: '/art/maps/IcyRoad.png',
    accent: '#d4af37',
    abilities: {
      ongoing: [{
        kind: 'BLOCK_MOVE',
        target: sameLane(),
        stack: 'SINGLE',
      }],
    },
    note: 'Implemented with BLOCK_MOVE aura.',
  }),

  p({
    name: 'Chip Tune',
    text: 'When revealed, reduce a random card in each player hand by 1 Cost.',
    map: '/art/maps/HackersLair.png',
    accent: '#59ffa8',
    abilities: {
      onReveal: [
        { kind: 'ADJUST_COST', target: randomHandCard('P0'), delta: { kind: 'LIT', n: -1 } },
        { kind: 'ADJUST_COST', target: randomHandCard('P1'), delta: { kind: 'LIT', n: -1 } },
      ],
    },
    note: 'Implemented with ADJUST_COST -1.',
  }),

  p({
    name: 'Netrunner Shrine',
    text: 'Cards with copied text have +4 Power here.',
    map: '/art/maps/Cathedral.png',
    accent: '#b779ff',
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({ kind: 'HAS_COPIED_TEXT', target: self }),
        delta: { kind: 'LIT', n: 4 },
        stack: 'ADDITIVE',
      }],
    },
    note: 'Implemented with HAS_COPIED_TEXT predicate.',
  }),

  p({
    name: 'Federal Courthouse',
    text: 'Cards that had their Cost reduced have +3 Power here.',
    map: '/art/maps/Cathedral2.png',
    accent: '#ffd166',
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({ kind: 'COST_REDUCED', target: self }),
        delta: { kind: 'LIT', n: 3 },
        stack: 'ADDITIVE',
      }],
    },
    note: 'Implemented with COST_REDUCED predicate.',
  }),

  p({
    name: 'Courthouse',
    text: 'Cards here cannot have their Power increased.',
    map: '/art/maps/Cathedral2.png',
    accent: '#aab2bd',
    abilities: {
      ongoing: [{
        kind: 'BLOCK_POWER_INCREASE',
        target: sameLane(),
        stack: 'SINGLE',
      }],
    },
    note: 'Implemented with BLOCK_POWER_INCREASE aura.',
  }),

  p({
    name: 'Data Chapel',
    text: 'Cards with copied or disabled text have +3 Power here.',
    map: '/art/maps/Cathedral.png',
    accent: '#9cffcb',
    abilities: {
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
    note: 'Implemented with HAS_COPIED_TEXT/TEXT_DISABLED predicates.',
  }),

  p({
    name: 'The Meat Market',
    text: 'Destroy the first card played here.',
    map: '/art/maps/FoodCourt.png',
    accent: '#70e1f5',
    abilities: {
      onCardPlayedHere: [{
        kind: 'CONDITIONAL',
        if: locationCounterIs('first-card-played', '==', 0),
        then: [
          { kind: 'DESTROY', target: eventCard },
          bumpLocationCounter('first-card-played'),
        ],
      }],
    },
    note: 'Implemented with onCardPlayedHere, EVENT_CARD, and a location counter.',
  }),

  p({
    name: 'Debt Alley',
    text: 'The first card each player plays here gets -2 Power.',
    map: '/art/maps/IcyRoad.png',
    accent: '#7f5af0',
    abilities: {
      onCardPlayedHere: [{
        kind: 'CONDITIONAL',
        if: locationCounterIs('played-here', '==', 0, 'EVENT_OWNER'),
        then: [
          { kind: 'ADD_POWER', target: eventCard, delta: { kind: 'LIT', n: -2 } },
          bumpLocationCounter('played-here', 'EVENT_OWNER'),
        ],
      }],
    },
    note: 'Implemented with owner-scoped location counters.',
  }),

  p({
    name: 'Skyrail',
    text: 'After you play a card here, move it to another location if possible.',
    map: '/art/maps/AlienStarship.png',
    accent: '#58c7ff',
    abilities: {
      onCardPlayedHere: [{
        kind: 'MOVE',
        target: eventCard,
        to: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 }, of: { kind: 'OTHER_LANES', of: eventCard } },
      }],
    },
    note: 'Implemented with onCardPlayedHere, EVENT_CARD, and MOVE.',
  }),

  p({
    name: 'Cryobank',
    text: 'Cards played here are not revealed until the end of the game.',
    map: '/art/maps/IcyRoad.png',
    accent: '#8fd5e8',
    abilities: {
      onCardEnteredHere: [{
        kind: 'SCHEDULE_REVEAL',
        target: eventCard,
        timing: { kind: 'END_OF_GAME' },
      }],
    },
    note: 'Implemented with an explicit END_OF_GAME reveal schedule.',
  }),

  p({
    name: 'Signal Pit',
    text: 'Disable Ongoing effects here.',
    map: '/art/maps/HackersLair.png',
    accent: '#00f5d4',
    abilities: {
      ongoing: [{
        kind: 'DISABLE_ONGOING',
        target: sameLane(),
        stack: 'SINGLE',
      }],
    },
    note: 'Implemented with DISABLE_ONGOING aura.',
  }),

  p({
    name: 'Drone Hive',
    text: 'When revealed, add a 1-Power Drone here for each player.',
    map: '/art/maps/Jungle.png',
    accent: '#adb5bd',
    abilities: {
      onReveal: [
        { kind: 'CREATE_CARDS_IN_ZONE', count: { kind: 'LIT', n: 1 }, replacement: 'WITH_REPLACEMENT', pool: { kind: 'DEF_ID_LIST', ids: ['drone'] }, owner: 'P0', destination: { kind: 'LANE', lane: self } },
        { kind: 'CREATE_CARDS_IN_ZONE', count: { kind: 'LIT', n: 1 }, replacement: 'WITH_REPLACEMENT', pool: { kind: 'DEF_ID_LIST', ids: ['drone'] }, owner: 'P1', destination: { kind: 'LANE', lane: self } },
      ],
    },
    note: 'Implemented with CREATE_CARDS_IN_ZONE and drone token.',
  }),

  p({
    name: 'Civil Court',
    text: 'Cards with no ability have +3 Power here.',
    map: '/art/maps/Cathedral2.png',
    accent: '#d8dbe2',
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: cardsHereWhere({ kind: 'HAS_NO_ABILITY', target: self }),
        delta: { kind: 'LIT', n: 3 },
        stack: 'ADDITIVE',
      }],
    },
    note: 'Implemented with HAS_NO_ABILITY predicate.',
  }),

  p({
    name: 'Backdoor',
    text: 'The next card each player plays here triggers its On Reveal twice.',
    map: '/art/maps/HackersLair.png',
    accent: '#5efc8d',
    abilities: {
      onCardPlayedHere: [{
        kind: 'CONDITIONAL',
        if: locationCounterIs('played-here', '==', 0, 'EVENT_OWNER'),
        then: [
          { kind: 'TRIGGER_ON_REVEAL', target: eventCard },
          bumpLocationCounter('played-here', 'EVENT_OWNER'),
        ],
      }],
    },
    note: 'Implemented with owner-scoped location counters plus TRIGGER_ON_REVEAL.',
  }),

  p({
    name: 'Scrap Yard',
    text: 'Destroyed cards are returned here on turn 5.',
    map: '/art/maps/LavaFlow.png',
    accent: '#a47148',
    abilities: {
      atTurnStart: [{
        kind: 'CONDITIONAL',
        if: currentTurn('==', 5),
        then: [{
          kind: 'RETURN_TO_LANE',
          target: { kind: 'ALL_CARDS', ownerFilter: 'ANY_OWNER', zoneFilter: 'DESTROYED' },
          to: self,
          revealed: true,
        }],
      }],
    },
    note: 'Implemented with atTurnStart, CURRENT_TURN, and RETURN_TO_LANE.',
  }),

  p({
    name: 'Pawn Shop',
    text: 'Banish each card you play here to earn +1 Energy next turn.',
    map: '/art/maps/FoodCourt.png',
    accent: '#b7a57a',
    abilities: {
      onCardPlayedHere: [{
        kind: 'SEQUENCE',
        items: [
          { kind: 'BANISH', target: eventCard },
          { kind: 'ADJUST_NEXT_TURN_ENERGY_BONUS', owner: 'EVENT_OWNER', delta: { kind: 'LIT', n: 1 } },
        ],
      }],
    },
    note: 'Implemented with onCardPlayedHere, BANISH, and EVENT_OWNER energy bonus.',
  }),

  p({
    name: 'Rent-A-Wreck',
    text: 'When revealed, each player adds a move card to their hand.',
    map: '/art/maps/AlienStarship.png',
    accent: '#ff7a59',
    abilities: {
      onReveal: [
        moveCardToHand('P0'),
        moveCardToHand('P1'),
      ],
    },
    note: 'Implemented with CREATE_CARDS_IN_ZONE and a curated move-card pool.',
  }),

  p({
    name: 'Power Sink',
    text: 'Cards here have -2 Power.',
    map: '/art/maps/LavaFlow.png',
    accent: '#ef6a2e',
    abilities: { ongoing: powerHere(-2) },
    note: 'Implemented with POWER_ADD -2.',
  }),

  p({
    name: 'Overclock Room',
    text: 'The first card each player plays here gets +4 Power.',
    map: '/art/maps/Laboratory.png',
    accent: '#ffbe0b',
    abilities: {
      onCardPlayedHere: [{
        kind: 'CONDITIONAL',
        if: locationCounterIs('played-here', '==', 0, 'EVENT_OWNER'),
        then: [
          { kind: 'ADD_POWER', target: eventCard, delta: { kind: 'LIT', n: 4 } },
          bumpLocationCounter('played-here', 'EVENT_OWNER'),
        ],
      }],
    },
    note: 'Implemented with owner-scoped location counters.',
  }),

  p({
    name: 'Black Clinic',
    text: 'Transform the next card you play here into a random 5-Cost card.',
    map: '/art/maps/Laboratory.png',
    accent: '#ff5d8f',
    abilities: {
      onCardPlayedHere: [{
        kind: 'CONDITIONAL',
        if: locationCounterIs('played-here', '==', 0, 'EVENT_OWNER'),
        then: [
          {
            kind: 'TRANSFORM_CARD',
            target: eventCard,
            pool: { kind: 'COST_RANGE', ownerDeck: 'EVENT_OWNER', min: 5, max: 5 },
          },
          bumpLocationCounter('played-here', 'EVENT_OWNER'),
        ],
      }],
    },
    note: 'Implemented with owner-scoped location counters and TRANSFORM_CARD.',
  }),
];

export const LOCATION_CATALOG: readonly LocationDesignEntry[] = LOCATION_SPECS.map(toCatalogEntry);

export const PLAYABLE_LOCATION_DEFS: readonly LocationCardDef[] = LOCATION_CATALOG
  .filter((entry) => entry.status === 'playable')
  .map((entry) => entry.def);

export const UNIMPLEMENTED_LOCATION_DEFS: readonly LocationCardDef[] = LOCATION_CATALOG
  .filter((entry) => entry.status === 'unimplemented')
  .map((entry) => entry.def);

export const DISABLED_LOCATION_IDS: readonly string[] = UNIMPLEMENTED_LOCATION_DEFS.map((loc) => loc.defId);

/**
 * Inert system location used when an effect destroys a location card.
 * Rarity 0 keeps it out of the bootstrap location deck; it enters play only
 * through the governed destroy/replace operation.
 */
export const RUIN_LOCATION_DEF: LocationCardDef = {
  defId: 'ruin',
  version: 1,
  name: 'Ruin',
  rarity: 0,
  abilities: {},
  cosmetic: {
    displayName: 'RUIN',
    description: 'No effect.',
    accent: '#665f56',
    art: { map: { path: '/art/maps/LavaFlow.png', kind: 'image' } },
  },
};

export const LOCATIONS_INDEX: readonly LocationCardDef[] = [
  ...LOCATION_CATALOG.map((entry) => entry.def),
  RUIN_LOCATION_DEF,
];

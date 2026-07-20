/**
 * Cyberpunk CCG — 105-card launch set v0.2
 *
 * Cards are expressed using the Ability DSL (types/ability.ts).
 * Some complex effects use CALL_BUILTIN as an escape hatch; the fn name
 * describes exactly what the evaluator must implement.
 *
 * Card numbering matches the design doc (001–105).
 * defId uses kebab-case of the card name.
 *
 * FOREACH semantics: within `do`, SELF resolves to the current iteration
 * card, not the source card. Pre-compute aggregates in a preceding
 * SEQUENCE step when you need to reference the source.
 */

import type { CardDef } from '../types';

// ---- Shared selector fragments (reused below) ------------------------------

const SELF_LANE_FRIENDLY = {
  kind: 'SAME_LANE' as const,
  of: { kind: 'SELF' as const },
  ownerFilter: 'SELF_OWNER' as const,
};

const SELF_LANE_FRIENDLY_EXCL_SELF = {
  kind: 'SAME_LANE' as const,
  of: { kind: 'SELF' as const },
  ownerFilter: 'SELF_OWNER' as const,
  exclude: { kind: 'SELF' as const },
};

const SELF_LANE_ANY_EXCL_SELF = {
  kind: 'SAME_LANE' as const,
  of: { kind: 'SELF' as const },
  ownerFilter: 'ANY_OWNER' as const,
  exclude: { kind: 'SELF' as const },
};

const SELF_LANE_ENEMY = {
  kind: 'SAME_LANE' as const,
  of: { kind: 'SELF' as const },
  ownerFilter: 'OPP_OWNER' as const,
};

const ALL_FRIENDLY_LANE = {
  kind: 'ALL_CARDS' as const,
  ownerFilter: 'SELF_OWNER' as const,
  zoneFilter: 'LANE' as const,
};

const ALL_FRIENDLY_HAND = {
  kind: 'ALL_CARDS' as const,
  ownerFilter: 'SELF_OWNER' as const,
  zoneFilter: 'HAND' as const,
};

const ALL_FRIENDLY_DESTROYED = {
  kind: 'ALL_CARDS' as const,
  ownerFilter: 'SELF_OWNER' as const,
  zoneFilter: 'DESTROYED' as const,
};

// ---------------------------------------------------------------------------

export const CYBERPUNK_CARDS: readonly CardDef[] = [

  // ==========================================================================
  // ARCHETYPE: DESTROY (001–010)
  // ==========================================================================

  {
    defId: 'scrap-rat',
    version: 1,
    name: 'Scrap Rat',
    basePower: 1,
    cost: 1,
    tribes: ['Merc'],
    abilities: {
      onDestroyed: [{
        kind: 'ADD_POWER',
        target: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 }, of: SELF_LANE_FRIENDLY_EXCL_SELF },
        delta: { kind: 'LIT', n: 2 },
      }],
    },
    cosmetic: {
      displayName: 'SCRAP RAT',
      flavorText: 'Salvage is the only economy worth trusting.',
      rulesText: 'When Destroyed: Give a random friendly card here +2 Power.',
      accent: '#ff8c42',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'crash-dummy',
    version: 1,
    name: 'Crash Dummy',
    basePower: 2,
    cost: 1,
    tribes: ['Drone'],
    abilities: {
      onDestroyed: [{
        kind: 'DRAW',
        owner: 'SELF_OWNER',
        count: { kind: 'LIT', n: 1 },
      }],
    },
    cosmetic: {
      displayName: 'CRASH DUMMY',
      flavorText: 'Designed to fail perfectly.',
      rulesText: 'When Destroyed: Draw a card.',
      accent: '#ffcc00',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'chop-doc',
    version: 1,
    name: 'Chop Doc',
    basePower: 2,
    cost: 2,
    tribes: ['Bio'],
    abilities: {
      onReveal: [{
        kind: 'DESTROY',
        target: { kind: 'MIN_POWER_OF', of: SELF_LANE_FRIENDLY },
      }],
    },
    cosmetic: {
      displayName: 'CHOP DOC',
      flavorText: 'The weakest part is always the first to go.',
      rulesText: 'On Reveal: Destroy your lowest-Power card here.',
      accent: '#e63946',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'grinder-crew',
    version: 1,
    name: 'Grinder Crew',
    basePower: 3,
    cost: 2,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CONDITIONAL',
        if: { kind: 'EXISTS', target: SELF_LANE_FRIENDLY_EXCL_SELF },
        then: [
          {
            kind: 'DESTROY',
            target: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 }, of: SELF_LANE_FRIENDLY_EXCL_SELF },
          },
          { kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 3 } },
        ],
      }],
    },
    cosmetic: {
      displayName: 'GRINDER CREW',
      flavorText: 'They make room the old-fashioned way.',
      rulesText: 'On Reveal: Destroy another friendly card here and gain +3 Power.',
      accent: '#ff5a1f',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Modelled as Ongoing counting friendly destroyed cards.
    defId: 'redline-bruiser',
    version: 1,
    name: 'Redline Bruiser',
    basePower: 3,
    cost: 3,
    tribes: ['Merc', 'Bio'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SELF' },
        delta: { kind: 'COUNT', of: ALL_FRIENDLY_DESTROYED },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'REDLINE BRUISER',
      flavorText: 'Every fall feeds the fury.',
      rulesText: 'Ongoing: +1 Power for each of your destroyed cards.',
      accent: '#c1121f',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'parts-collector',
    version: 1,
    name: 'Parts Collector',
    basePower: 4,
    cost: 3,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'TRACKED_STAT', owner: 'SELF_OWNER', stat: 'cardsYouDestroyed' },
      }],
    },
    cosmetic: {
      displayName: 'PARTS COLLECTOR',
      flavorText: 'The count is the currency.',
      rulesText: 'On Reveal: +1 Power for each card you destroyed this game.',
      accent: '#8ecae6',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Cost scales down per friendly card destroyed.
    defId: 'rust-revenant',
    version: 1,
    name: 'Rust Revenant',
    basePower: 6,
    cost: 4,
    tribes: ['Bio'],
    abilities: {
      ongoing: [{
        kind: 'COST_ADD',
        target: { kind: 'SELF' },
        delta: {
          kind: 'MUL',
          a: { kind: 'LIT', n: -1 },
          b: { kind: 'COUNT', of: ALL_FRIENDLY_DESTROYED },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'RUST REVENANT',
      flavorText: 'Each grave digs the next.',
      rulesText: 'Ongoing: Costs 1 less for each of your destroyed cards.',
      accent: '#6d6875',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'bone-market',
    version: 1,
    name: 'Bone Market',
    basePower: 4,
    cost: 4,
    tribes: ['Tech'],
    abilities: {
      onReveal: [{
        kind: 'SEQUENCE',
        items: [
          {
            kind: 'CREATE_CARD_IN_ZONE',
            pool: { kind: 'COST_RANGE', ownerDeck: 'SELF_OWNER', min: 1, max: 4 },
            owner: 'SELF_OWNER',
            destination: { kind: 'HAND' },
          },
          {
            kind: 'DESTROY',
            target: { kind: 'MIN_POWER_OF', of: SELF_LANE_FRIENDLY },
          },
        ],
      }],
    },
    cosmetic: {
      displayName: 'BONE MARKET',
      flavorText: 'Fair exchange is no robbery.',
      rulesText: 'On Reveal: Add a random card to your hand, then destroy your lowest-Power card here.',
      accent: '#b5838d',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'meat-grinder',
    version: 1,
    name: 'Meat Grinder',
    basePower: 6,
    cost: 5,
    tribes: ['Tech'],
    abilities: {
      onReveal: [{
        kind: 'SEQUENCE',
        items: [
          // Gain +2 per 1-cost card BEFORE destroying them.
          {
            kind: 'ADD_POWER',
            target: { kind: 'SELF' },
            delta: {
              kind: 'MUL',
              a: { kind: 'LIT', n: 2 },
              b: {
                kind: 'COUNT',
                of: {
                  kind: 'WHERE',
                  of: SELF_LANE_ANY_EXCL_SELF,
                  pred: { kind: 'COST_CMP', target: { kind: 'SELF' }, op: '==', value: { kind: 'LIT', n: 1 } },
                },
              },
            },
          },
          // Destroy all 1-cost cards (SELF in do = iteration card).
          {
            kind: 'FOREACH',
            over: {
              kind: 'WHERE',
              of: SELF_LANE_ANY_EXCL_SELF,
              pred: { kind: 'COST_CMP', target: { kind: 'SELF' }, op: '==', value: { kind: 'LIT', n: 1 } },
            },
            do: [{ kind: 'DESTROY', target: { kind: 'SELF' } }],
          },
        ],
      }],
    },
    cosmetic: {
      displayName: 'MEAT GRINDER',
      flavorText: 'The cheap parts make the best fuel.',
      rulesText: 'On Reveal: Destroy all 1-Cost cards here and gain +2 Power each.',
      accent: '#e63946',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'scrapyard-king',
    version: 1,
    name: 'Scrapyard King',
    basePower: 8,
    cost: 6,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'TRACKED_STAT', owner: 'SELF_OWNER', stat: 'totalCardsDestroyed' },
      }],
    },
    cosmetic: {
      displayName: 'SCRAPYARD KING',
      flavorText: 'Every death adds to the throne.',
      rulesText: 'On Reveal: +1 Power for each card destroyed this game.',
      accent: '#ffd60a',
      frame: 'legendary',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // ARCHETYPE: CORPORATE COPY (011–018)
  // ==========================================================================

  {
    // Destroys cheapest friendly card here and copies its On Reveal text.
    defId: 'middle-manager',
    version: 1,
    name: 'Middle Manager',
    basePower: 2,
    cost: 2,
    tribes: ['Corp'],
    abilities: {
      onReveal: [{
        kind: 'SEQUENCE',
        items: [
          {
            kind: 'COPY_TEXT_OF',
            into: { kind: 'SELF' },
            source: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
            copyKind: 'ON_REVEAL',
          },
          {
            kind: 'DESTROY',
            target: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
          },
        ],
      }],
    },
    cosmetic: {
      displayName: 'MIDDLE MANAGER',
      flavorText: 'Acquisition begins with paperwork.',
      rulesText: 'On Reveal: Destroy your lowest-Cost card here and copy its On Reveal text.',
      accent: '#457b9d',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'hostile-recruiter',
    version: 1,
    name: 'Hostile Recruiter',
    basePower: 3,
    cost: 3,
    tribes: ['Corp'],
    abilities: {
      onReveal: [{
        kind: 'COPY_TEXT_OF',
        into: { kind: 'SELF' },
        source: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
        copyKind: 'ONGOING',
      }],
    },
    cosmetic: {
      displayName: 'HOSTILE RECRUITER',
      flavorText: 'Your talents belong to us now.',
      rulesText: 'On Reveal: Copy the Ongoing text of your lowest-Cost card here.',
      accent: '#1d3557',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'golden-parachute',
    version: 1,
    name: 'Golden Parachute',
    basePower: 1,
    cost: 1,
    tribes: ['Corp'],
    abilities: {
      onDestroyed: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DEF_ID_LIST', ids: ['golden-parachute'] },
        owner: 'SELF_OWNER',
        destination: { kind: 'HAND' },
      }],
    },
    cosmetic: {
      displayName: 'GOLDEN PARACHUTE',
      flavorText: 'The exit strategy was always the plan.',
      rulesText: 'When Destroyed: Add a copy of this to your hand.',
      accent: '#ffd60a',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    // "Give the destroyer +2 Power" requires identifying the destroying card.
    // Implemented via builtin; engine must look up last DESTROY event source.
    defId: 'severance-clone',
    version: 1,
    name: 'Severance Clone',
    basePower: 1,
    cost: 2,
    tribes: ['Corp', 'Bio'],
    abilities: {
      onDestroyed: [{
        kind: 'CALL_BUILTIN',
        fn: 'POWER_TO_DESTROYER',
        args: { delta: 2 },
      }],
    },
    cosmetic: {
      displayName: 'SEVERANCE CLONE',
      flavorText: 'The kill is its own reward.',
      rulesText: 'When Destroyed: Give the card that destroyed this +2 Power.',
      accent: '#e9c46a',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'hr-algorithm',
    version: 1,
    name: 'HR Algorithm',
    basePower: 2,
    cost: 3,
    tribes: ['AI', 'Corp'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: ALL_FRIENDLY_LANE,
          pred: { kind: 'HAS_COPIED_TEXT', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'HR ALGORITHM',
      flavorText: 'Performance metrics have been optimised.',
      rulesText: 'Ongoing: Your cards with copied text have +2 Power.',
      accent: '#2a9d8f',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'acquisition-team',
    version: 1,
    name: 'Acquisition Team',
    basePower: 5,
    cost: 4,
    tribes: ['Corp'],
    abilities: {
      onReveal: [{
        kind: 'SEQUENCE',
        items: [
          {
            kind: 'COPY_TEXT_OF',
            into: {
              kind: 'MAX_POWER_OF',
              of: {
                kind: 'SAME_LANE',
                of: { kind: 'SELF' },
                ownerFilter: 'SELF_OWNER',
                exclude: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
              },
            },
            source: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
            copyKind: 'FULL',
          },
          {
            kind: 'DESTROY',
            target: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
          },
        ],
      }],
    },
    cosmetic: {
      displayName: 'ACQUISITION TEAM',
      flavorText: 'Synergy through hostile integration.',
      rulesText: 'On Reveal: Destroy your lowest-Cost card here and give its text to your highest-Power card here.',
      accent: '#264653',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    // "Also has the Ongoing text of your lowest-Cost Ongoing card" — dynamic
    // ongoing text copy needs bespoke projection logic.
    defId: 'boardroom-proxy',
    version: 1,
    name: 'Boardroom Proxy',
    basePower: 6,
    cost: 5,
    tribes: ['Corp', 'AI'],
    abilities: {
      ongoing: [{
        kind: 'CALL_BUILTIN' as any,
        fn: 'COPY_ONGOING_OF_CHEAPEST_ONGOING',
        args: {},
      } as any],
    },
    cosmetic: {
      displayName: 'BOARDROOM PROXY',
      flavorText: 'Sits in every meeting at once.',
      rulesText: 'Ongoing: This also has the Ongoing text of your lowest-Cost Ongoing card here.',
      accent: '#023e8a',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Full text copy — constrain to ON_REVEAL until playtesting confirms safety.
    defId: 'executive-override',
    version: 1,
    name: 'Executive Override',
    basePower: 5,
    cost: 6,
    tribes: ['Corp'],
    abilities: {
      onReveal: [{
        kind: 'SEQUENCE',
        items: [
          {
            kind: 'COPY_TEXT_OF',
            into: { kind: 'SELF' },
            source: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
            copyKind: 'ON_REVEAL',
          },
          {
            kind: 'DESTROY',
            target: { kind: 'MIN_COST_OF', of: SELF_LANE_FRIENDLY_EXCL_SELF },
          },
        ],
      }],
    },
    cosmetic: {
      displayName: 'EXECUTIVE OVERRIDE',
      flavorText: 'Authority is acquired, not assigned.',
      rulesText: 'On Reveal: Destroy another friendly card here and copy its On Reveal text.',
      accent: '#780000',
      frame: 'legendary',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // ARCHETYPE: FIXER (019–028)
  // ==========================================================================

  {
    defId: 'street-fixer',
    version: 1,
    name: 'Street Fixer',
    basePower: 2,
    cost: 2,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DECK_BY_TRIBE', ownerDeck: 'SELF_OWNER', tribe: 'Tech', excludeInPlay: true },
        owner: 'SELF_OWNER',
        destination: { kind: 'HAND' },
      }],
    },
    cosmetic: {
      displayName: 'STREET FIXER',
      flavorText: 'Knows where to find the right tool.',
      rulesText: 'On Reveal: Draw a Tech card.',
      accent: '#e9c46a',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'tech-fixer',
    version: 1,
    name: 'Tech Fixer',
    basePower: 3,
    cost: 3,
    tribes: ['Merc', 'Hacker'],
    abilities: {
      onReveal: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DECK_BY_TRIBE', ownerDeck: 'SELF_OWNER', tribe: 'AI', excludeInPlay: true },
        owner: 'SELF_OWNER',
        destination: { kind: 'HAND' },
      }],
    },
    cosmetic: {
      displayName: 'TECH FIXER',
      flavorText: 'Every system has a back door.',
      rulesText: 'On Reveal: Draw an AI card.',
      accent: '#00b4d8',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'military-fixer',
    version: 1,
    name: 'Military Fixer',
    basePower: 2,
    cost: 3,
    tribes: ['Military', 'Merc'],
    abilities: {
      onReveal: [{
        kind: 'SEQUENCE',
        items: [
          {
            kind: 'CREATE_CARD_IN_ZONE',
            pool: { kind: 'COST_RANGE', ownerDeck: 'SELF_OWNER', min: 4, max: 5 },
            owner: 'SELF_OWNER',
            destination: { kind: 'HAND' },
          },
          {
            kind: 'CREATE_CARD_IN_ZONE',
            pool: { kind: 'COST_RANGE', ownerDeck: 'SELF_OWNER', min: 4, max: 5 },
            owner: 'SELF_OWNER',
            destination: { kind: 'HAND' },
          },
        ],
      }],
    },
    cosmetic: {
      displayName: 'MILITARY FIXER',
      flavorText: 'Heavy assets, low profile.',
      rulesText: 'On Reveal: Add two random 4–5 Cost cards to your hand.',
      accent: '#495057',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'chrome-broker',
    version: 1,
    name: 'Chrome Broker',
    basePower: 1,
    cost: 2,
    tribes: ['Bio', 'Merc'],
    abilities: {
      onReveal: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DECK_BY_TRIBE', ownerDeck: 'SELF_OWNER', tribe: 'Bio', excludeInPlay: true },
        owner: 'SELF_OWNER',
        destination: { kind: 'HAND' },
      }],
    },
    cosmetic: {
      displayName: 'CHROME BROKER',
      flavorText: 'Flesh is inventory.',
      rulesText: 'On Reveal: Add a random Bio card to your hand.',
      accent: '#b5838d',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    // "Replace a card in your hand with one that costs 1 more" — complex hand
    // manipulation requires bespoke evaluator logic to pick and swap.
    defId: 'backchannel-contact',
    version: 1,
    name: 'Backchannel Contact',
    basePower: 3,
    cost: 2,
    tribes: ['Merc', 'Hacker'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'REPLACE_HAND_CARD_HIGHER_COST',
        args: { costDelta: 1 },
      }],
    },
    cosmetic: {
      displayName: 'BACKCHANNEL CONTACT',
      flavorText: 'Upgrades cost something. Always.',
      rulesText: 'On Reveal: Replace a card in your hand with one that costs 1 more.',
      accent: '#90e0ef',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'clean-operator',
    version: 1,
    name: 'Clean Operator',
    basePower: 4,
    cost: 3,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'REPLACE_LOWEST_POWER_HAND_WITH_COST',
        args: { targetCost: 3 },
      }],
    },
    cosmetic: {
      displayName: 'CLEAN OPERATOR',
      flavorText: 'Trade up. Always trade up.',
      rulesText: 'On Reveal: Replace your lowest-Power card in hand with a random 3-Cost card.',
      accent: '#dee2e6',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'procurement-bot',
    version: 1,
    name: 'Procurement Bot',
    basePower: 1,
    cost: 1,
    tribes: ['Drone', 'Tech'],
    abilities: {
      ongoing: [{
        kind: 'COST_ADD',
        target: {
          kind: 'WHERE',
          of: ALL_FRIENDLY_HAND,
          pred: { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: -1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'PROCUREMENT BOT',
      flavorText: 'Unauthorised discounts are still discounts.',
      rulesText: 'Ongoing: Your created cards in hand cost 1 less.',
      accent: '#caf0f8',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Adds a random card discounted by 1 for next turn only.
    // Builtin handles the temp discount + expiry scheduling.
    defId: 'dead-drop',
    version: 1,
    name: 'Dead Drop',
    basePower: 1,
    cost: 3,
    tribes: ['Tech'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'ADD_DISCOUNTED_CARD_TO_HAND',
        args: { costDelta: -1, expiresTurns: 1 },
      }],
    },
    cosmetic: {
      displayName: 'DEAD DROP',
      flavorText: 'Free for one turn. Then you owe.',
      rulesText: 'On Reveal: Add a random card to your hand that costs 1 less next turn.',
      accent: '#48cae4',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Draws the lowest-cost card from your deck (not random).
    defId: 'talent-scout',
    version: 1,
    name: 'Talent Scout',
    basePower: 5,
    cost: 4,
    tribes: ['Corp', 'Merc'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'DRAW_LOWEST_COST_CARD',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'TALENT SCOUT',
      flavorText: 'Identifies what you need before you do.',
      rulesText: 'On Reveal: Draw your lowest-Cost card from your deck.',
      accent: '#f4a261',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'network-queen',
    version: 1,
    name: 'Network Queen',
    basePower: 7,
    cost: 5,
    tribes: ['Merc', 'Hacker'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: {
          kind: 'WHERE',
          of: ALL_FRIENDLY_HAND,
          pred: { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
        },
        do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
      }],
    },
    cosmetic: {
      displayName: 'NETWORK QUEEN',
      flavorText: 'What you have is what she made you want.',
      rulesText: 'On Reveal: Give your created cards in hand +2 Power.',
      accent: '#e040fb',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // ARCHETYPE: NANOTECH / AI (029–038)
  // ==========================================================================

  {
    defId: 'nano-swarm',
    version: 1,
    name: 'Nano Swarm',
    basePower: 1,
    cost: 1,
    tribes: ['AI', 'Tech'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SELF' },
        delta: { kind: 'COUNT', of: SELF_LANE_FRIENDLY_EXCL_SELF },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'NANO SWARM',
      flavorText: 'The collective is the organism.',
      rulesText: 'Ongoing: +1 Power for each other friendly card here.',
      accent: '#00b4d8',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'signal-booster',
    version: 1,
    name: 'Signal Booster',
    basePower: 1,
    cost: 2,
    tribes: ['AI', 'Tech'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: SELF_LANE_FRIENDLY_EXCL_SELF,
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'SIGNAL BOOSTER',
      flavorText: 'Amplification is a form of loyalty.',
      rulesText: 'Ongoing: Your other cards here have +1 Power.',
      accent: '#0096c7',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Grows when it's your only card in the lane.
    defId: 'adaptive-shell',
    version: 1,
    name: 'Adaptive Shell',
    basePower: 2,
    cost: 2,
    tribes: ['Tech', 'Bio'],
    abilities: {
      onEndOfTurn: [{
        kind: 'CONDITIONAL',
        if: {
          kind: 'NOT',
          p: { kind: 'EXISTS', target: SELF_LANE_FRIENDLY_EXCL_SELF },
        },
        then: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
      }],
    },
    cosmetic: {
      displayName: 'ADAPTIVE SHELL',
      flavorText: 'Alone it evolves. Crowded it coasts.',
      rulesText: 'End of Turn: If this is your only card here, gain +2 Power.',
      accent: '#52b788',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'maintenance-cloud',
    version: 1,
    name: 'Maintenance Cloud',
    basePower: 2,
    cost: 3,
    tribes: ['AI', 'Drone'],
    abilities: {
      onEndOfTurn: [{
        kind: 'ADD_POWER',
        target: { kind: 'MIN_POWER_OF', of: SELF_LANE_FRIENDLY },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
    cosmetic: {
      displayName: 'MAINTENANCE CLOUD',
      flavorText: 'Constant incremental correction.',
      rulesText: 'End of Turn: Give your lowest-Power card here +1 Power.',
      accent: '#74c69d',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'ai-overseer',
    version: 1,
    name: 'AI Overseer',
    basePower: 3,
    cost: 3,
    tribes: ['AI'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: SELF_LANE_FRIENDLY_EXCL_SELF,
          pred: { kind: 'HAS_ONGOING', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'AI OVERSEER',
      flavorText: 'Systems that persist are rewarded.',
      rulesText: 'Ongoing: Your other Ongoing cards here have +1 Power.',
      accent: '#4361ee',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'replication-node',
    version: 1,
    name: 'Replication Node',
    basePower: 3,
    cost: 4,
    tribes: ['AI', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DEF_ID_LIST', ids: ['cheap-drone'] },
        owner: 'SELF_OWNER',
        destination: { kind: 'LANE', lane: { kind: 'LANE_OF', of: { kind: 'SELF' } } },
      }],
    },
    cosmetic: {
      displayName: 'REPLICATION NODE',
      flavorText: 'One becomes two. Two becomes enough.',
      rulesText: 'On Reveal: Add a 1-Power Drone here.',
      accent: '#4cc9f0',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'smart-matter-armor',
    version: 1,
    name: 'Smart Matter Armor',
    basePower: 5,
    cost: 4,
    tribes: ['Tech', 'Bio'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: SELF_LANE_FRIENDLY,
          pred: { kind: 'POWER_INCREASED', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'SMART MATTER ARMOR',
      flavorText: 'The upgrade recognizes the upgrade.',
      rulesText: 'Ongoing: Cards here with increased Power have +2 Power.',
      accent: '#4895ef',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // "Your cards at full locations have +2 Power" — full-lane check.
    defId: 'distributed-mind',
    version: 1,
    name: 'Distributed Mind',
    basePower: 4,
    cost: 5,
    tribes: ['AI'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: ALL_FRIENDLY_LANE,
          pred: { kind: 'IN_FULL_LANE', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'DISTRIBUTED MIND',
      flavorText: 'Density produces clarity.',
      rulesText: 'Ongoing: Your cards at full locations have +2 Power.',
      accent: '#3a0ca3',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'grey-goo-bloom',
    version: 1,
    name: 'Grey Goo Bloom',
    basePower: 6,
    cost: 5,
    tribes: ['AI', 'Tech'],
    abilities: {
      onEndOfTurn: [{
        kind: 'CONDITIONAL',
        if: { kind: 'LANE_FULL', laneOf: { kind: 'SELF' } },
        then: [{
          kind: 'FOREACH',
          over: SELF_LANE_FRIENDLY,
          do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
        }],
      }],
    },
    cosmetic: {
      displayName: 'GREY GOO BLOOM',
      flavorText: 'When the lane is full, the system matures.',
      rulesText: 'End of Turn: If this location is full, give your cards here +1 Power.',
      accent: '#adb5bd',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'citywide-mesh',
    version: 1,
    name: 'Citywide Mesh',
    basePower: 5,
    cost: 6,
    tribes: ['AI'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'ALL_CARDS',
          ownerFilter: 'SELF_OWNER',
          zoneFilter: 'LANE',
        },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'CITYWIDE MESH',
      flavorText: 'Every node is stronger for the network.',
      rulesText: 'Ongoing: All your other cards have +1 Power.',
      accent: '#4cc9f0',
      frame: 'legendary',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // ARCHETYPE: HACKER CONTROL (039–046)
  // ==========================================================================

  {
    defId: 'signal-jammer',
    version: 1,
    name: 'Signal Jammer',
    basePower: 2,
    cost: 2,
    tribes: ['Hacker', 'Tech'],
    abilities: {
      ongoing: [{
        kind: 'DISABLE_ON_REVEAL',
        target: SELF_LANE_ENEMY,
        stack: 'SINGLE',
      }],
    },
    cosmetic: {
      displayName: 'SIGNAL JAMMER',
      flavorText: 'Nothing gets in. Nothing gets out.',
      rulesText: 'Ongoing: Enemy On Reveal abilities do not trigger here.',
      accent: '#f72585',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'black-ice',
    version: 1,
    name: 'Black ICE',
    basePower: 3,
    cost: 3,
    tribes: ['AI', 'Hacker'],
    abilities: {
      onReveal: [{
        kind: 'REMOVE_TEXT',
        target: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 }, of: SELF_LANE_ENEMY },
        textKind: 'ONGOING',
      }],
    },
    cosmetic: {
      displayName: 'BLACK ICE',
      flavorText: 'Persistent systems are the most vulnerable.',
      rulesText: 'On Reveal: Remove Ongoing text from a random enemy card here.',
      accent: '#000814',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'trace-hacker',
    version: 1,
    name: 'Trace Hacker',
    basePower: 4,
    cost: 3,
    tribes: ['Hacker'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'MOVE_ENEMY_CARD_TO_OTHER_LANE',
        args: { selector: 'RANDOM_ENEMY_HERE' },
      }],
    },
    cosmetic: {
      displayName: 'TRACE HACKER',
      flavorText: 'You were never supposed to be there.',
      rulesText: 'On Reveal: Move a random enemy card here to another location.',
      accent: '#7209b7',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'system-crash',
    version: 1,
    name: 'System Crash',
    basePower: 3,
    cost: 4,
    tribes: ['Hacker', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'RESET_POWER',
        target: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 }, of: SELF_LANE_ENEMY },
      }],
    },
    cosmetic: {
      displayName: 'SYSTEM CRASH',
      flavorText: 'The numbers go back to zero.',
      rulesText: 'On Reveal: Reset a random enemy card here to its base Power.',
      accent: '#560bad',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'rootkit-kid',
    version: 1,
    name: 'Rootkit Kid',
    basePower: 1,
    cost: 2,
    tribes: ['Hacker'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: {
          kind: 'WHERE',
          of: SELF_LANE_ENEMY,
          pred: { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
        },
        do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: -2 } }],
      }],
    },
    cosmetic: {
      displayName: 'ROOTKIT KID',
      flavorText: 'Borrowed things break easiest.',
      rulesText: 'On Reveal: Enemy created cards here have -2 Power.',
      accent: '#9d4edd',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'firewall-daemon',
    version: 1,
    name: 'Firewall Daemon',
    basePower: 4,
    cost: 4,
    tribes: ['AI', 'Hacker'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: SELF_LANE_ENEMY,
          pred: { kind: 'TEXT_DISABLED', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: -2 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'FIREWALL DAEMON',
      flavorText: 'What can\'t run is already losing.',
      rulesText: 'Ongoing: Enemy cards with disabled text have -2 Power.',
      accent: '#5a189a',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'exploit-artist',
    version: 1,
    name: 'Exploit Artist',
    basePower: 6,
    cost: 5,
    tribes: ['Hacker', 'Merc'],
    abilities: {
      onReveal: [{
        kind: 'CONDITIONAL',
        if: {
          kind: 'EXISTS',
          target: {
            kind: 'WHERE',
            of: SELF_LANE_ENEMY,
            pred: { kind: 'HAS_TAG', target: { kind: 'SELF' }, tag: 'PLAYED_THIS_TURN' },
          },
        },
        then: [{
          kind: 'DESTROY',
          target: {
            kind: 'WHERE',
            of: SELF_LANE_ENEMY,
            pred: { kind: 'HAS_TAG', target: { kind: 'SELF' }, tag: 'PLAYED_THIS_TURN' },
          },
        }],
      }],
    },
    cosmetic: {
      displayName: 'EXPLOIT ARTIST',
      flavorText: 'Plays the vulnerability the moment it opens.',
      rulesText: 'On Reveal: If your opponent played a card here this turn, destroy it.',
      accent: '#e500a4',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'null-saint',
    version: 1,
    name: 'Null Saint',
    basePower: 8,
    cost: 6,
    tribes: ['Hacker', 'AI'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: SELF_LANE_ENEMY,
        do: [{ kind: 'REMOVE_TEXT', target: { kind: 'SELF' }, textKind: 'ALL' }],
      }],
    },
    cosmetic: {
      displayName: 'NULL SAINT',
      flavorText: 'When Null Saint arrives, their rules stop.',
      rulesText: 'On Reveal: Remove all text from enemy cards here.',
      accent: '#10002b',
      frame: 'legendary',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // ARCHETYPE: BLACK MARKET (047–056)
  // ==========================================================================

  {
    defId: 'black-market-dealer',
    version: 1,
    name: 'Black Market Dealer',
    basePower: 2,
    cost: 2,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'ADD_DISCOUNTED_CARD_TO_HAND',
        args: { costDelta: -2, expiresTurns: 1 },
      }],
    },
    cosmetic: {
      displayName: 'BLACK MARKET DEALER',
      flavorText: 'The discount expires when trust does.',
      rulesText: 'On Reveal: Add a random card to your hand that costs 2 less next turn.',
      accent: '#212529',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Gives a friendly card here +5 Power, schedules its destruction end of next turn.
    defId: 'overclock-chip',
    version: 1,
    name: 'Overclock Chip',
    basePower: 0,
    cost: 1,
    tribes: ['Tech'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'OVERCLOCK_CHIP',
        args: { powerDelta: 5 },
      }],
    },
    cosmetic: {
      displayName: 'OVERCLOCK CHIP',
      flavorText: 'Five seconds of perfect. Then the bill.',
      rulesText: 'On Reveal: Give a friendly card here +5 Power. Destroy it at end of next turn.',
      accent: '#ffba08',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'borrowed-gun',
    version: 1,
    name: 'Borrowed Gun',
    basePower: 3,
    cost: 1,
    tribes: ['Tech', 'Military'],
    abilities: {
      onEndOfTurn: [{
        kind: 'CONDITIONAL',
        if: { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
        then: [{ kind: 'DESTROY', target: { kind: 'SELF' } }],
      }],
    },
    cosmetic: {
      displayName: 'BORROWED GUN',
      flavorText: 'Returns to the lender one way or another.',
      rulesText: 'End of Turn: Destroy this if it was created.',
      accent: '#6c757d',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'illegal-clone',
    version: 1,
    name: 'Illegal Clone',
    basePower: 2,
    cost: 2,
    tribes: ['Bio'],
    abilities: {
      onDestroyed: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DEF_ID_LIST', ids: ['illegal-clone'] },
        owner: 'SELF_OWNER',
        destination: { kind: 'HAND' },
      }],
    },
    cosmetic: {
      displayName: 'ILLEGAL CLONE',
      flavorText: 'The copy protests just as loudly.',
      rulesText: 'When Destroyed: Add a copy of this to your hand.',
      accent: '#80ed99',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'knockoff-cyberarm',
    version: 1,
    name: 'Knockoff Cyberarm',
    basePower: 5,
    cost: 3,
    tribes: ['Bio', 'Tech'],
    abilities: {
      onEndOfTurn: [{
        kind: 'CONDITIONAL',
        if: { kind: 'POWER_INCREASED', target: { kind: 'SELF' } },
        then: [{ kind: 'DESTROY', target: { kind: 'SELF' } }],
      }],
    },
    cosmetic: {
      displayName: 'KNOCKOFF CYBERARM',
      flavorText: 'Works great. Right up until it doesn\'t.',
      rulesText: 'End of Turn: Destroy this if it has increased Power.',
      accent: '#a8dadc',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'grey-market-cache',
    version: 1,
    name: 'Grey Market Cache',
    basePower: 2,
    cost: 3,
    tribes: ['Tech'],
    abilities: {
      onReveal: [{
        kind: 'ADJUST_COST',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: {
            kind: 'WHERE',
            of: ALL_FRIENDLY_HAND,
            pred: { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
          },
        },
        delta: { kind: 'LIT', n: -2 },
      }],
    },
    cosmetic: {
      displayName: 'GREY MARKET CACHE',
      flavorText: 'No provenance. No problem.',
      rulesText: 'On Reveal: Reduce the Cost of a created card in your hand by 2.',
      accent: '#adb5bd',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'debt-collector',
    version: 1,
    name: 'Debt Collector',
    basePower: 6,
    cost: 4,
    tribes: ['Corp', 'Merc'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'TRACKED_STAT', owner: 'SELF_OWNER', stat: 'totalCostReduced' },
      }],
    },
    cosmetic: {
      displayName: 'DEBT COLLECTOR',
      flavorText: 'Every discount you took, she remembers.',
      rulesText: 'On Reveal: +1 Power for each Cost you reduced this game.',
      accent: '#495057',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'ghost-vendor',
    version: 1,
    name: 'Ghost Vendor',
    basePower: 4,
    cost: 4,
    tribes: ['Hacker', 'Merc'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'REPLACE_CREATED_HAND_CARD_HIGHER_COST',
        args: { costDelta: 1 },
      }],
    },
    cosmetic: {
      displayName: 'GHOST VENDOR',
      flavorText: 'Trade the knockoff for something real.',
      rulesText: 'On Reveal: Replace a created card in your hand with one that costs 1 more.',
      accent: '#dee2e6',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'hot-merchandise',
    version: 1,
    name: 'Hot Merchandise',
    basePower: 9,
    cost: 5,
    tribes: ['Tech'],
    abilities: {
      onReveal: [{
        kind: 'ADD_PENDING',
        effect: {
          kind: 'SCHEDULED',
          when: 'END_OF_NEXT_TURN',
          effect: { kind: 'DESTROY', target: { kind: 'SELF' } },
        },
      }],
    },
    cosmetic: {
      displayName: 'HOT MERCHANDISE',
      flavorText: 'Magnificent until it isn\'t yours.',
      rulesText: 'On Reveal: Destroy this at the end of next turn.',
      accent: '#ff6b6b',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'kingpin-broker',
    version: 1,
    name: 'Kingpin Broker',
    basePower: 7,
    cost: 6,
    tribes: ['Merc', 'Corp'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: {
          kind: 'WHERE',
          of: SELF_LANE_FRIENDLY,
          pred: { kind: 'COST_REDUCED', target: { kind: 'SELF' } },
        },
        do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
      }],
    },
    cosmetic: {
      displayName: 'KINGPIN BROKER',
      flavorText: 'He discounted them. Now they serve him.',
      rulesText: 'On Reveal: Give your discounted cards here +2 Power.',
      accent: '#ffd60a',
      frame: 'legendary',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // ARCHETYPE: OVERCLOCK (057–064)
  // ==========================================================================

  {
    defId: 'battery-monk',
    version: 1,
    name: 'Battery Monk',
    basePower: 2,
    cost: 1,
    tribes: ['Bio'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SELF' },
        delta: {
          kind: 'IF_ELSE',
          if: { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'hadUnspentEnergyLastTurn' },
          then: { kind: 'LIT', n: 2 },
          else: { kind: 'LIT', n: 0 },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'BATTERY MONK',
      flavorText: 'Restraint accumulates.',
      rulesText: 'Ongoing: +2 Power if you ended last turn with unspent Energy.',
      accent: '#f9c74f',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'capacitor-drone',
    version: 1,
    name: 'Capacitor Drone',
    basePower: 2,
    cost: 2,
    tribes: ['Drone', 'Tech'],
    abilities: {
      onEndOfTurn: [{
        kind: 'CONDITIONAL',
        if: { kind: 'HAS_UNSPENT_ENERGY', owner: 'SELF_OWNER' },
        then: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
      }],
    },
    cosmetic: {
      displayName: 'CAPACITOR DRONE',
      flavorText: 'Charges on patience.',
      rulesText: 'End of Turn: If you have unspent Energy, gain +1 Power.',
      accent: '#f9c74f',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'quiet-protocol',
    version: 1,
    name: 'Quiet Protocol',
    basePower: 0,
    cost: 2,
    tribes: ['AI', 'Hacker'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: ALL_FRIENDLY_LANE,
        delta: {
          kind: 'IF_ELSE',
          if: { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'hadUnspentEnergyLastTurn' },
          then: { kind: 'LIT', n: 1 },
          else: { kind: 'LIT', n: 0 },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'QUIET PROTOCOL',
      flavorText: 'Discipline propagates.',
      rulesText: 'Ongoing: Your cards have +1 Power if you ended last turn with unspent Energy.',
      accent: '#90e0ef',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'stored-charge',
    version: 1,
    name: 'Stored Charge',
    basePower: 3,
    cost: 3,
    tribes: ['Tech'],
    abilities: {
      ongoing: [{
        kind: 'COST_ADD',
        target: { kind: 'SELF' },
        delta: {
          kind: 'IF_ELSE',
          if: { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'hadUnspentEnergyLastTurn' },
          then: { kind: 'LIT', n: -1 },
          else: { kind: 'LIT', n: 0 },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'STORED CHARGE',
      flavorText: 'The patient hand gets the discount.',
      rulesText: 'Ongoing: Costs 1 less if you ended last turn with unspent Energy.',
      accent: '#ffd166',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'ambush-runner',
    version: 1,
    name: 'Ambush Runner',
    basePower: 4,
    cost: 3,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CONDITIONAL',
        if: { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'playedNoCardsLastTurn' },
        then: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 4 } }],
      }],
    },
    cosmetic: {
      displayName: 'AMBUSH RUNNER',
      flavorText: 'Silence was the preparation.',
      rulesText: 'On Reveal: If you played no cards last turn, gain +4 Power.',
      accent: '#f4a261',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'silent-engine',
    version: 1,
    name: 'Silent Engine',
    basePower: 5,
    cost: 4,
    tribes: ['AI', 'Tech'],
    abilities: {
      onEndOfTurn: [{
        kind: 'CONDITIONAL',
        if: { kind: 'HAS_UNSPENT_ENERGY', owner: 'SELF_OWNER' },
        then: [{
          kind: 'FOREACH',
          over: {
            kind: 'WHERE',
            of: ALL_FRIENDLY_LANE,
            pred: { kind: 'HAS_ONGOING', target: { kind: 'SELF' } },
          },
          do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
        }],
      }],
    },
    cosmetic: {
      displayName: 'SILENT ENGINE',
      flavorText: 'Restraint is the best amplifier.',
      rulesText: 'End of Turn: If you have unspent Energy, give your Ongoing cards +1 Power.',
      accent: '#caf0f8',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'delayed-payload',
    version: 1,
    name: 'Delayed Payload',
    basePower: 7,
    cost: 5,
    tribes: ['Tech', 'Military'],
    abilities: {
      ongoing: [{
        kind: 'COST_ADD',
        target: { kind: 'SELF' },
        delta: {
          kind: 'IF_ELSE',
          if: { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'spentNoEnergyLastTurn' },
          then: { kind: 'LIT', n: -2 },
          else: { kind: 'LIT', n: 0 },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'DELAYED PAYLOAD',
      flavorText: 'The most dangerous turn is the one you passed.',
      rulesText: 'Ongoing: Costs 2 less if you spent no Energy last turn.',
      accent: '#e63946',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'neon-singularity',
    version: 1,
    name: 'Neon Singularity',
    basePower: 6,
    cost: 6,
    tribes: ['AI', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: {
          kind: 'MUL',
          a: { kind: 'LIT', n: 2 },
          b: { kind: 'TRACKED_STAT', owner: 'SELF_OWNER', stat: 'energyUnspentLastTurn' },
        },
      }],
    },
    cosmetic: {
      displayName: 'NEON SINGULARITY',
      flavorText: 'Patience converts to power at the moment of impact.',
      rulesText: 'On Reveal: +2 Power for each Energy you had unspent last turn.',
      accent: '#ff6b9d',
      frame: 'legendary',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // ARCHETYPE: SWARM / GANG (065–074)
  // ==========================================================================

  {
    defId: 'street-kid',
    version: 1,
    name: 'Street Kid',
    basePower: 2,
    cost: 1,
    tribes: ['Merc'],
    abilities: {},
    cosmetic: {
      displayName: 'STREET KID',
      flavorText: 'Everywhere, all at once.',
      rulesText: '',
      accent: '#f4a261',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'drone-pup',
    version: 1,
    name: 'Drone Pup',
    basePower: 1,
    cost: 1,
    tribes: ['Drone'],
    abilities: {
      onDestroyed: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DEF_ID_LIST', ids: ['cheap-drone'] },
        owner: 'SELF_OWNER',
        destination: { kind: 'HAND' },
      }],
    },
    cosmetic: {
      displayName: 'DRONE PUP',
      flavorText: 'Every unit spawns a replacement.',
      rulesText: 'When Destroyed: Add a 1-Power Drone to your hand.',
      accent: '#adb5bd',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'gang-lookout',
    version: 1,
    name: 'Gang Lookout',
    basePower: 1,
    cost: 1,
    tribes: ['Merc'],
    abilities: {
      onAnyCardPlayedHere: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
    cosmetic: {
      displayName: 'GANG LOOKOUT',
      flavorText: 'Watches every play. Learns from every play.',
      rulesText: 'After a card is played here, gain +1 Power.',
      accent: '#e9c46a',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'drone-printer',
    version: 1,
    name: 'Drone Printer',
    basePower: 1,
    cost: 2,
    tribes: ['Drone', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DEF_ID_LIST', ids: ['cheap-drone'] },
        owner: 'SELF_OWNER',
        destination: { kind: 'LANE', lane: { kind: 'LANE_OF', of: { kind: 'SELF' } } },
      }],
    },
    cosmetic: {
      displayName: 'DRONE PRINTER',
      flavorText: 'Production never sleeps.',
      rulesText: 'On Reveal: Add a 1-Power Drone here.',
      accent: '#90e0ef',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'block-party',
    version: 1,
    name: 'Block Party',
    basePower: 2,
    cost: 2,
    tribes: ['Merc'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: SELF_LANE_FRIENDLY_EXCL_SELF,
        delta: {
          kind: 'IF_ELSE',
          if: { kind: 'LANE_FULL', laneOf: { kind: 'SELF' } },
          then: { kind: 'LIT', n: 1 },
          else: { kind: 'LIT', n: 0 },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'BLOCK PARTY',
      flavorText: 'When there\'s no room left, everyone\'s stronger.',
      rulesText: 'Ongoing: If this lane is full, your other cards here have +1 Power.',
      accent: '#e9c46a',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'pack-tactics',
    version: 1,
    name: 'Pack Tactics',
    basePower: 2,
    cost: 3,
    tribes: ['Military', 'Merc'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: SELF_LANE_FRIENDLY_EXCL_SELF,
        do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
      }],
    },
    cosmetic: {
      displayName: 'PACK TACTICS',
      flavorText: 'A crowd is a weapon.',
      rulesText: 'On Reveal: Give your other cards here +1 Power.',
      accent: '#495057',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'signal-rally',
    version: 1,
    name: 'Signal Rally',
    basePower: 3,
    cost: 3,
    tribes: ['AI'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: ALL_FRIENDLY_LANE,
          pred: { kind: 'COST_CMP', target: { kind: 'SELF' }, op: '==', value: { kind: 'LIT', n: 1 } },
        },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'SIGNAL RALLY',
      flavorText: 'The cheap parts fight hardest.',
      rulesText: 'Ongoing: Your 1-Cost cards have +1 Power.',
      accent: '#00b4d8',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'crowd-surge',
    version: 1,
    name: 'Crowd Surge',
    basePower: 4,
    cost: 4,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'TRACKED_STAT', owner: 'SELF_OWNER', stat: 'cardsPlayedThisTurn' },
      }],
    },
    cosmetic: {
      displayName: 'CROWD SURGE',
      flavorText: 'Momentum counts every body.',
      rulesText: 'On Reveal: +1 Power for each card you played this turn.',
      accent: '#e63946',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Full-lane payoff across all your locations; bespoke projection needed.
    defId: 'gutter-legion',
    version: 1,
    name: 'Gutter Legion',
    basePower: 5,
    cost: 5,
    tribes: ['Merc'],
    abilities: {
      ongoing: [{
        kind: 'CALL_BUILTIN' as any,
        fn: 'FULL_LANES_POWER',
        args: { ownerFilter: 'SELF_OWNER', delta: 3 },
      } as any],
    },
    cosmetic: {
      displayName: 'GUTTER LEGION',
      flavorText: 'A full block belongs to the gang.',
      rulesText: 'Ongoing: Your full locations have +3 Power.',
      accent: '#c1121f',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'hive-riot',
    version: 1,
    name: 'Hive Riot',
    basePower: 4,
    cost: 6,
    tribes: ['Drone', 'AI'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: {
          kind: 'WHERE',
          of: ALL_FRIENDLY_LANE,
          pred: { kind: 'COST_CMP', target: { kind: 'SELF' }, op: '==', value: { kind: 'LIT', n: 1 } },
        },
        do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
      }],
    },
    cosmetic: {
      displayName: 'HIVE RIOT',
      flavorText: 'When the swarm revolts, everyone pays.',
      rulesText: 'On Reveal: Give your 1-Cost cards +2 Power.',
      accent: '#f4a261',
      frame: 'legendary',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // SECONDARY: RUNNER / MOVEMENT (075–079)
  // ==========================================================================

  {
    defId: 'neon-courier',
    version: 1,
    name: 'Neon Courier',
    basePower: 3,
    cost: 2,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'MOVE_SELF_TO_RANDOM_OTHER_LANE',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'NEON COURIER',
      flavorText: 'Never where you left them.',
      rulesText: 'On Reveal: Move this to another location.',
      accent: '#ff6b9d',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'getaway-driver',
    version: 1,
    name: 'Getaway Driver',
    basePower: 4,
    cost: 3,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'GETAWAY DRIVER',
      flavorText: 'Knows which door leads out.',
      rulesText: 'On Reveal: Move one of your other cards here to another location.',
      accent: '#e9c46a',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'rooftop-runner',
    version: 1,
    name: 'Rooftop Runner',
    basePower: 3,
    cost: 3,
    tribes: ['Merc', 'Bio'],
    abilities: {
      onMove: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 3 },
      }],
    },
    cosmetic: {
      displayName: 'ROOFTOP RUNNER',
      flavorText: 'The run is the reward.',
      rulesText: 'When Moved: Gain +3 Power.',
      accent: '#80ed99',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'traffic-spoofer',
    version: 1,
    name: 'Traffic Spoofer',
    basePower: 5,
    cost: 4,
    tribes: ['Hacker', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'TRAFFIC SPOOFER',
      flavorText: 'Re-routes the threat before it arrives.',
      rulesText: 'On Reveal: Move the lowest-Power enemy card here to another location.',
      accent: '#7209b7',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'escape-route',
    version: 1,
    name: 'Escape Route',
    basePower: 6,
    cost: 5,
    tribes: ['Tech'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: ALL_FRIENDLY_LANE,
          pred: { kind: 'EVER_MOVED', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'ESCAPE ROUTE',
      flavorText: 'Movement is remembered.',
      rulesText: 'Ongoing: Your cards that have moved this game have +1 Power.',
      accent: '#adb5bd',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // SECONDARY: BIOHACK / CYBERWARE (080–084)
  // ==========================================================================

  {
    defId: 'chrome-surgeon',
    version: 1,
    name: 'Chrome Surgeon',
    basePower: 2,
    cost: 2,
    tribes: ['Bio'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: {
          kind: 'FIRST_N',
          count: { kind: 'LIT', n: 1 },
          of: ALL_FRIENDLY_HAND,
        },
        delta: { kind: 'LIT', n: 2 },
      }],
    },
    cosmetic: {
      displayName: 'CHROME SURGEON',
      flavorText: 'What\'s in your hand will serve you better now.',
      rulesText: 'On Reveal: Give the first card in your hand +2 Power.',
      accent: '#b5838d',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'reflex-booster',
    version: 1,
    name: 'Reflex Booster',
    basePower: 1,
    cost: 2,
    tribes: ['Bio', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 }, of: SELF_LANE_FRIENDLY_EXCL_SELF },
        delta: { kind: 'LIT', n: 3 },
      }],
    },
    cosmetic: {
      displayName: 'REFLEX BOOSTER',
      flavorText: 'One implant changes everything.',
      rulesText: 'On Reveal: Give a random friendly card here +3 Power.',
      accent: '#c77dff',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    // "When this gains Power, draw a card" — reactive power-gain trigger.
    defId: 'adrenal-graft',
    version: 1,
    name: 'Adrenal Graft',
    basePower: 3,
    cost: 3,
    tribes: ['Bio'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'DRAW_ON_POWER_GAIN',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'ADRENAL GRAFT',
      flavorText: 'Every boost sharpens the mind.',
      rulesText: 'When this gains Power, draw a card.',
      accent: '#f4a261',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'wetware-saint',
    version: 1,
    name: 'Wetware Saint',
    basePower: 5,
    cost: 4,
    tribes: ['Bio', 'AI'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: SELF_LANE_FRIENDLY,
          pred: { kind: 'POWER_INCREASED', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'WETWARE SAINT',
      flavorText: 'She blesses what is already enhanced.',
      rulesText: 'Ongoing: Your cards here with increased Power have +1 Power.',
      accent: '#e040fb',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'illegal-implant',
    version: 1,
    name: 'Illegal Implant',
    basePower: 8,
    cost: 5,
    tribes: ['Bio', 'Tech'],
    abilities: {
      ongoing: [{
        kind: 'COST_ADD',
        target: { kind: 'SELF' },
        delta: {
          kind: 'IF_ELSE',
          if: { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'reducedAnyCostThisGame' },
          then: { kind: 'LIT', n: -1 },
          else: { kind: 'LIT', n: 0 },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'ILLEGAL IMPLANT',
      flavorText: 'The market rewarded the rule-breaker.',
      rulesText: 'Ongoing: Costs 1 less if you reduced a card\'s Cost this game.',
      accent: '#9d4edd',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // SECONDARY: SURVEILLANCE (085–088)
  // ==========================================================================

  {
    defId: 'camera-rat',
    version: 1,
    name: 'Camera Rat',
    basePower: 2,
    cost: 1,
    tribes: ['Hacker', 'Drone'],
    abilities: {
      onReveal: [{
        kind: 'CONDITIONAL',
        if: {
          kind: 'NUM_CMP',
          a: { kind: 'HAND_SIZE', owner: 'OPP_OWNER' },
          op: '>=',
          b: { kind: 'LIT', n: 5 },
        },
        then: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
      }],
    },
    cosmetic: {
      displayName: 'CAMERA RAT',
      flavorText: 'Watches the hand. Reports to the boss.',
      rulesText: 'On Reveal: If your opponent has 5 or more cards in hand, gain +2 Power.',
      accent: '#adb5bd',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'blackmail-file',
    version: 1,
    name: 'Blackmail File',
    basePower: 2,
    cost: 2,
    tribes: ['Hacker', 'Corp'],
    abilities: {
      onReveal: [{
        kind: 'ADJUST_COST',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: {
            kind: 'ALL_CARDS',
            ownerFilter: 'OPP_OWNER',
            zoneFilter: 'HAND',
          },
        },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
    cosmetic: {
      displayName: 'BLACKMAIL FILE',
      flavorText: 'What they don\'t know costs them.',
      rulesText: 'On Reveal: Increase the Cost of a random card in your opponent\'s hand by 1.',
      accent: '#212529',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'predictive-cop',
    version: 1,
    name: 'Predictive Cop',
    basePower: 3,
    cost: 3,
    tribes: ['AI', 'Military'],
    abilities: {
      onReveal: [{
        kind: 'CONDITIONAL',
        if: {
          kind: 'EXISTS',
          target: {
            kind: 'WHERE',
            of: SELF_LANE_ENEMY,
            pred: { kind: 'HAS_TAG', target: { kind: 'SELF' }, tag: 'PLAYED_THIS_TURN' },
          },
        },
        then: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 4 } }],
      }],
    },
    cosmetic: {
      displayName: 'PREDICTIVE COP',
      flavorText: 'The crime was already calculated.',
      rulesText: 'On Reveal: If your opponent played a card here this turn, gain +4 Power.',
      accent: '#003049',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // "Enemy cards added to hand have -1 Power" — reactive hand-entry trigger.
    defId: 'panopticon-ai',
    version: 1,
    name: 'Panopticon AI',
    basePower: 5,
    cost: 5,
    tribes: ['AI', 'Hacker'],
    abilities: {
      ongoing: [{
        kind: 'CALL_BUILTIN' as any,
        fn: 'DEBUFF_ENEMY_ON_HAND_ENTRY',
        args: { delta: -1 },
      } as any],
    },
    cosmetic: {
      displayName: 'PANOPTICON AI',
      flavorText: 'Every card they draw arrives weaker.',
      rulesText: 'Ongoing: Enemy cards added to hand have -1 Power.',
      accent: '#4361ee',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // SECONDARY: MALWARE (089–092)
  // ==========================================================================

  {
    defId: 'junk-packet',
    version: 1,
    name: 'Junk Packet',
    basePower: 1,
    cost: 1,
    tribes: ['Hacker', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DEF_ID_LIST', ids: ['junk-card'] },
        owner: 'OPP_OWNER' as any,
        destination: { kind: 'DECK', position: 'BOTTOM' },
      }],
    },
    cosmetic: {
      displayName: 'JUNK PACKET',
      flavorText: 'Worthless data travels fastest.',
      rulesText: 'On Reveal: Add a 0-Power Junk card to your opponent\'s deck.',
      accent: '#adb5bd',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'deck-worm',
    version: 1,
    name: 'Deck Worm',
    basePower: 2,
    cost: 2,
    tribes: ['Hacker', 'AI'],
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: {
          kind: 'FIRST_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'ALL_CARDS', ownerFilter: 'OPP_OWNER', zoneFilter: 'DECK' },
        },
        delta: { kind: 'LIT', n: -3 },
      }],
    },
    cosmetic: {
      displayName: 'DECK WORM',
      flavorText: 'It finds the next card before they do.',
      rulesText: 'On Reveal: Give the top card of your opponent\'s deck -3 Power.',
      accent: '#9d4edd',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Copies top enemy deck card to hand — needs identity resolution by engine.
    defId: 'data-leech',
    version: 1,
    name: 'Data Leech',
    basePower: 3,
    cost: 3,
    tribes: ['Hacker'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'COPY_TOP_ENEMY_DECK_CARD_TO_HAND',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'DATA LEECH',
      flavorText: 'Takes the best card before you can draw it.',
      rulesText: 'On Reveal: Add a copy of the top card of your opponent\'s deck to your hand.',
      accent: '#560bad',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'corruption-bloom',
    version: 1,
    name: 'Corruption Bloom',
    basePower: 4,
    cost: 4,
    tribes: ['AI', 'Hacker'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'WHERE',
          of: SELF_LANE_ENEMY,
          pred: { kind: 'POWER_REDUCED', target: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: -1 },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'CORRUPTION BLOOM',
      flavorText: 'What is weakened keeps weakening.',
      rulesText: 'Ongoing: Enemy cards here with reduced Power have -1 Power.',
      accent: '#3a0ca3',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // SECONDARY: DISCARD / MEMORY WIPE (093–094)
  // ==========================================================================

  {
    defId: 'memory-burner',
    version: 1,
    name: 'Memory Burner',
    basePower: 4,
    cost: 2,
    tribes: ['Hacker'],
    abilities: {
      onReveal: [{
        kind: 'DISCARD',
        target: { kind: 'MIN_COST_OF', of: ALL_FRIENDLY_HAND },
      }],
    },
    cosmetic: {
      displayName: 'MEMORY BURNER',
      flavorText: 'What you lose you can\'t be questioned about.',
      rulesText: 'On Reveal: Discard the lowest-Cost card in your hand.',
      accent: '#e63946',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Recovers a discarded card — needs discard pile history lookup.
    defId: 'backup-ghost',
    version: 1,
    name: 'Backup Ghost',
    basePower: 3,
    cost: 3,
    tribes: ['AI'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'ADD_DISCARDED_CARD_TO_HAND',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'BACKUP GHOST',
      flavorText: 'Everything deleted leaves a trace.',
      rulesText: 'On Reveal: Add a card you discarded this game to your hand.',
      accent: '#4cc9f0',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // GENERIC / VANILLA (095–100)
  // ==========================================================================

  {
    defId: 'street-samurai',
    version: 1,
    name: 'Street Samurai',
    basePower: 4,
    cost: 2,
    tribes: ['Merc'],
    abilities: {},
    cosmetic: {
      displayName: 'STREET SAMURAI',
      flavorText: 'Code and steel. In that order.',
      rulesText: '',
      accent: '#dee2e6',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'armored-van',
    version: 1,
    name: 'Armored Van',
    basePower: 5,
    cost: 3,
    tribes: ['Military', 'Tech'],
    abilities: {},
    cosmetic: {
      displayName: 'ARMORED VAN',
      flavorText: 'Doesn\'t need an ability. It\'s an armored van.',
      rulesText: '',
      accent: '#6c757d',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'night-market-scout',
    version: 1,
    name: 'Night Market Scout',
    basePower: 1,
    cost: 1,
    tribes: ['Merc'],
    abilities: {
      onReveal: [{
        kind: 'CONDITIONAL',
        if: { kind: 'HAND_EMPTY', owner: 'SELF_OWNER' },
        then: [{ kind: 'DRAW', owner: 'SELF_OWNER', count: { kind: 'LIT', n: 1 } }],
      }],
    },
    cosmetic: {
      displayName: 'NIGHT MARKET SCOUT',
      flavorText: 'Empty hands don\'t survive long.',
      rulesText: 'On Reveal: If your hand is empty, draw a card.',
      accent: '#f4a261',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'metro-enforcer',
    version: 1,
    name: 'Metro Enforcer',
    basePower: 7,
    cost: 4,
    tribes: ['Military'],
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SELF' },
        delta: {
          kind: 'IF_ELSE',
          if: {
            kind: 'NOT',
            p: { kind: 'EXISTS', target: SELF_LANE_FRIENDLY_EXCL_SELF },
          },
          then: { kind: 'LIT', n: 2 },
          else: { kind: 'LIT', n: 0 },
        },
        stack: 'ADDITIVE',
      }],
    },
    cosmetic: {
      displayName: 'METRO ENFORCER',
      flavorText: 'Alone in the lane. Exactly how they like it.',
      rulesText: 'Ongoing: +2 Power if this is your only card here.',
      accent: '#495057',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'cheap-drone',
    version: 1,
    name: 'Cheap Drone',
    basePower: 1,
    cost: 1,
    tribes: ['Drone'],
    abilities: {},
    cosmetic: {
      displayName: 'CHEAP DRONE',
      flavorText: 'Expendable by design.',
      rulesText: '',
      accent: '#adb5bd',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'loaded-suit',
    version: 1,
    name: 'Loaded Suit',
    basePower: 8,
    cost: 5,
    tribes: ['Corp'],
    abilities: {},
    cosmetic: {
      displayName: 'LOADED SUIT',
      flavorText: 'The money did the talking before they walked in.',
      rulesText: '',
      accent: '#ffd60a',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // COUNTER / TECH CARDS (101–105)
  // ==========================================================================

  {
    defId: 'union-rep',
    version: 1,
    name: 'Union Rep',
    basePower: 2,
    cost: 2,
    tribes: ['Corp', 'Merc'],
    abilities: {
      ongoing: [{
        kind: 'BLOCK_FRIENDLY_DESTROY',
        laneOf: { kind: 'SELF' },
        stack: 'SINGLE',
      }],
    },
    cosmetic: {
      displayName: 'UNION REP',
      flavorText: 'Your own cards can\'t touch them while she\'s watching.',
      rulesText: 'Ongoing: Your cards here cannot be destroyed by your own cards.',
      accent: '#e9c46a',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'white-hat-auditor',
    version: 1,
    name: 'White-Hat Auditor',
    basePower: 3,
    cost: 3,
    tribes: ['Hacker', 'Corp'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: {
          kind: 'WHERE',
          of: SELF_LANE_ENEMY,
          pred: { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
        },
        do: [{ kind: 'REMOVE_TEXT', target: { kind: 'SELF' }, textKind: 'ALL' }],
      }],
    },
    cosmetic: {
      displayName: 'WHITE-HAT AUDITOR',
      flavorText: 'Unauthorised assets get flagged and stripped.',
      rulesText: 'On Reveal: Enemy created cards here lose their text.',
      accent: '#dee2e6',
      frame: 'rare',
      art: { portrait: { path: '' } },
    },
  },

  {
    // Temporarily disables Ongoing effects in this lane for this turn.
    defId: 'emp-grenade',
    version: 1,
    name: 'EMP Grenade',
    basePower: 2,
    cost: 3,
    tribes: ['Military', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'CALL_BUILTIN',
        fn: 'DISABLE_ONGOINGS_THIS_LANE_THIS_TURN',
        args: {},
      }],
    },
    cosmetic: {
      displayName: 'EMP GRENADE',
      flavorText: 'Silence is the loudest weapon.',
      rulesText: 'On Reveal: Disable Ongoing effects here this turn.',
      accent: '#f9c74f',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'kill-switch',
    version: 1,
    name: 'Kill Switch',
    basePower: 4,
    cost: 4,
    tribes: ['Hacker', 'Tech'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: {
          kind: 'SAME_LANE',
          of: { kind: 'SELF' },
          ownerFilter: 'ANY_OWNER',
        },
        do: [{ kind: 'REMOVE_COPIED_TEXT', target: { kind: 'SELF' } }],
      }],
    },
    cosmetic: {
      displayName: 'KILL SWITCH',
      flavorText: 'The deal is off. All of it.',
      rulesText: 'On Reveal: Remove copied text from all cards here.',
      accent: '#c1121f',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  {
    defId: 'hard-reset',
    version: 1,
    name: 'Hard Reset',
    basePower: 5,
    cost: 5,
    tribes: ['AI', 'Hacker'],
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: {
          kind: 'SAME_LANE',
          of: { kind: 'SELF' },
          ownerFilter: 'ANY_OWNER',
        },
        do: [{ kind: 'RESET_POWER', target: { kind: 'SELF' } }],
      }],
    },
    cosmetic: {
      displayName: 'HARD RESET',
      flavorText: 'Everything goes back to factory.',
      rulesText: 'On Reveal: Reset all cards here to base Power.',
      accent: '#023e8a',
      frame: 'epic',
      art: { portrait: { path: '' } },
    },
  },

  // ==========================================================================
  // TOKEN CARDS (spawned by other cards, not in decks)
  // ==========================================================================

  {
    defId: 'junk-card',
    version: 1,
    name: 'Junk',
    basePower: 0,
    cost: 1,
    tribes: [],
    abilities: {},
    cosmetic: {
      displayName: 'JUNK',
      flavorText: 'Corrupted. Useless. Unavoidable.',
      rulesText: '',
      accent: '#6c757d',
      frame: 'common',
      art: { portrait: { path: '' } },
    },
  },
];

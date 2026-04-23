/**
 * Launch card set (10 entries) for Galactic Snap / Spec 0.2.
 *
 * Ported from the demo's `services/playgame/cards.ts`. Stats and rules
 * text preserved verbatim; ability bodies are encoded in the spec DSL
 * where the primitive is already designed (On-Reveal add-power, Ongoing
 * power-add, single-target move). Cards whose text needs primitives that
 * haven't been added to the DSL yet (hand manipulation, on-move triggers)
 * have their abilities left as `{}` with a TODO note — they still port
 * correctly, just as inert data until the primitive lands.
 *
 * Art: the demo renders a solid-color bar using the old `art: '#hex'`
 * field. We carry that through as `cosmetic.accent` and leave
 * `cosmetic.art.portrait.path` empty; the /play screen will keep using
 * the accent color until actual portrait images are authored.
 */

import type { CardDef } from '../types';

// ---- Friendlies: Ongoing power buffs ---------------------------------------

export const SENTINEL: CardDef = {
  defId: 'sentinel',
  version: 1,
  name: 'Sentinel',
  basePower: 5,
  cost: 3,
  tribes: ['guard'],
  abilities: {
    ongoing: [
      {
        kind: 'LANE_POWER_ADD',
        laneScope: { laneOf: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'SENTINEL',
    flavorText: 'Watch-tower protocol, eternal.',
    rulesText: 'Ongoing: This lane has +1 Power.',
    accent: '#6cc3ff',
    frame: 'common',
    art: { portrait: { path: '' } },
  },
};

export const SKY_MARSHAL: CardDef = {
  defId: 'sky-marshal',
  version: 1,
  name: 'Sky Marshal',
  basePower: 8,
  cost: 5,
  tribes: ['guard'],
  abilities: {
    ongoing: [
      {
        kind: 'POWER_ADD',
        target: {
          kind: 'SAME_LANE',
          of: { kind: 'SELF' },
          ownerFilter: 'SELF_OWNER',
          exclude: { kind: 'SELF' },
        },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'SKY MARSHAL',
    flavorText: 'Forms up the line without a word.',
    rulesText: 'Ongoing: Your other cards here have +1 Power.',
    accent: '#ffd95a',
    frame: 'rare',
    art: { portrait: { path: '' } },
  },
};

export const SUN_BEACON: CardDef = {
  defId: 'sun-beacon',
  version: 1,
  name: 'Sun Beacon',
  basePower: 5,
  cost: 4,
  tribes: ['guard'],
  abilities: {
    // "Cards you play here get +1 Power" is, for projection purposes,
    // equivalent to "your cards here have +1 Power" — both evaluate to
    // the same POWER_ADD aura. A later balance-pass could distinguish
    // "retroactive vs. only-going-forward" if desired.
    ongoing: [
      {
        kind: 'POWER_ADD',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      },
    ],
  },
  cosmetic: {
    displayName: 'SUN BEACON',
    flavorText: 'A torch that never asks to be carried.',
    rulesText: 'Ongoing: Cards you play here get +1 Power.',
    accent: '#fff2b5',
    frame: 'rare',
    art: { portrait: { path: '' } },
  },
};

// ---- Friendlies: On Reveal buffs -------------------------------------------

export const HEX_WITCH: CardDef = {
  defId: 'hex-witch',
  version: 1,
  name: 'Hex Witch',
  basePower: 2,
  cost: 2,
  tribes: ['mage'],
  abilities: {
    onReveal: [
      {
        kind: 'ADD_POWER',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: {
            kind: 'ALL_CARDS',
            ownerFilter: 'SELF_OWNER',
            zoneFilter: 'LANE',
          },
        },
        delta: { kind: 'LIT', n: 1 },
      },
    ],
  },
  cosmetic: {
    displayName: 'HEX WITCH',
    flavorText: 'Luck is a verb she conjugates casually.',
    rulesText: 'On Reveal: Give a random friendly card +1 Power.',
    accent: '#a66dff',
    frame: 'common',
    art: { portrait: { path: '' } },
  },
};

export const PYRO_MONK: CardDef = {
  defId: 'pyro-monk',
  version: 1,
  name: 'Pyro Monk',
  basePower: 4,
  cost: 3,
  tribes: ['mage'],
  abilities: {
    onReveal: [
      {
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        delta: { kind: 'LIT', n: 1 },
      },
    ],
  },
  cosmetic: {
    displayName: 'PYRO MONK',
    flavorText: 'Meditates by lighting the room.',
    rulesText: 'On Reveal: All cards in this lane gain +1 Power.',
    accent: '#ffb347',
    frame: 'rare',
    art: { portrait: { path: '' } },
  },
};

// ---- Hostiles: On Reveal debuffs -------------------------------------------

export const BLADE_RUNNER: CardDef = {
  defId: 'blade-runner',
  version: 1,
  name: 'Blade Runner',
  basePower: 3,
  cost: 2,
  tribes: ['striker'],
  abilities: {
    onReveal: [
      {
        kind: 'ADD_POWER',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: {
            kind: 'SAME_LANE',
            of: { kind: 'SELF' },
            ownerFilter: 'OPP_OWNER',
          },
        },
        delta: { kind: 'LIT', n: -1 },
      },
    ],
  },
  cosmetic: {
    displayName: 'BLADE RUNNER',
    flavorText: 'Never breaks stride, never breaks eye contact.',
    rulesText: 'On Reveal: Deal 1 damage to an enemy card here.',
    accent: '#ff5a1f',
    frame: 'common',
    art: { portrait: { path: '' } },
  },
};

export const ICE_LANCE: CardDef = {
  defId: 'ice-lance',
  version: 1,
  name: 'Ice Lance',
  basePower: 2,
  cost: 1,
  tribes: ['striker'],
  abilities: {
    onReveal: [
      {
        kind: 'ADD_POWER',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: {
            kind: 'SAME_LANE',
            of: { kind: 'SELF' },
            ownerFilter: 'OPP_OWNER',
          },
        },
        delta: { kind: 'LIT', n: -1 },
      },
    ],
  },
  cosmetic: {
    displayName: 'ICE LANCE',
    flavorText: 'Freezes the gap between swing and answer.',
    rulesText: 'On Reveal: Afflict an enemy card here with -1 Power.',
    accent: '#bfefff',
    frame: 'common',
    art: { portrait: { path: '' } },
  },
};

// ---- Movement / triggered (DSL primitive not yet implemented) --------------

export const DUNE_SAPPER: CardDef = {
  defId: 'dune-sapper',
  version: 1,
  name: 'Dune Sapper',
  basePower: 1,
  cost: 1,
  tribes: ['striker'],
  abilities: {
    onReveal: [
      {
        kind: 'MOVE',
        target: { kind: 'SELF' },
        // "Another random location" — the MOVE op's `to` is a Selector
        // that must resolve to exactly one lane. `RANDOM_N count=1 of
        // OTHER_LANES(SELF)` fits. Step 6 will wire up the lane-targeted
        // form of MOVE.
        to: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'OTHER_LANES', of: { kind: 'SELF' } },
        },
      },
    ],
  },
  cosmetic: {
    displayName: 'DUNE SAPPER',
    flavorText: 'Here, then gone, like weather.',
    rulesText: 'On Reveal: Move to another location.',
    accent: '#e3bdff',
    frame: 'common',
    art: { portrait: { path: '' } },
  },
};

export const THORN_CHOIR: CardDef = {
  defId: 'thorn-choir',
  version: 1,
  name: 'Thorn Choir',
  basePower: 3,
  cost: 2,
  tribes: ['mage'],
  abilities: {
    // Buffs cards currently in the owner's hand. Exercises ALL_CARDS +
    // zoneFilter=HAND + SELF_OWNER.
    onReveal: [
      {
        kind: 'ADD_POWER',
        target: {
          kind: 'ALL_CARDS',
          ownerFilter: 'SELF_OWNER',
          zoneFilter: 'HAND',
        },
        delta: { kind: 'LIT', n: 1 },
      },
    ],
  },
  cosmetic: {
    displayName: 'THORN CHOIR',
    flavorText: 'Sings in a key that sharpens steel.',
    rulesText: 'On Reveal: Give cards in your hand +1 Power.',
    accent: '#9cff4a',
    frame: 'rare',
    art: { portrait: { path: '' } },
  },
};

export const VOID_HOUND: CardDef = {
  defId: 'void-hound',
  version: 1,
  name: 'Void Hound',
  basePower: 6,
  cost: 4,
  tribes: ['beast'],
  // TODO (Step 6+): "When this moves, gain +2 power" needs an on-move
  // trigger slot on CardAbilities. Not yet in the DSL — leave abilities
  // empty for now; the card ports as inert stats + cosmetic.
  abilities: {},
  cosmetic: {
    displayName: 'VOID HOUND',
    flavorText: 'Every place it\u2019s been is one place away.',
    rulesText: 'When this moves, gain +2 Power.',
    accent: '#6b3ea0',
    frame: 'rare',
    art: { portrait: { path: '' } },
  },
};

// ---- Launch pool -----------------------------------------------------------

export const CARDS_INDEX: readonly CardDef[] = [
  BLADE_RUNNER,
  DUNE_SAPPER,
  HEX_WITCH,
  ICE_LANCE,
  PYRO_MONK,
  SENTINEL,
  SKY_MARSHAL,
  SUN_BEACON,
  THORN_CHOIR,
  VOID_HOUND,
];

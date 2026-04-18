import { CardDefinition, LocationDefinition } from './types';
import { getImg } from './utils/assets';

/**
 * MASTER CARD REGISTRY
 * Each card now includes 'logic' instructions which will eventually 
 * allow the Ability Engine to execute effects without hardcoded TS.
 */
export const CARDS: CardDefinition[] = [
    {
        id: 'c1',
        name: 'Recruit',
        rarity: 'Common',
        baseCost: 1,
        basePower: 2,
        tags: [],
        baseText: 'No ability.',
        effect: 'None',
        logic: [],
        imageUrl: getImg(1),
        sfxOnPlay: 'sfx_deploy_soldier',
        flavorText: 'Every legend starts as a number in a spreadsheet.'
    },
    {
        id: 'c2',
        name: 'Grenadier',
        rarity: 'Common',
        baseCost: 1,
        basePower: 1,
        tags: ['OnReveal', 'Destroy'],
        baseText: 'On Reveal: Destroy a random 1-cost card at this location.',
        effect: 'GrenadierEffect',
        logic: [
            { action: 'DESTROY', target: 'RANDOM_ENEMY', value: 'COST=1' }
        ],
        imageUrl: getImg(2),
        sfxOnPlay: 'sfx_equip_light',
        sfxOnReveal: 'sfx_grenade_explode',
        vfxOnReveal: 'vfx_explosion_small',
        flavorText: 'He doesn\'t care whose side they were on; a 1-cost is a 1-cost.'
    },
    {
        id: 'c3',
        name: 'Commander',
        rarity: 'Rare',
        baseCost: 3,
        basePower: 3,
        tags: ['Ongoing', 'Buff'],
        baseText: 'On Going: Your other cards at this location have +1 Power.',
        effect: 'CommanderEffect',
        logic: [
            { action: 'MODIFY_STAT', target: 'FRIENDLY_LANE', stat: 'POWER', value: 1 }
        ],
        imageUrl: getImg(3),
        flavorText: 'Voices carrying over the din of laser fire.'
    },
    {
        id: 'c4',
        name: 'Scout',
        rarity: 'Common',
        baseCost: 1,
        basePower: 2,
        tags: ['OnReveal'],
        baseText: 'On Reveal: Add a +1 Power Copy of this card to your hand.',
        effect: 'ScoutEffect',
        imageUrl: getImg(4),
        flavorText: 'Information is the only resource that multiplies when shared.'
    },
    {
        id: 'c5',
        name: 'Jumper',
        rarity: 'Rare',
        baseCost: 2,
        basePower: 3,
        tags: ['OnReveal', 'Move'],
        baseText: 'On Reveal: Move this card to the location to the right.',
        effect: 'JumperEffect',
        imageUrl: getImg(5),
        sfxOnPlay: 'sfx_equip_tech',
        sfxOnReveal: 'sfx_teleport_short',
        vfxOnReveal: 'vfx_warp_trail',
        flavorText: 'Gravity is more of a suggestion than a law.'
    },
    {
        id: 'c6',
        name: 'Titan',
        rarity: 'Epic',
        baseCost: 6,
        basePower: 12,
        tags: [],
        baseText: 'Big stats.',
        effect: 'None',
        imageUrl: getImg(6),
        flavorText: 'When it walks, the stars tremble.'
    },
    {
        id: 'c7',
        name: 'Saboteur',
        rarity: 'Rare',
        baseCost: 2,
        basePower: 1,
        tags: ['OnReveal', 'Debuff'],
        baseText: 'On Reveal: Give all enemy cards here -1 Power.',
        effect: 'SaboteurEffect',
        imageUrl: getImg(7),
        flavorText: 'A cut wire here, a loose bolt there...'
    },
    {
        id: 'c8',
        name: 'Omni-Bot',
        rarity: 'Epic',
        baseCost: 3,
        basePower: 2,
        tags: ['Ongoing', 'Buff'],
        baseText: 'On Going: +2 Power for each other card you have here.',
        effect: 'OmniBotEffect',
        imageUrl: getImg(8),
        flavorText: 'Unity through circuitry.'
    },
    {
        id: 'c9',
        name: 'Portal Mage',
        rarity: 'Legendary',
        baseCost: 4,
        basePower: 4,
        tags: ['OnReveal', 'Summon'],
        baseText: 'On Reveal: Add two random 1-cost cards here.',
        effect: 'PortalMageEffect',
        imageUrl: getImg(9),
        flavorText: 'The multiverse is just a collection of open doors.'
    },
    {
        id: 'c10',
        name: 'Annihilator',
        rarity: 'Legendary',
        baseCost: 5,
        basePower: 4,
        tags: ['OnReveal', 'Destroy'],
        baseText: 'On Reveal: Destroy ALL other cards at this location.',
        effect: 'AnnihilatorEffect',
        imageUrl: getImg(10),
        flavorText: 'There is beauty in a blank slate.'
    },
    {
        id: 'c11',
        name: 'Venom',
        rarity: 'Epic',
        baseCost: 3,
        basePower: 3,
        tags: ['OnReveal', 'Destroy', 'Buff'],
        baseText: 'On Reveal: Destroy your other cards at this location. Add their Power to this card.',
        effect: 'VenomEffect',
        imageUrl: getImg(11),
        flavorText: 'The pack survives by becoming the alpha.'
    },
    {
        id: 'c12',
        name: 'Nova',
        rarity: 'Rare',
        baseCost: 1,
        basePower: 2,
        tags: ['OnDestroy', 'Buff'],
        baseText: 'On Destroy: Give all your other cards +1 Power.',
        effect: 'NovaEffect',
        imageUrl: getImg(12),
        flavorText: 'Even in death, a star provides light.'
    },
    {
        id: 'c13',
        name: 'Carnage',
        rarity: 'Epic',
        baseCost: 2,
        basePower: 2,
        tags: ['OnReveal', 'Destroy', 'Buff'],
        baseText: 'On Reveal: Destroy your other cards here. +2 Power for each destroyed.',
        effect: 'CarnageEffect',
        imageUrl: getImg(13),
        flavorText: 'Efficiency is found in reduction.'
    },
    {
        id: 'c14',
        name: 'Wolverine',
        rarity: 'Legendary',
        baseCost: 2,
        basePower: 2,
        tags: ['OnDestroy', 'OnDiscard', 'Buff', 'Summon'],
        baseText: 'When this is discarded or destroyed, regenerate it at a random location with +2 Power.',
        effect: 'WolverineEffect',
        imageUrl: getImg(14),
        flavorText: 'He\'s the best at what he does.'
    },
    {
        id: 'c15',
        name: 'Death',
        rarity: 'Legendary',
        baseCost: 8,
        basePower: 12,
        tags: ['Ongoing'],
        baseText: 'Costs 1 less for each card destroyed this game.',
        effect: 'DeathCostEffect',
        imageUrl: getImg(15),
        flavorText: 'The end is just the beginning of a better price.'
    }
];

export const LOCATION_DEFS: LocationDefinition[] = [
  { 
      id: 'l1', 
      name: 'The Ruins', 
      description: 'No effect.', 
      effect: 'None', 
      imageUrl: getImg(101),
      sfxOnReveal: 'sfx_ruins_crumble',
      vfxAmbient: 'vfx_dust_motes'
  },
  { 
      id: 'l2', 
      name: 'Power Plant', 
      description: 'Cards here have +1 Power.', 
      effect: 'PowerPlantEffect', 
      imageUrl: getImg(102),
      sfxOnReveal: 'sfx_power_hum',
      vfxAmbient: 'vfx_electric_arcs' 
  },
  { 
      id: 'l3', 
      name: 'Nebula', 
      description: 'On Reveal effects happen twice here.', 
      effect: 'NebulaEffect', 
      imageUrl: getImg(103),
      sfxOnReveal: 'sfx_space_shimmer',
      vfxAmbient: 'vfx_nebula_fog'
  },
];

export const PLAYER_DECK_IDS = CARDS.map(c => c.id).slice(0, 12); 
export const OPPONENT_DECK_IDS = CARDS.map(c => c.id).slice(0, 12);
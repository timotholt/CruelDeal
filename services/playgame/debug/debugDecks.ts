/**
 * DEBUG ONLY — remove before production.
 *
 * Starter deck definitions sourced from:
 *   documents/04_DECKS/Cyberpunk_CCG_Starter_Decks_v0.2.txt
 *
 * These are test harnesses for playtesting archetypes, not final balance targets.
 */

import type { Deck } from '../engine/manifest/types';

export interface DebugDeck {
  readonly id: string;
  readonly name: string;
  readonly archetype: string;
  readonly difficulty: string;
  readonly gamePlan: string;
  readonly color: string;
  readonly cards: Deck; // exactly 12
}

export const DEBUG_DECKS: readonly DebugDeck[] = [
  {
    id: 'street-destroy',
    name: 'Street Destroy',
    archetype: 'Destroy',
    difficulty: 'Easy / Medium',
    gamePlan: 'Sacrifice cheap bodies for value. Close with destroyed-count payoffs.',
    color: '#ff4444',
    cards: [
      { defId: 'scrap-rat' }, { defId: 'crash-dummy' }, { defId: 'chop-doc' }, { defId: 'grinder-crew' },
      { defId: 'redline-bruiser' }, { defId: 'parts-collector' }, { defId: 'rust-revenant' }, { defId: 'bone-market' },
      { defId: 'meat-grinder' }, { defId: 'scrapyard-king' }, { defId: 'golden-parachute' }, { defId: 'illegal-clone' },
    ],
  },
  {
    id: 'corporate-copy',
    name: 'Corp Spec',
    archetype: 'Ongoing',
    difficulty: 'Medium',
    gamePlan: 'Stack Ongoing lane buffs, flood protected bodies, then cash crowded lanes into Power.',
    color: '#4488ff',
    cards: [
      { defId: 'rent-a-cop' }, { defId: 'hired-gun' }, { defId: 'riff-raff' }, { defId: 'signal-rally' },
      { defId: 'signal-booster' }, { defId: 'boardroom-proxy' }, { defId: 'security-detail' }, { defId: 'gun-dealer' },
      { defId: 'corporate-climber' }, { defId: 'block-party' },
      { defId: 'ai-overseer' }, { defId: 'citywide-mesh' },
    ],
  },
  {
    id: 'fixer-network',
    name: 'Fixer Network',
    archetype: 'Fixer',
    difficulty: 'Medium',
    gamePlan: 'Draw tagged cards, replace weak options, create extra resources.',
    color: '#ffaa00',
    cards: [
      { defId: 'street-fixer' }, { defId: 'tech-fixer' }, { defId: 'military-fixer' }, { defId: 'chrome-broker' },
      { defId: 'backchannel-contact' }, { defId: 'clean-operator' }, { defId: 'procurement-bot' }, { defId: 'dead-drop' },
      { defId: 'talent-scout' }, { defId: 'network-queen' }, { defId: 'ai-overseer' }, { defId: 'black-market-dealer' },
    ],
  },
  {
    id: 'nanotech-mesh',
    name: 'Nanotech Mesh',
    archetype: 'Nanotech / AI',
    difficulty: 'Easy / Medium',
    gamePlan: 'Build Ongoing engines. Let small persistent buffs scale over time.',
    color: '#00ddaa',
    cards: [
      { defId: 'street-fixer' }, { defId: 'procurement-bot' }, { defId: 'rent-a-cop' }, { defId: 'signal-booster' },
      { defId: 'adaptive-shell' }, { defId: 'maintenance-cloud' }, { defId: 'ai-overseer' }, { defId: 'replication-node' },
      { defId: 'smart-matter-armor' }, { defId: 'distributed-mind' }, { defId: 'grey-goo-bloom' }, { defId: 'citywide-mesh' },
    ],
  },
  {
    id: 'hacker-control',
    name: 'Hacker Control',
    archetype: 'Control',
    difficulty: 'Medium / Hard',
    gamePlan: 'Deny enemy effects, reset modified cards, win by breaking their engine.',
    color: '#aa44ff',
    cards: [
      { defId: 'signal-jammer' }, { defId: 'black-ice' }, { defId: 'trace-hacker' }, { defId: 'system-crash' },
      { defId: 'rootkit-kid' }, { defId: 'firewall-daemon' }, { defId: 'exploit-artist' }, { defId: 'null-saint' },
      { defId: 'blackmail-file' }, { defId: 'predictive-cop' }, { defId: 'emp-grenade' }, { defId: 'hard-reset' },
    ],
  },
  {
    id: 'black-market-tempo',
    name: 'Black Market',
    archetype: 'Tempo',
    difficulty: 'Medium',
    gamePlan: 'Create discounted unstable cards, spike tempo, profit before the downside arrives.',
    color: '#ff8800',
    cards: [
      { defId: 'bone-market' }, { defId: 'dead-drop' }, { defId: 'black-market-dealer' }, { defId: 'overclock-chip' },
      { defId: 'borrowed-gun' }, { defId: 'illegal-clone' }, { defId: 'knockoff-cyberarm' }, { defId: 'grey-market-cache' },
      { defId: 'debt-collector' }, { defId: 'ghost-vendor' }, { defId: 'hot-merchandise' }, { defId: 'kingpin-broker' },
    ],
  },
  {
    id: 'overclock-battery',
    name: 'Overclock Battery',
    archetype: 'Overclock',
    difficulty: 'Medium / Hard',
    gamePlan: 'Float Energy, convert restraint into discounts, Power, and late-game burst.',
    color: '#eeee00',
    cards: [
      { defId: 'battery-monk' }, { defId: 'capacitor-drone' }, { defId: 'quiet-protocol' }, { defId: 'stored-charge' },
      { defId: 'ambush-runner' }, { defId: 'silent-engine' }, { defId: 'delayed-payload' }, { defId: 'neon-singularity' },
      { defId: 'rent-a-cop' }, { defId: 'adaptive-shell' }, { defId: 'black-market-dealer' }, { defId: 'grey-market-cache' },
    ],
  },
  {
    id: 'swarm-gang',
    name: 'Swarm / Gang',
    archetype: 'Swarm',
    difficulty: 'Easy',
    gamePlan: 'Flood lanes with cheap cards and Drones. Turn full locations into Power.',
    color: '#44ff88',
    cards: [
      { defId: 'rent-a-cop' }, { defId: 'signal-booster' }, { defId: 'replication-node' }, { defId: 'street-kid' },
      { defId: 'drone-pup' }, { defId: 'gang-lookout' }, { defId: 'drone-printer' }, { defId: 'block-party' },
      { defId: 'pack-tactics' }, { defId: 'signal-rally' }, { defId: 'gutter-legion' }, { defId: 'hive-riot' },
    ],
  },
] as const;

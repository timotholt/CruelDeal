/**
 * DEBUG ONLY — remove before production.
 *
 * Starter deck definitions sourced from:
 *   documents/04_DECKS/Cyberpunk_CCG_Starter_Decks_v0.2.txt
 *
 * These are test harnesses for playtesting archetypes, not final balance targets.
 */

export interface DebugDeck {
  readonly id: string;
  readonly name: string;
  readonly archetype: string;
  readonly difficulty: string;
  readonly gamePlan: string;
  readonly color: string;
  readonly cards: readonly string[]; // defIds, exactly 12
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
      'scrap-rat', 'crash-dummy', 'chop-doc', 'grinder-crew',
      'redline-bruiser', 'parts-collector', 'rust-revenant', 'bone-market',
      'meat-grinder', 'scrapyard-king', 'golden-parachute', 'illegal-clone',
    ],
  },
  {
    id: 'corporate-copy',
    name: 'Corporate Copy',
    archetype: 'Copy',
    difficulty: 'Hard',
    gamePlan: 'Sacrifice specific cards to copy their text. Turn copied abilities into board advantage.',
    color: '#4488ff',
    cards: [
      'scrap-rat', 'chop-doc', 'middle-manager', 'hostile-recruiter',
      'golden-parachute', 'severance-clone', 'hr-algorithm', 'acquisition-team',
      'boardroom-proxy', 'executive-override', 'signal-booster', 'ai-overseer',
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
      'street-fixer', 'tech-fixer', 'military-fixer', 'chrome-broker',
      'backchannel-contact', 'clean-operator', 'procurement-bot', 'dead-drop',
      'talent-scout', 'network-queen', 'ai-overseer', 'black-market-dealer',
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
      'street-fixer', 'procurement-bot', 'nano-swarm', 'signal-booster',
      'adaptive-shell', 'maintenance-cloud', 'ai-overseer', 'replication-node',
      'smart-matter-armor', 'distributed-mind', 'grey-goo-bloom', 'citywide-mesh',
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
      'signal-jammer', 'black-ice', 'trace-hacker', 'system-crash',
      'rootkit-kid', 'firewall-daemon', 'exploit-artist', 'null-saint',
      'blackmail-file', 'predictive-cop', 'emp-grenade', 'hard-reset',
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
      'bone-market', 'dead-drop', 'black-market-dealer', 'overclock-chip',
      'borrowed-gun', 'illegal-clone', 'knockoff-cyberarm', 'grey-market-cache',
      'debt-collector', 'ghost-vendor', 'hot-merchandise', 'kingpin-broker',
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
      'battery-monk', 'capacitor-drone', 'quiet-protocol', 'stored-charge',
      'ambush-runner', 'silent-engine', 'delayed-payload', 'neon-singularity',
      'nano-swarm', 'adaptive-shell', 'black-market-dealer', 'grey-market-cache',
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
      'nano-swarm', 'signal-booster', 'replication-node', 'street-kid',
      'drone-pup', 'gang-lookout', 'drone-printer', 'block-party',
      'pack-tactics', 'signal-rally', 'gutter-legion', 'hive-riot',
    ],
  },
] as const;

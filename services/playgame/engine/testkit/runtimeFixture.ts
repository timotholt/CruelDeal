import type { EffectExpr } from '../types/ability';
import type { CardId, LaneId, LocationId, Owner, Seat } from '../types/ids';
import type { CardDef, LocationDef, Manifest } from '../manifest/types';
import type {
  CardInstance,
  CardTag,
  CardZone,
  LaneState,
  LocationInstance,
  MatchPhase,
  MatchState,
  PendingEffect,
  SpawnSource,
} from '../types/state';
import { EMPTY_TRACKED_VARIABLES } from '../types/state';

export interface RuntimeCardSpec {
  readonly id: string;
  readonly defId: string;
  readonly variantId?: string;
  readonly revealed?: boolean;
  readonly powerDelta?: number;
  readonly costDelta?: number;
  readonly tags?: readonly CardTag[];
  readonly spawnSource?: SpawnSource;
}

export interface RuntimeLaneSpec {
  readonly P0: readonly RuntimeCardSpec[];
  readonly P1: readonly RuntimeCardSpec[];
}

export interface RuntimeLocationSpec {
  readonly id: string;
  readonly defId: string;
  readonly revealed: boolean;
  readonly tags?: LocationInstance['tags'];
  readonly counters?: LocationInstance['counters'];
}

export interface RuntimeFixtureOptions {
  readonly seed: string;
  readonly localSeat: Seat;
  readonly turn: number;
  readonly phase: MatchPhase;
  readonly priority: Owner;
  readonly decks: Readonly<Record<Owner, readonly RuntimeCardSpec[]>>;
  readonly hands: Readonly<Record<Owner, readonly RuntimeCardSpec[]>>;
  readonly lanes: readonly [RuntimeLaneSpec, RuntimeLaneSpec, RuntimeLaneSpec];
  readonly locations: readonly [RuntimeLocationSpec | null, RuntimeLocationSpec | null, RuntimeLocationSpec | null];
  readonly energy?: Readonly<Record<Owner, number>>;
  readonly maxEnergy?: Readonly<Record<Owner, number>>;
  readonly nextTurnEnergyBonus?: Readonly<Record<Owner, number>>;
  readonly stagingOrder?: readonly string[];
  readonly pendingEffects?: readonly PendingEffect[];
}

export interface RuntimeFixture {
  readonly seed: string;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly state: MatchState;
}

const EMPTY_POWER_LOG = [] as const;
const EMPTY_COST_LOG = [] as const;

function buildCard(
  spec: RuntimeCardSpec,
  owner: Owner,
  zone: CardZone,
  lane: LaneId | null,
): CardInstance {
  return {
    id: spec.id as CardId,
    defId: spec.defId,
    ...(spec.variantId === undefined ? {} : { variantId: spec.variantId }),
    version: 1,
    owner,
    lane,
    zone,
    revealed: spec.revealed ?? false,
    powerDelta: spec.powerDelta ?? 0,
    costDelta: spec.costDelta ?? 0,
    powerLog: EMPTY_POWER_LOG,
    costLog: EMPTY_COST_LOG,
    tags: spec.tags ?? [],
    textOverride: null,
    counters: {},
    spawnSource: spec.spawnSource ?? { kind: 'DECK_CREATION' },
  };
}

/**
 * Build a complete runtime fixture without deriving gameplay inputs from time,
 * randomness, the bootstrap manifest, or presentation state.
 */
export function buildRuntimeFixture(options: RuntimeFixtureOptions): RuntimeFixture {
  const cards: Record<string, CardInstance> = {};
  const register = (card: CardInstance): CardInstance => {
    if (cards[card.id]) throw new Error(`duplicate fixture card id: ${card.id}`);
    cards[card.id] = card;
    return card;
  };

  const deck = {
    P0: options.decks.P0.map((spec) => register(buildCard(spec, 'P0', 'DECK', null))),
    P1: options.decks.P1.map((spec) => register(buildCard(spec, 'P1', 'DECK', null))),
  };
  const hand = {
    P0: options.hands.P0.map((spec) => register(buildCard(spec, 'P0', 'HAND', null))),
    P1: options.hands.P1.map((spec) => register(buildCard(spec, 'P1', 'HAND', null))),
  };

  const lanes = options.lanes.map((laneSpec, laneNumber) => {
    const lane = laneNumber as LaneId;
    const locationSpec = options.locations[lane];
    const location: LocationInstance | null = locationSpec
      ? {
          id: locationSpec.id as LocationId,
          defId: locationSpec.defId,
          lane,
          tags: locationSpec.tags ?? [],
          ...(locationSpec.counters ? { counters: locationSpec.counters } : {}),
        }
      : null;
    const P0 = laneSpec.P0.map((spec) => register(buildCard(spec, 'P0', 'LANE', lane)).id);
    const P1 = laneSpec.P1.map((spec) => register(buildCard(spec, 'P1', 'LANE', lane)).id);
    return {
      idx: lane,
      status: 'ACTIVE',
      location,
      locationRevealed: locationSpec?.revealed ?? false,
      cards: { P0, P1 },
    } satisfies LaneState;
  }) as LaneState[];

  const stagingOrder = (options.stagingOrder ?? []).map((id) => id as CardId);
  for (const id of stagingOrder) {
    const card = cards[id];
    if (!card || card.zone !== 'LANE') {
      throw new Error(`stagingOrder references non-lane fixture card: ${id}`);
    }
  }

  const energy = options.energy ?? { P0: options.turn, P1: options.turn };
  const maxEnergy = options.maxEnergy ?? { P0: options.turn, P1: options.turn };
  const state: MatchState = {
    turn: options.turn,
    maxEnergy: { ...maxEnergy },
    nextTurnEnergyBonus: { ...(options.nextTurnEnergyBonus ?? { P0: 0, P1: 0 }) },
    phase: options.phase,
    seed: options.seed,
    priority: options.priority,
    energy: { ...energy },
    deck,
    hand,
    cards,
    lanes,
    activeLaneOrder: [0, 1, 2],
    nextLaneId: 3,
    pending: [],
    stagingOrder,
    pendingEffects: options.pendingEffects ?? [],
    log: [],
    lastPlayedBy: { P0: null, P1: null },
    result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: EMPTY_TRACKED_VARIABLES,
  };

  return {
    seed: options.seed,
    localSeat: options.localSeat,
    remoteSeat: options.localSeat === 'P0' ? 'P1' : 'P0',
    state,
  };
}

export function testCardDef(
  defId: string,
  options: {
    readonly power?: number;
    readonly cost?: number;
    readonly onReveal?: EffectExpr[];
    readonly onEndOfTurn?: EffectExpr[];
  } = {},
): CardDef {
  return {
    defId,
    version: 1,
    name: defId,
    cardType: 'character',
    basePower: options.power ?? 1,
    cost: options.cost ?? 1,
    abilities: {
      ...(options.onReveal ? { onReveal: options.onReveal } : {}),
      ...(options.onEndOfTurn ? { onEndOfTurn: options.onEndOfTurn } : {}),
    },
    cosmetic: {
      displayName: defId,
      flavorText: '',
      rulesText: '',
      art: { portrait: { path: '' } },
    },
  };
}

export function testLocationDef(
  defId: string,
  onReveal: EffectExpr[] = [],
): LocationDef {
  return {
    defId,
    version: 1,
    name: defId,
    rarity: 1,
    abilities: { onReveal },
    cosmetic: {
      displayName: defId,
      description: '',
      art: { map: { path: '' } },
    },
  };
}

export function testManifest(
  cards: readonly CardDef[],
  locations: readonly LocationDef[] = [],
  constants: Partial<Manifest['constants']> = {},
): Manifest {
  return {
    version: 1,
    protocolVersion: 1,
    constants: {
      energyCurve: [1, 2, 3, 4, 5, 6],
      turnLimit: 6,
      handCap: 7,
      laneCapacity: 4,
      deckSize: 12,
      startingHandSize: 3,
      turnStartDraw: 1,
      ...constants,
    },
    rulesets: {
      standard: {
        rulesetId: 'standard',
        deckConstruction: { defaultCopyLimit: 1 },
        laneRules: {
          initialLaneCount: 3,
          maximumActiveLaneCount: 3,
        },
        locationDeck: {
          minimumReserveCount: 0,
          copyLimit: 1,
        },
      },
    },
    cards: Object.fromEntries(cards.map((card) => [card.defId, card])),
    locations: Object.fromEntries(locations.map((location) => [location.defId, location])),
    disabled: { cards: [], locations: [] },
  };
}

import type { EffectExpr } from '../types/ability';
import type { CardId, LaneId, LocationCardInstanceId, Owner, Seat } from '../types/ids';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import type {
  CardInstance,
  CardTag,
  CardZone,
  LaneState,
  LocationCardInstance,
  MatchPhase,
  MatchState,
  PendingEffect,
  PowerLedgerEntry,
  PowerMutation,
  SpawnSource,
} from '../types/state';
import { EMPTY_TRACKED_VARIABLES } from '../types/state';
import { asFrame, GENESIS_FRAME } from '../types/timeline';
import type { LocationSetupDeck } from '../locationSetup';

/**
 * Test-only deterministic location input. Production selection belongs to a
 * bootstrap-producing LocationDeckFactory; engine tests name their complete
 * third-deck input explicitly through this helper.
 */
export function orderedTestLocationDeck(manifest: Manifest): LocationSetupDeck {
  const disabled = new Set(manifest.disabled.locations);
  return Object.values(manifest.locations)
    .filter(definition =>
      definition.rarity > 0 && !disabled.has(definition.defId),
    )
    .sort((left, right) => left.defId.localeCompare(right.defId))
    .map(definition => ({ defId: definition.defId }));
}

export interface RuntimeCardSpec {
  readonly id: string;
  readonly defId: string;
  readonly variantId?: string;
  readonly revealed?: boolean;
  readonly powerMutations?: readonly PowerMutation[];
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
  readonly tags?: LocationCardInstance['tags'];
  readonly counters?: LocationCardInstance['counters'];
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

export function testLaneState(
  id: LaneId,
  cards: Readonly<Record<Owner, readonly CardId[]>> = { P0: [], P1: [] },
): LaneState {
  return {
    id,
    status: 'ACTIVE',
    locationSlot: {
      laneId: id,
      locationCardId: null,
      revealAtTurn: id + 1,
    },
    cards,
    createdAt: GENESIS_FRAME,
  };
}

export function testLaneRegistry(
  lanes: readonly LaneState[] = [
    testLaneState(0),
    testLaneState(1),
    testLaneState(2),
  ],
): Readonly<Record<LaneId, LaneState>> {
  return Object.fromEntries(lanes.map(lane => [lane.id, lane]));
}

export function emptyTestMatchState(
  overrides: Partial<MatchState> = {},
): MatchState {
  const turn = overrides.turn ?? 1;
  return {
    turn,
    maxEnergy: { P0: turn, P1: turn },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed: 'test-match-state',
    priority: 'P0',
    energy: { P0: turn, P1: turn },
    deck: { P0: [], P1: [] },
    hand: { P0: [], P1: [] },
    cards: {},
    lanesById: testLaneRegistry(),
    activeLaneOrder: [0, 1, 2],
    nextLaneId: 3,
    locationCards: {},
    locationDeck: {
      drawPile: [],
      staging: [],
      discardPile: [],
      destroyed: [],
      banished: [],
    },
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { P0: null, P1: null },
    result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: EMPTY_TRACKED_VARIABLES,
    ...overrides,
  };
}

export function withTestLocation(
  state: MatchState,
  laneId: LaneId,
  defId: string,
  revealed = true,
  id = `test-location-${laneId}` as LocationCardInstanceId,
): MatchState {
  const lane = state.lanesById[laneId];
  if (!lane) throw new Error(`withTestLocation: missing lane ${laneId}`);
  const priorId = lane.locationSlot.locationCardId;
  const prior = priorId ? state.locationCards[priorId] : null;
  const location: LocationCardInstance = {
    id,
    defId,
    sourceDeckEntry: -1,
    zone: 'LANE',
    laneId,
    pendingLaneId: null,
    face: revealed ? 'FACE_UP' : 'FACE_DOWN',
    identityKnownTo: revealed ? ['P0', 'P1'] : [],
    revealCount: revealed ? 1 : 0,
    tags: [],
    counters: {},
    createdAt: GENESIS_FRAME,
    ...(revealed ? { revealedAt: GENESIS_FRAME } : {}),
  };
  return {
    ...state,
    lanesById: {
      ...state.lanesById,
      [laneId]: {
        ...lane,
        locationSlot: {
          ...lane.locationSlot,
          locationCardId: id,
        },
      },
    },
    locationCards: {
      ...state.locationCards,
      ...(prior ? {
        [prior.id]: {
          ...prior,
          zone: 'DISCARD' as const,
          laneId: null,
          pendingLaneId: null,
        },
      } : {}),
      [id]: location,
    },
    locationDeck: prior
      ? {
          ...state.locationDeck,
          discardPile: [...state.locationDeck.discardPile, prior.id],
        }
      : state.locationDeck,
  };
}

const EMPTY_COST_LOG = [] as const;

export function testPowerLedger(
  cardId: string,
  mutations: readonly PowerMutation[],
): readonly PowerLedgerEntry[] {
  return mutations.map((mutation, index) => ({
    id: `${cardId}:fixture-power:${index + 1}`,
    frame: asFrame(index + 1),
    turn: 0,
    mutation,
    cause: { sourceId: cardId as CardId, effectKind: 'SYSTEM' },
  }));
}

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
    powerLedger: testPowerLedger(spec.id, spec.powerMutations ?? []),
    costDelta: spec.costDelta ?? 0,
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

  const locationCards: Record<LocationCardInstanceId, LocationCardInstance> = {};
  const lanesById = Object.fromEntries(options.lanes.map((laneSpec, laneNumber) => {
    const lane = laneNumber as LaneId;
    const locationSpec = options.locations[lane];
    const locationCardId = locationSpec?.id as LocationCardInstanceId | undefined;
    if (locationSpec && locationCardId) {
      locationCards[locationCardId] = {
        id: locationCardId,
        defId: locationSpec.defId,
        sourceDeckEntry: laneNumber,
        zone: 'LANE',
        laneId: lane,
        pendingLaneId: null,
        face: locationSpec.revealed ? 'FACE_UP' : 'FACE_DOWN',
        identityKnownTo: locationSpec.revealed ? ['P0', 'P1'] : [],
        revealCount: locationSpec.revealed ? 1 : 0,
        tags: locationSpec.tags ?? [],
        counters: locationSpec.counters ?? {},
        createdAt: GENESIS_FRAME,
        ...(locationSpec.revealed ? { revealedAt: GENESIS_FRAME } : {}),
      };
    }
    const P0 = laneSpec.P0.map((spec) => register(buildCard(spec, 'P0', 'LANE', lane)).id);
    const P1 = laneSpec.P1.map((spec) => register(buildCard(spec, 'P1', 'LANE', lane)).id);
    const laneState: LaneState = {
      id: lane,
      status: 'ACTIVE',
      locationSlot: {
        laneId: lane,
        locationCardId: locationCardId ?? null,
        revealAtTurn: locationSpec?.revealed ? null : laneNumber + 1,
      },
      cards: { P0, P1 },
      createdAt: GENESIS_FRAME,
    };
    return [lane, laneState];
  })) as Readonly<Record<LaneId, LaneState>>;

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
    lanesById,
    activeLaneOrder: [0, 1, 2],
    nextLaneId: 3,
    locationCards,
    locationDeck: {
      drawPile: [],
      staging: [],
      discardPile: [],
      destroyed: [],
      banished: [],
    },
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
): LocationCardDef {
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
  locations: readonly LocationCardDef[] = [],
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

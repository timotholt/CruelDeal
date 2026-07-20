import type { MatchEvent } from '../types/events';
import type { CardZone } from '../types/state';

/**
 * C4A target vocabulary.
 *
 * These names deliberately do not extend MatchEvent yet. C4A replaces the
 * ambiguous current event families at the governed commit seam; it does not
 * add aliases or preserve both shapes.
 */
export const KERNEL_LIFECYCLE_EVENT_TYPES = [
  'CARD_REVEALED',
  'CARD_PLAY_COMPLETED',
  'CARD_DESTROYED',
  'CARD_BANISHED',
  'CARD_DISCARDED',
  'CARD_MOVED',
  'CARD_RETURNED_TO_LANE',
  'CARD_CREATED',
  'CARD_DRAWN',
  'CARD_ZONE_CHANGED',
  'CARD_POWER_CHANGED',
] as const;

export type KernelLifecycleEventType =
  (typeof KERNEL_LIFECYCLE_EVENT_TYPES)[number];

export type KernelTransitionKind =
  | 'REVEAL'
  | 'PLAY_FROM_HAND'
  | 'DESTROY'
  | 'BANISH'
  | 'DISCARD'
  | 'MOVE_BETWEEN_LANES'
  | 'RETURN'
  | 'CREATE'
  | 'DRAW'
  | 'ZONE_CHANGE'
  | 'POWER_GAIN'
  | 'POWER_LOSS';

export type ContractZone = CardZone | 'ABSENT';
export type SnapshotEdge = 'BEFORE' | 'AFTER';
export type LaneFieldContract = 'REQUIRED' | 'NULL' | 'ZONE_DERIVED';

export interface LifecycleTransitionContract {
  readonly transitionKinds: readonly KernelTransitionKind[];
  readonly allowedPriorZones: readonly ContractZone[];
  readonly allowedResultingZones: readonly ContractZone[];
  readonly priorLane: LaneFieldContract;
  readonly resultingLane: LaneFieldContract;
  readonly ownerRequired: true;
  readonly causeRequired: true;
  readonly entityRequired: true;
  readonly ruleSourceEdges: readonly SnapshotEdge[];
  readonly sameZoneRequired?: true;
  readonly sameLaneRequired?: true;
  readonly differentLaneRequired?: true;
}

const ACCESSIBLE_CARD_ZONES = [
  'DECK',
  'HAND',
  'LANE',
  'DISCARD',
  'DESTROYED',
] as const satisfies readonly CardZone[];

/**
 * Exact semantic-envelope closure for the first kernel migration.
 *
 * A transition that cannot satisfy its row is a deterministic kernel failure.
 * Callers may not infer missing historical facts after candidate state changes.
 */
export const LIFECYCLE_TRANSITION_CONTRACTS = {
  CARD_REVEALED: {
    transitionKinds: ['REVEAL'],
    allowedPriorZones: ['LANE'],
    allowedResultingZones: ['LANE'],
    priorLane: 'REQUIRED',
    resultingLane: 'REQUIRED',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['AFTER'],
    sameZoneRequired: true,
    sameLaneRequired: true,
  },
  CARD_PLAY_COMPLETED: {
    transitionKinds: ['PLAY_FROM_HAND'],
    allowedPriorZones: ['HAND'],
    allowedResultingZones: ['LANE'],
    priorLane: 'NULL',
    resultingLane: 'REQUIRED',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['AFTER'],
  },
  CARD_DESTROYED: {
    transitionKinds: ['DESTROY'],
    allowedPriorZones: ['LANE'],
    allowedResultingZones: ['DESTROYED'],
    priorLane: 'REQUIRED',
    resultingLane: 'NULL',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['BEFORE'],
  },
  CARD_BANISHED: {
    transitionKinds: ['BANISH'],
    allowedPriorZones: ACCESSIBLE_CARD_ZONES,
    allowedResultingZones: ['BANISHED'],
    priorLane: 'ZONE_DERIVED',
    resultingLane: 'NULL',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['BEFORE'],
  },
  CARD_DISCARDED: {
    transitionKinds: ['DISCARD'],
    allowedPriorZones: ['HAND'],
    allowedResultingZones: ['DISCARD'],
    priorLane: 'NULL',
    resultingLane: 'NULL',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['BEFORE'],
  },
  CARD_MOVED: {
    transitionKinds: ['MOVE_BETWEEN_LANES'],
    allowedPriorZones: ['LANE'],
    allowedResultingZones: ['LANE'],
    priorLane: 'REQUIRED',
    resultingLane: 'REQUIRED',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['BEFORE', 'AFTER'],
    sameZoneRequired: true,
    differentLaneRequired: true,
  },
  CARD_RETURNED_TO_LANE: {
    transitionKinds: ['RETURN'],
    allowedPriorZones: ['DISCARD', 'DESTROYED'],
    allowedResultingZones: ['LANE'],
    priorLane: 'NULL',
    resultingLane: 'REQUIRED',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['AFTER'],
  },
  CARD_CREATED: {
    transitionKinds: ['CREATE'],
    allowedPriorZones: ['ABSENT'],
    allowedResultingZones: ['DECK', 'HAND', 'LANE'],
    priorLane: 'NULL',
    resultingLane: 'ZONE_DERIVED',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['AFTER'],
  },
  CARD_DRAWN: {
    transitionKinds: ['DRAW'],
    allowedPriorZones: ['DECK'],
    allowedResultingZones: ['HAND'],
    priorLane: 'NULL',
    resultingLane: 'NULL',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['AFTER'],
  },
  CARD_ZONE_CHANGED: {
    transitionKinds: ['ZONE_CHANGE'],
    allowedPriorZones: ACCESSIBLE_CARD_ZONES,
    allowedResultingZones: ['DECK', 'HAND', 'LANE'],
    priorLane: 'ZONE_DERIVED',
    resultingLane: 'ZONE_DERIVED',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['BEFORE', 'AFTER'],
  },
  CARD_POWER_CHANGED: {
    transitionKinds: ['POWER_GAIN', 'POWER_LOSS'],
    allowedPriorZones: ACCESSIBLE_CARD_ZONES,
    allowedResultingZones: ACCESSIBLE_CARD_ZONES,
    priorLane: 'ZONE_DERIVED',
    resultingLane: 'ZONE_DERIVED',
    ownerRequired: true,
    causeRequired: true,
    entityRequired: true,
    ruleSourceEdges: ['BEFORE', 'AFTER'],
    sameZoneRequired: true,
    sameLaneRequired: true,
  },
} as const satisfies Record<
  KernelLifecycleEventType,
  LifecycleTransitionContract
>;

export const PRIVATE_PLANNING_EVENT_TYPES = [
  'CARD_STAGED',
  'CARD_UNSTAGED',
] as const satisfies readonly MatchEvent['type'][];

/**
 * Current shapes that the migration deletes at cutover. They are listed here
 * to prevent a compatibility-minded implementation from keeping dual paths.
 */
export const SUPERSEDED_LIFECYCLE_EVENT_TYPES = [
  'CARD_FLIPPED',
  'CARD_ADDED_TO_DECK',
  'CARD_ADDED_TO_HAND',
  'CARD_ADDED_TO_LANE',
  'CARD_MOVED_TO_ZONE',
] as const;

export const CLEAN_CUTOVER_REPLACEMENTS = {
  CARD_FLIPPED: ['CARD_REVEALED', 'CARD_PLAY_COMPLETED'],
  CARD_ADDED_TO_DECK: ['CARD_CREATED'],
  CARD_ADDED_TO_HAND: ['CARD_CREATED'],
  CARD_ADDED_TO_LANE: ['CARD_CREATED'],
  CARD_MOVED_TO_ZONE: ['CARD_ZONE_CHANGED'],
} as const satisfies Record<
  (typeof SUPERSEDED_LIFECYCLE_EVENT_TYPES)[number],
  readonly KernelLifecycleEventType[]
>;

export const REACTION_ORDER_DIMENSIONS = [
  'timingBand',
  'prioritySeatRank',
  'laneOrdinal',
  'cardOrdinal',
  'ruleIndex',
  'sourceInstanceId',
] as const;

export type KernelReactionHook =
  | 'CARD_ON_REVEAL'
  | 'LOCATION_ON_CARD_REVEALED_HERE'
  | 'CARD_ON_ANY_CARD_PLAYED_HERE'
  | 'LOCATION_ON_CARD_PLAYED_HERE'
  | 'CARD_ON_DESTROYED'
  | 'LOCATION_ON_CARD_DESTROYED_HERE'
  | 'LOCATION_ON_CARD_BANISHED_HERE'
  | 'CARD_ON_DISCARDED'
  | 'LOCATION_ON_CARD_LEFT_HERE'
  | 'LOCATION_ON_CARD_ENTERED_HERE'
  | 'CARD_ON_MOVE'
  | 'LOCATION_ON_CARD_RETURNED_HERE'
  | 'LOCATION_ON_CARD_CREATED_HERE'
  | 'ACTIVE_CARD_ON_CARD_ENTERED_HAND'
  | 'CARD_ON_GAINED_POWER'
  | 'LOCATION_ON_CARD_GAINED_POWER_HERE'
  | 'LOCATION_ON_CARD_LOST_POWER_HERE';

export type LocationContextEdge = 'NONE' | 'PRIOR' | 'RESULT';

export interface ReactionOrderStep {
  readonly timingBand: number;
  readonly hook: KernelReactionHook;
  readonly sourceEdge: SnapshotEdge;
  readonly locationEdge: LocationContextEdge;
  readonly when?: 'RESULT_IS_HAND' | 'RESULT_IS_LANE' | 'POWER_GAIN' | 'POWER_LOSS';
}

/**
 * Ordering bands are part of gameplay law. Gaps are intentional so a future
 * hook can be inserted without renumbering unrelated bands.
 */
export const REACTION_ORDER_PLANS = {
  CARD_REVEALED: [
    {
      timingBand: 100,
      hook: 'CARD_ON_REVEAL',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
    },
    {
      timingBand: 200,
      hook: 'LOCATION_ON_CARD_REVEALED_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
    },
  ],
  CARD_PLAY_COMPLETED: [
    {
      timingBand: 100,
      hook: 'CARD_ON_ANY_CARD_PLAYED_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
    },
    {
      timingBand: 200,
      hook: 'LOCATION_ON_CARD_PLAYED_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
    },
  ],
  CARD_DESTROYED: [
    {
      timingBand: 100,
      hook: 'CARD_ON_DESTROYED',
      sourceEdge: 'BEFORE',
      locationEdge: 'PRIOR',
    },
    {
      timingBand: 200,
      hook: 'LOCATION_ON_CARD_DESTROYED_HERE',
      sourceEdge: 'BEFORE',
      locationEdge: 'PRIOR',
    },
  ],
  CARD_BANISHED: [
    {
      timingBand: 100,
      hook: 'LOCATION_ON_CARD_BANISHED_HERE',
      sourceEdge: 'BEFORE',
      locationEdge: 'PRIOR',
    },
  ],
  CARD_DISCARDED: [
    {
      timingBand: 100,
      hook: 'CARD_ON_DISCARDED',
      sourceEdge: 'BEFORE',
      locationEdge: 'NONE',
    },
  ],
  CARD_MOVED: [
    {
      timingBand: 100,
      hook: 'LOCATION_ON_CARD_LEFT_HERE',
      sourceEdge: 'BEFORE',
      locationEdge: 'PRIOR',
    },
    {
      timingBand: 200,
      hook: 'LOCATION_ON_CARD_ENTERED_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
    },
    {
      timingBand: 300,
      hook: 'CARD_ON_MOVE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
    },
  ],
  CARD_RETURNED_TO_LANE: [
    {
      timingBand: 100,
      hook: 'LOCATION_ON_CARD_RETURNED_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
    },
  ],
  CARD_CREATED: [
    {
      timingBand: 100,
      hook: 'LOCATION_ON_CARD_CREATED_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
      when: 'RESULT_IS_LANE',
    },
    {
      timingBand: 200,
      hook: 'ACTIVE_CARD_ON_CARD_ENTERED_HAND',
      sourceEdge: 'AFTER',
      locationEdge: 'NONE',
      when: 'RESULT_IS_HAND',
    },
  ],
  CARD_DRAWN: [
    {
      timingBand: 100,
      hook: 'ACTIVE_CARD_ON_CARD_ENTERED_HAND',
      sourceEdge: 'AFTER',
      locationEdge: 'NONE',
    },
  ],
  CARD_ZONE_CHANGED: [
    {
      timingBand: 100,
      hook: 'ACTIVE_CARD_ON_CARD_ENTERED_HAND',
      sourceEdge: 'AFTER',
      locationEdge: 'NONE',
      when: 'RESULT_IS_HAND',
    },
  ],
  CARD_POWER_CHANGED: [
    {
      timingBand: 100,
      hook: 'CARD_ON_GAINED_POWER',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
      when: 'POWER_GAIN',
    },
    {
      timingBand: 200,
      hook: 'LOCATION_ON_CARD_GAINED_POWER_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
      when: 'POWER_GAIN',
    },
    {
      timingBand: 300,
      hook: 'LOCATION_ON_CARD_LOST_POWER_HERE',
      sourceEdge: 'AFTER',
      locationEdge: 'RESULT',
      when: 'POWER_LOSS',
    },
  ],
} as const satisfies Record<
  KernelLifecycleEventType,
  readonly ReactionOrderStep[]
>;

/**
 * Commands required by the first kernel slice and the later nested On Reveal
 * acceptance slice. Author-facing effects lower to these commands; effects do
 * not move cards, invoke text, or construct events themselves.
 */
export const REQUIRED_KERNEL_COMMAND_TYPES = [
  'PLAY_CARD',
  'REVEAL_CARD',
  'CHANGE_STORED_POWER',
  'MOVE_CARD',
  'RETURN_CARD',
  'CREATE_CARD',
  'CHANGE_CARD_ZONE',
  'DEPLOY_FROM_DECK',
  'DRAW_CARD',
  'DISCARD_CARD',
  'CHANGE_COST',
  'CHANGE_ENERGY',
  'CHANGE_CARD_TAG',
  'CHANGE_CARD_COUNTER',
  'OVERRIDE_CARD_TEXT',
  'CHANGE_LOCATION_TAG',
  'CHANGE_LOCATION_COUNTER',
  'SCHEDULE_PENDING_EFFECT',
  'CONSUME_PENDING_EFFECT',
  'INVOKE_ON_REVEAL',
  'INVOKE_CARD_TRIGGER',
  'INVOKE_LOCATION_TRIGGER',
] as const;

export type RequiredKernelCommandType =
  (typeof REQUIRED_KERNEL_COMMAND_TYPES)[number];

/**
 * Exact deck-to-lane behavior for Jubilee-style effects.
 *
 * This is movement of an existing instance, not card creation. The deployment
 * command commits the zone transition; the ordinary reveal lifecycle then
 * invokes the deployed card's text.
 */
export const DECK_DEPLOYMENT_CONTRACT = {
  command: 'DEPLOY_FROM_DECK',
  selectionTiming: 'COMMAND_EXECUTION',
  selectionSource: 'CURRENT_CANDIDATE_DECK',
  capacityCheckTiming: 'COMMAND_EXECUTION',
  sourceZone: 'DECK',
  resultingZone: 'LANE',
  zoneTransitionEvent: 'CARD_ZONE_CHANGED',
  revealEvent: 'CARD_REVEALED',
  preservesCardInstanceId: true,
  preservesStoredPower: true,
  preservesStoredCost: true,
  preservesProvenance: true,
  spendsEnergy: false,
  countsAsHandOriginPlay: false,
  emitsCardCreated: false,
  emitsCardPlayCompleted: false,
  emptyDeckOutcome: 'NORMAL_NO_OP',
  fullLaneOutcome: 'NORMAL_NO_OP',
  nestedResolution: 'DEPTH_FIRST_BEFORE_PARENT_CONTINUES',
} as const;

export type OnRevealInvocationReason = 'NATURAL_REVEAL' | 'RETRIGGER';

/**
 * An On Reveal invocation is semantic work, not a second reveal event.
 *
 * Wong-style multiplication snapshots the whole invocation once. Individual
 * effect expressions and their selectors still execute against the current
 * candidate state, so nested cards can affect later repetitions.
 */
export const ON_REVEAL_INVOCATION_CONTRACT = {
  command: 'INVOKE_ON_REVEAL',
  reasons: ['NATURAL_REVEAL', 'RETRIGGER'],
  multiplierSampleTiming: 'INVOCATION_START',
  multiplierPersistence: 'SNAPSHOT_SURVIVES_NESTED_SOURCE_REMOVAL',
  abilityListSampleTiming: 'INVOCATION_START',
  repeatUnit: 'WHOLE_ABILITY_LIST',
  repetitionOrder: 'AUTHORED_EFFECT_ORDER',
  effectState: 'CURRENT_CANDIDATE_STATE',
  selectorSampleTiming: 'EACH_EFFECT_EXECUTION_START',
  selectorTargets: 'IMMUTABLE_FOR_ONE_EFFECT_EXECUTION',
  nestedResolution: 'DEPTH_FIRST_BEFORE_NEXT_SIBLING',
  retriggerEmitsCardRevealed: false,
  retriggerEmitsCardPlayCompleted: false,
  retriggerFiresPlayedHere: false,
  naturalRevealDispatchedFrom: 'CARD_REVEALED',
  retriggerDispatchedFrom: 'COMMAND_WORK',
} as const;

/**
 * The old primitive conflates creation with deployment of an existing deck
 * instance. C4C/C4D must delete it and lower the two meanings separately.
 */
export const SPAWN_AND_REVEAL_CLEAN_CUTOVER = {
  supersededEffect: 'SPAWN_AND_REVEAL',
  createNewInstance: ['CREATE_CARD', 'REVEAL_CARD'],
  deployExistingDeckInstance: ['DEPLOY_FROM_DECK'],
  preserveLegacyPrimitive: false,
} as const satisfies {
  readonly supersededEffect: 'SPAWN_AND_REVEAL';
  readonly createNewInstance: readonly RequiredKernelCommandType[];
  readonly deployExistingDeckInstance: readonly RequiredKernelCommandType[];
  readonly preserveLegacyPrimitive: false;
};

/**
 * Mandatory C4D golden trace with unlimited capacity, an inert remainder of
 * the deck, and a ×2 On Reveal multiplier already active in the lane.
 *
 * "REPEATER" means an Odin-style "invoke your other On Reveal cards here."
 */
export const WONG_JUBILEE_REPEATER_GOLDEN_TRACE = [
  'JUBILEE_NATURAL_INVOCATION_X2',
  'JUBILEE_REPETITION_1_DEPLOYS_REPEATER',
  'REPEATER_NATURAL_INVOCATION_X2',
  'REPEATER_REPETITION_1_RETRIGGERS_JUBILEE',
  'JUBILEE_RETRIGGER_1_X2_DEPLOYS_TWO',
  'REPEATER_REPETITION_2_RETRIGGERS_JUBILEE',
  'JUBILEE_RETRIGGER_2_X2_DEPLOYS_TWO',
  'JUBILEE_REPETITION_2_DEPLOYS_ONE',
] as const;

export const WONG_JUBILEE_REPEATER_EXPECTATIONS = {
  unlimitedCapacityDeckDeployments: 6,
  includesRepeaterDeployment: true,
  fourSlotLaneStartingOccupancy: 2,
  fourSlotLaneSuccessfulAdditionalDeployments: 2,
  fourSlotLaneFinalOccupancy: 4,
  blockedAttemptsAreNormalNoOps: true,
  laterAttemptsDoNotRemoveDeckCards: true,
  repeaterNeverTargetsItself: true,
} as const;

export const KERNEL_FAILURE_CODES = [
  'BUDGET_EXCEEDED',
  'INVALID_OPERATION_OUTPUT',
  'MISSING_SEMANTICS',
  'INVALID_RULE_SOURCE',
  'ILLEGAL_EVENT_PRODUCER',
  'RNG_CONTRACT_VIOLATION',
  'REDUCER_INVARIANT',
] as const;

export type KernelFailureCode = (typeof KERNEL_FAILURE_CODES)[number];

export interface KernelFailure {
  readonly kind: 'KERNEL_FAILURE';
  readonly code: KernelFailureCode;
  readonly message: string;
  readonly workItemsConsumed: number;
  readonly eventsProduced: number;
  readonly reactionsScheduled: number;
  readonly sourceInstanceId?: string;
}

export type KernelResolutionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: KernelFailure };

export interface ResolutionBudget {
  readonly maxWorkItems: number;
  readonly maxEvents: number;
  readonly maxReactions: number;
  readonly maxEffectDepth: number;
  readonly maxCreatedEntities: number;
}

export const DEFAULT_RESOLUTION_BUDGET = {
  maxWorkItems: 8_192,
  maxEvents: 2_048,
  maxReactions: 4_096,
  maxEffectDepth: 32,
  maxCreatedEntities: 256,
} as const satisfies ResolutionBudget;

export const KERNEL_FAILURE_ATOMICITY = {
  publishEvents: false,
  publishFrames: false,
  storeReceipt: false,
  advanceRevision: false,
  advanceRng: false,
  changeCanonicalState: false,
  convertToPlayerIllegality: false,
  retainSecondLock: false,
  preservePreviouslyAcceptedFirstLock: true,
  permitRetryOfFailedIntentId: true,
} as const;

export const C4A_PILOT = {
  command: 'CHANGE_STORED_POWER',
  eventType: 'CARD_POWER_CHANGED',
  policy: 'COURTHOUSE_POSITIVE_POWER_PROHIBITION',
  ledger: 'PowerLedgerEntry',
  reactionPlan: REACTION_ORDER_PLANS.CARD_POWER_CHANGED,
} as const;

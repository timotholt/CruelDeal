import type { MatchEvent } from '../services/playgame/engine/types/events';

type JsonSchema = Readonly<Record<string, unknown>>;

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const ref = (name: string): JsonSchema => ({ $ref: `#/$defs/${name}` });
const string = (options: JsonSchema = {}): JsonSchema => ({
  type: 'string',
  minLength: 1,
  ...options,
});
const integer = (minimum: number, options: JsonSchema = {}): JsonSchema => ({
  type: 'integer',
  minimum,
  maximum: MAX_SAFE_INTEGER,
  ...options,
});
const object = (
  properties: Readonly<Record<string, JsonSchema>>,
  required: readonly string[],
  options: JsonSchema = {},
): JsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
  ...options,
});
const array = (items: JsonSchema, options: JsonSchema = {}): JsonSchema => ({
  type: 'array',
  items,
  ...options,
});
const tagged = (
  type: string,
  properties: Readonly<Record<string, JsonSchema>> = {},
  required: readonly string[] = [],
): JsonSchema => object(
  { type: { const: type }, ...properties },
  ['type', ...required],
);
const kinded = (
  kind: string,
  properties: Readonly<Record<string, JsonSchema>> = {},
  required: readonly string[] = [],
): JsonSchema => object(
  { kind: { const: kind }, ...properties },
  ['kind', ...required],
);

const CORE_BOUNDARY_EVENT_TYPES = [
  'TURN_RESOLUTION_STARTED',
  'TURN_STARTED',
  'TURN_ENDED',
  'MATCH_ENDED',
] as const;

const GOVERNED_LOCATION_EVENT_TYPES = [
  'LOCATION_DECK_INITIALIZED',
  'LOCATION_CARD_CREATED',
  'LOCATION_CARD_DRAWN',
  'LOCATION_CARD_PLAYED',
  'LOCATION_SLOT_REVEAL_SCHEDULED',
  'LOCATION_REVEALED',
  'LOCATION_TURNED_FACE_DOWN',
  'LOCATION_SHOWN_TO_SEATS',
  'LOCATION_REPLACED',
  'LOCATIONS_SWAPPED',
  'LOCATION_MOVED',
  'LOCATION_REMOVED_FROM_LANE',
  'LOCATION_RETURNED_TO_DECK',
  'LANE_DESTRUCTION_STARTED',
  'LANE_DESTROYED',
  'LANE_CREATION_STARTED',
  'LANE_CREATED',
] as const;

export const PROTOCOL_MATCH_EVENT_TYPES = [
  'GAMEPLAY_RNG_ADVANCED',
  'CARD_STAGED',
  'ENERGY_CHANGED',
  'MAX_ENERGY_CHANGED',
  'NEXT_TURN_ENERGY_BONUS_CHANGED',
  'CARD_REVEALED',
  'CARD_PLAY_COMPLETED',
  'CARD_REVEAL_SCHEDULED',
  'OR_WINDOW_OPEN',
  'OR_WINDOW_CLOSE',
  'CARD_POWER_CHANGED',
  'CARD_COST_CHANGED',
  'CARD_DESTROYED',
  'CARD_DISCARDED',
  'CARD_BANISHED',
  'CARD_MOVED',
  'CARD_RETURNED_TO_LANE',
  'CARD_TRANSFORMED',
  'CARD_TAG_ADDED',
  'CARD_TAG_REMOVED',
  'CARD_TEXT_OVERRIDDEN',
  'CARD_COUNTER_CHANGED',
  'CARD_DRAWN',
  'CARD_CREATED',
  'CARD_ZONE_CHANGED',
  'DECK_SHUFFLED',
  'PENDING_EFFECT_SCHEDULED',
  'PENDING_EFFECT_CONSUMED',
  'LOCATION_DECK_INITIALIZED',
  'LOCATION_CARD_CREATED',
  'LOCATION_CARD_DRAWN',
  'LOCATION_CARD_PLAYED',
  'LOCATION_SLOT_REVEAL_SCHEDULED',
  'LOCATION_REVEALED',
  'LOCATION_TURNED_FACE_DOWN',
  'LOCATION_SHOWN_TO_SEATS',
  'LOCATION_REPLACED',
  'LOCATIONS_SWAPPED',
  'LOCATION_MOVED',
  'LOCATION_REMOVED_FROM_LANE',
  'LOCATION_RETURNED_TO_DECK',
  'LOCATION_TAG_ADDED',
  'LOCATION_TAG_REMOVED',
  'LOCATION_COUNTER_CHANGED',
  'LANE_DESTRUCTION_STARTED',
  'LANE_DESTROYED',
  'LANE_CREATION_STARTED',
  'LANE_CREATED',
  'MATCH_SETUP_COMPLETED',
  'TURN_RESOLUTION_STARTED',
  'TURN_STARTED',
  'TURN_ENDED',
  'MATCH_ENDED',
  'RECURSION_LIMIT_HIT',
  'INTENT_REJECTED',
] as const satisfies readonly MatchEvent['type'][];

type MissingMatchEventType = Exclude<
  MatchEvent['type'],
  (typeof PROTOCOL_MATCH_EVENT_TYPES)[number]
>;
const ALL_MATCH_EVENT_TYPES_ARE_COVERED: MissingMatchEventType extends never ? true : false = true;
void ALL_MATCH_EVENT_TYPES_ARE_COVERED;

const OTHER_EVENT_TYPES = PROTOCOL_MATCH_EVENT_TYPES.filter(
  (type) => !([
    ...CORE_BOUNDARY_EVENT_TYPES,
    ...GOVERNED_LOCATION_EVENT_TYPES,
    'CARD_STAGED',
    'CARD_REVEAL_SCHEDULED',
    'PENDING_EFFECT_SCHEDULED',
    'PENDING_EFFECT_CONSUMED',
  ] as readonly string[]).includes(type),
);

const protocolMessage = (kind: string, payload: string): JsonSchema => object(
  {
    protocolVersion: { const: 2 },
    kind: { const: kind },
    payload: ref(payload),
  },
  ['protocolVersion', 'kind', 'payload'],
);

export const AUTHORITY_PROTOCOL_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://cruel-deal.local/protocol/cruel-deal-authority-record-v2.schema.json',
  title: 'CruelDealAuthorityRecordMessageV2',
  description: 'Trusted authority record boundary for Cruel Deal protocol v2.',
  $ref: '#/$defs/AuthorityRecordMessage',
  $defs: {
    SafeInteger: integer(0),
    SafeSignedInteger: {
      type: 'integer',
      minimum: -MAX_SAFE_INTEGER,
      maximum: MAX_SAFE_INTEGER,
    },
    PositiveInteger: integer(1),
    EventFrame: integer(1),
    Seat: { enum: ['P0', 'P1'] },
    ActorSeat: { enum: ['P0', 'P1', 'SYSTEM'] },
    LaneId: integer(0),
    TimelinePhase: {
      enum: ['SETUP', 'ACTION', 'RESOLUTION', 'END', 'START', 'MATCH_END'],
    },
    PriorityReason: {
      enum: ['MORE_LANES', 'MORE_POWER', 'COIN_FLIP', 'RETAINED'],
    },
    MatchMode: { enum: ['CONQUEST', 'LADDER', 'DEBUG'] },
    ParticipantController: {
      enum: ['LOCAL_HUMAN', 'LOCAL_AI', 'REMOTE_PLAYER'],
    },
    TemporalScope: object(
      {
        turn: ref('PositiveInteger'),
        phase: ref('TimelinePhase'),
      },
      ['turn', 'phase'],
    ),
    MatchResult: object(
      {
        winner: { enum: ['P0', 'P1', 'DRAW'] },
        lanesWon: object(
          { P0: ref('SafeInteger'), P1: ref('SafeInteger') },
          ['P0', 'P1'],
        ),
        totalPower: object(
          { P0: ref('SafeSignedInteger'), P1: ref('SafeSignedInteger') },
          ['P0', 'P1'],
        ),
      },
      ['winner', 'lanesWon', 'totalPower'],
    ),
    TurnResolutionStartedEvent: tagged(
      'TURN_RESOLUTION_STARTED',
      { turn: ref('PositiveInteger') },
      ['turn'],
    ),
    TurnStartedEvent: tagged(
      'TURN_STARTED',
      {
        turn: ref('PositiveInteger'),
        priority: ref('Seat'),
        priorityReason: ref('PriorityReason'),
      },
      ['turn', 'priority', 'priorityReason'],
    ),
    TurnEndedEvent: tagged(
      'TURN_ENDED',
      { turn: ref('PositiveInteger') },
      ['turn'],
    ),
    MatchEndedEvent: tagged(
      'MATCH_ENDED',
      { result: ref('MatchResult') },
      ['result'],
    ),
    EffectRef: object(
      {
        sourceId: string(),
        effectKind: { enum: ['ON_REVEAL', 'ONGOING', 'LOCATION', 'SYSTEM'] },
        exprIdx: ref('SafeInteger'),
        reason: string(),
      },
      ['sourceId', 'effectKind', 'reason'],
    ),
    CardRevealTiming: {
      oneOf: [
        object(
          {
            kind: { const: 'TURN' },
            turn: ref('PositiveInteger'),
          },
          ['kind', 'turn'],
        ),
        object(
          { kind: { const: 'END_OF_GAME' } },
          ['kind'],
        ),
      ],
    },
    CardStagedEvent: tagged(
      'CARD_STAGED',
      {
        intentId: string(),
        cardId: string(),
        lane: ref('LaneId'),
        owner: ref('Seat'),
        energyPaid: ref('SafeInteger'),
        cause: ref('EffectRef'),
      },
      ['intentId', 'cardId', 'lane', 'owner', 'energyPaid', 'cause'],
    ),
    CardRevealScheduledEvent: tagged(
      'CARD_REVEAL_SCHEDULED',
      {
        cardId: string(),
        timing: ref('CardRevealTiming'),
        cause: ref('EffectRef'),
      },
      ['cardId', 'timing', 'cause'],
    ),
    EffectExpr: {
      type: 'object',
      properties: { kind: string() },
      required: ['kind'],
      additionalProperties: true,
    },
    LocationCardDeckEntry: object(
      {
        id: string(),
        defId: string(),
        sourceDeckEntry: ref('SafeInteger'),
      },
      ['id', 'defId', 'sourceDeckEntry'],
    ),
    LocationDeckInitializedEvent: tagged(
      'LOCATION_DECK_INITIALIZED',
      {
        locations: array(ref('LocationCardDeckEntry'), { minItems: 1 }),
        cause: ref('EffectRef'),
      },
      ['locations', 'cause'],
    ),
    LocationCardCreatedEvent: tagged(
      'LOCATION_CARD_CREATED',
      {
        locationId: string(),
        defId: string(),
        pendingLane: ref('LaneId'),
        cause: ref('EffectRef'),
      },
      ['locationId', 'defId', 'pendingLane', 'cause'],
    ),
    LocationCardDrawnEvent: tagged(
      'LOCATION_CARD_DRAWN',
      {
        locationId: string(),
        pendingLane: ref('LaneId'),
        cause: ref('EffectRef'),
      },
      ['locationId', 'pendingLane', 'cause'],
    ),
    LocationCardPlayedEvent: tagged(
      'LOCATION_CARD_PLAYED',
      {
        locationId: string(),
        lane: ref('LaneId'),
        cause: ref('EffectRef'),
      },
      ['locationId', 'lane', 'cause'],
    ),
    LocationSlotRevealScheduledEvent: tagged(
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      {
        lane: ref('LaneId'),
        locationId: string(),
        revealAtTurn: {
          anyOf: [ref('PositiveInteger'), { type: 'null' }],
        },
        cause: ref('EffectRef'),
      },
      ['lane', 'locationId', 'revealAtTurn', 'cause'],
    ),
    LocationRevealedEvent: tagged(
      'LOCATION_REVEALED',
      {
        lane: ref('LaneId'),
        locationId: string(),
        cause: ref('EffectRef'),
      },
      ['lane', 'locationId', 'cause'],
    ),
    LocationTurnedFaceDownEvent: tagged(
      'LOCATION_TURNED_FACE_DOWN',
      {
        lane: ref('LaneId'),
        locationId: string(),
        cause: ref('EffectRef'),
      },
      ['lane', 'locationId', 'cause'],
    ),
    LocationShownToSeatsEvent: tagged(
      'LOCATION_SHOWN_TO_SEATS',
      {
        lane: ref('LaneId'),
        locationId: string(),
        seats: array(ref('Seat'), { minItems: 1, uniqueItems: true }),
        cause: ref('EffectRef'),
      },
      ['lane', 'locationId', 'seats', 'cause'],
    ),
    UnscheduledLocationReplacementRevealPolicy: {
      enum: [
        'REVEAL_IMMEDIATELY',
        'KEEP_SLOT_SCHEDULE',
        'FACE_DOWN_UNSCHEDULED',
      ],
    },
    ScheduledLocationReplacedEvent: tagged(
      'LOCATION_REPLACED',
      {
        lane: ref('LaneId'),
        oldId: string(),
        newId: string(),
        newDefId: string(),
        oldDestination: { enum: ['DISCARD', 'DESTROYED', 'BANISHED'] },
        revealPolicy: { const: 'SCHEDULE_AT_TURN' },
        revealAtTurn: ref('PositiveInteger'),
        cause: ref('EffectRef'),
      },
      [
        'lane',
        'oldId',
        'newId',
        'newDefId',
        'oldDestination',
        'revealPolicy',
        'revealAtTurn',
        'cause',
      ],
    ),
    UnscheduledLocationReplacedEvent: tagged(
      'LOCATION_REPLACED',
      {
        lane: ref('LaneId'),
        oldId: string(),
        newId: string(),
        newDefId: string(),
        oldDestination: { enum: ['DISCARD', 'DESTROYED', 'BANISHED'] },
        revealPolicy: ref('UnscheduledLocationReplacementRevealPolicy'),
        cause: ref('EffectRef'),
      },
      [
        'lane',
        'oldId',
        'newId',
        'newDefId',
        'oldDestination',
        'revealPolicy',
        'cause',
      ],
    ),
    LocationReplacedEvent: {
      oneOf: [
        ref('ScheduledLocationReplacedEvent'),
        ref('UnscheduledLocationReplacedEvent'),
      ],
    },
    LocationSwapLeg: object(
      {
        locationId: string(),
        fromLane: ref('LaneId'),
        toLane: ref('LaneId'),
      },
      ['locationId', 'fromLane', 'toLane'],
    ),
    LocationsSwappedEvent: tagged(
      'LOCATIONS_SWAPPED',
      {
        left: ref('LocationSwapLeg'),
        right: ref('LocationSwapLeg'),
        cause: ref('EffectRef'),
      },
      ['left', 'right', 'cause'],
    ),
    LocationMovedEvent: tagged(
      'LOCATION_MOVED',
      {
        fromLane: ref('LaneId'),
        toLane: ref('LaneId'),
        locationId: string(),
        cause: ref('EffectRef'),
      },
      ['fromLane', 'toLane', 'locationId', 'cause'],
    ),
    LocationRemovedFromLaneEvent: tagged(
      'LOCATION_REMOVED_FROM_LANE',
      {
        lane: ref('LaneId'),
        locationId: string(),
        destination: { enum: ['DISCARD', 'DESTROYED', 'BANISHED'] },
        cause: ref('EffectRef'),
      },
      ['lane', 'locationId', 'destination', 'cause'],
    ),
    LocationReturnedToDeckEvent: tagged(
      'LOCATION_RETURNED_TO_DECK',
      {
        locationId: string(),
        from: { enum: ['STAGING', 'DISCARD', 'DESTROYED'] },
        placement: { enum: ['TOP', 'BOTTOM'] },
        cause: ref('EffectRef'),
      },
      ['locationId', 'from', 'placement', 'cause'],
    ),
    LaneDestructionStartedEvent: tagged(
      'LANE_DESTRUCTION_STARTED',
      {
        lane: ref('LaneId'),
        priorPosition: ref('SafeInteger'),
        cause: ref('EffectRef'),
      },
      ['lane', 'priorPosition', 'cause'],
    ),
    LaneDestroyedEvent: tagged(
      'LANE_DESTROYED',
      {
        lane: ref('LaneId'),
        priorPosition: ref('SafeInteger'),
        cause: ref('EffectRef'),
      },
      ['lane', 'priorPosition', 'cause'],
    ),
    LaneCreationStartedEvent: tagged(
      'LANE_CREATION_STARTED',
      {
        lane: ref('LaneId'),
        position: ref('SafeInteger'),
        cause: ref('EffectRef'),
      },
      ['lane', 'position', 'cause'],
    ),
    LaneCreatedEvent: tagged(
      'LANE_CREATED',
      {
        lane: ref('LaneId'),
        position: ref('SafeInteger'),
        cause: ref('EffectRef'),
      },
      ['lane', 'position', 'cause'],
    ),
    ScheduledPendingEffect: object(
      {
        id: string(),
        kind: { const: 'SCHEDULED' },
        when: { enum: ['START_OF_NEXT_TURN', 'END_OF_NEXT_TURN'] },
        sourceId: string(),
        sourceOwner: {
          anyOf: [
            ref('Seat'),
            { type: 'null' },
          ],
        },
        sourceLane: {
          anyOf: [
            ref('LaneId'),
            { type: 'null' },
          ],
        },
        fireTurn: ref('PositiveInteger'),
        effect: ref('EffectExpr'),
        scheduledBy: ref('EffectRef'),
      },
      [
        'id',
        'kind',
        'when',
        'sourceId',
        'sourceOwner',
        'sourceLane',
        'fireTurn',
        'effect',
        'scheduledBy',
      ],
    ),
    PendingEffectScheduledEvent: tagged(
      'PENDING_EFFECT_SCHEDULED',
      {
        effect: ref('ScheduledPendingEffect'),
        cause: ref('EffectRef'),
      },
      ['effect', 'cause'],
    ),
    PendingEffectConsumedEvent: tagged(
      'PENDING_EFFECT_CONSUMED',
      {
        pendingEffectId: string(),
        cause: ref('EffectRef'),
      },
      ['pendingEffectId', 'cause'],
    ),
    OtherMatchEvent: {
      type: 'object',
      properties: {
        type: { enum: OTHER_EVENT_TYPES },
      },
      required: ['type'],
      additionalProperties: true,
    },
    MatchEvent: {
      oneOf: [
        ref('CardStagedEvent'),
        ref('CardRevealScheduledEvent'),
        ref('TurnResolutionStartedEvent'),
        ref('TurnStartedEvent'),
        ref('TurnEndedEvent'),
        ref('MatchEndedEvent'),
        ref('PendingEffectScheduledEvent'),
        ref('PendingEffectConsumedEvent'),
        ref('LocationDeckInitializedEvent'),
        ref('LocationCardCreatedEvent'),
        ref('LocationCardDrawnEvent'),
        ref('LocationCardPlayedEvent'),
        ref('LocationSlotRevealScheduledEvent'),
        ref('LocationRevealedEvent'),
        ref('LocationTurnedFaceDownEvent'),
        ref('LocationShownToSeatsEvent'),
        ref('LocationReplacedEvent'),
        ref('LocationsSwappedEvent'),
        ref('LocationMovedEvent'),
        ref('LocationRemovedFromLaneEvent'),
        ref('LocationReturnedToDeckEvent'),
        ref('LaneDestructionStartedEvent'),
        ref('LaneDestroyedEvent'),
        ref('LaneCreationStartedEvent'),
        ref('LaneCreatedEvent'),
        ref('OtherMatchEvent'),
      ],
    },
    CanonicalEntityRef: {
      oneOf: [
        kinded('CARD', { cardId: string() }, ['cardId']),
        kinded('LOCATION', { locationId: string() }, ['locationId']),
        kinded('LANE', { laneId: ref('LaneId') }, ['laneId']),
        kinded('PLAYER', { owner: ref('Seat') }, ['owner']),
        kinded('ZONE', {
          owner: { oneOf: [ref('Seat'), { type: 'null' }] },
          zone: string(),
        }, ['owner', 'zone']),
        kinded('SYSTEM', { systemId: string() }, ['systemId']),
      ],
    },
    AbilityRef: object(
      {
        kind: {
          enum: [
            'ON_REVEAL',
            'ONGOING',
            'TRIGGERED',
            'LOCATION',
            'SPELL',
            'SYSTEM',
          ],
        },
        ruleId: string(),
        ruleIndex: ref('SafeInteger'),
      },
      ['kind', 'ruleId', 'ruleIndex'],
    ),
    EffectInvocationReason: {
      enum: ['NATURAL', 'RETRIGGER', 'REACTION', 'SCHEDULED', 'SYSTEM'],
    },
    EffectTargetResult: {
      enum: ['AFFECTED', 'BLOCKED', 'INVALIDATED', 'NO_CHANGE'],
    },
    EffectOutcomeReason: {
      enum: [
        'CANNOT_BE_DESTROYED',
        'CANNOT_BE_MOVED',
        'CANNOT_GAIN_POWER',
        'CANNOT_LOSE_POWER',
        'CANNOT_BE_REVEALED',
        'LANE_FULL',
        'HAND_FULL',
        'EMPTY_DECK',
        'TARGET_LEFT_ZONE',
        'TARGET_NO_LONGER_MATCHES',
        'SOURCE_INACTIVE',
        'ALREADY_SATISFIED',
        'EMPTY_SELECTION',
        'RULE_REPLACED_OPERATION',
        'OTHER_RULE',
      ],
    },
    EffectInvocationStarted: kinded(
      'EFFECT_INVOCATION_STARTED',
      {
        invocationId: string(),
        parentInvocationId: { oneOf: [string(), { type: 'null' }] },
        source: ref('CanonicalEntityRef'),
        ability: ref('AbilityRef'),
        invocationReason: ref('EffectInvocationReason'),
        depth: ref('SafeInteger'),
        candidates: array(ref('CanonicalEntityRef')),
      },
      [
        'invocationId',
        'parentInvocationId',
        'source',
        'ability',
        'invocationReason',
        'depth',
        'candidates',
      ],
    ),
    EffectTargetResolved: kinded(
      'EFFECT_TARGET_RESOLVED',
      {
        invocationId: string(),
        attemptId: string(),
        attemptOrdinal: ref('SafeInteger'),
        operation: string(),
        target: ref('CanonicalEntityRef'),
        result: ref('EffectTargetResult'),
        blockedBy: array(ref('CanonicalEntityRef')),
        reason: { oneOf: [ref('EffectOutcomeReason'), { type: 'null' }] },
      },
      [
        'invocationId',
        'attemptId',
        'attemptOrdinal',
        'operation',
        'target',
        'result',
        'blockedBy',
        'reason',
      ],
    ),
    EffectInvocationCompleted: kinded(
      'EFFECT_INVOCATION_COMPLETED',
      {
        invocationId: string(),
        attempted: ref('SafeInteger'),
        affected: ref('SafeInteger'),
        blocked: ref('SafeInteger'),
        invalidated: ref('SafeInteger'),
        unchanged: ref('SafeInteger'),
      },
      [
        'invocationId',
        'attempted',
        'affected',
        'blocked',
        'invalidated',
        'unchanged',
      ],
    ),
    EffectTraceEntry: {
      oneOf: [
        ref('EffectInvocationStarted'),
        ref('EffectTargetResolved'),
        ref('EffectInvocationCompleted'),
      ],
    },
    CanonicalFrame: object(
      {
        frame: ref('EventFrame'),
        scope: ref('TemporalScope'),
        event: { oneOf: [ref('MatchEvent'), { type: 'null' }] },
        effect: { oneOf: [ref('EffectTraceEntry'), { type: 'null' }] },
      },
      ['frame', 'scope', 'event', 'effect'],
      {
        oneOf: [
          {
            properties: {
              event: ref('MatchEvent'),
              effect: { type: 'null' },
            },
          },
          {
            properties: {
              event: { type: 'null' },
              effect: {
                oneOf: [
                  ref('EffectInvocationStarted'),
                  ref('EffectInvocationCompleted'),
                ],
              },
            },
          },
          {
            properties: {
              event: ref('MatchEvent'),
              effect: {
                allOf: [
                  ref('EffectTargetResolved'),
                  { type: 'object', properties: { result: { const: 'AFFECTED' } } },
                ],
              },
            },
          },
          {
            properties: {
              event: { type: 'null' },
              effect: {
                allOf: [
                  ref('EffectTargetResolved'),
                  {
                    type: 'object',
                    properties: {
                      result: { enum: ['BLOCKED', 'INVALIDATED', 'NO_CHANGE'] },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ),
    RuntimeIntent: {
      oneOf: [
        tagged(
          'STAGE_CARD',
          { cardId: string(), lane: ref('LaneId') },
          ['cardId', 'lane'],
        ),
        tagged('UNSTAGE_CARD', { cardId: string() }, ['cardId']),
        tagged('UNDO_TURN'),
        tagged('END_TURN'),
        tagged('CONCEDE'),
      ],
    },
    IntentEnvelope: object(
      {
        matchId: string(),
        seat: ref('Seat'),
        intentId: string(),
        expectedPublicRevision: ref('SafeInteger'),
        expectedPlanRevision: ref('SafeInteger'),
        intentSeq: ref('SafeInteger'),
        intent: ref('RuntimeIntent'),
      },
      [
        'matchId',
        'seat',
        'intentId',
        'expectedPublicRevision',
        'expectedPlanRevision',
        'intent',
      ],
    ),
    DeckEntry: object(
      { defId: string(), variantId: string() },
      ['defId'],
    ),
    ParticipantBootstrap: object(
      {
        participantId: string(),
        controller: ref('ParticipantController'),
        displayName: string(),
        avatarId: string(),
      },
      ['participantId', 'controller', 'displayName'],
    ),
    PlayerDeckBootstrap: object(
      {
        kind: { const: 'PLAYER' },
        deckId: string(),
        revision: ref('SafeInteger'),
        name: string(),
        entries: array(ref('DeckEntry')),
        contentHash: string(),
      },
      ['kind', 'deckId', 'revision', 'name', 'entries', 'contentHash'],
    ),
    LocationDeckEntry: object(
      { defId: string() },
      ['defId'],
    ),
    LocationDeckBootstrap: object(
      {
        kind: { const: 'LOCATION' },
        order: { const: 'WEIGHTED_RANDOM' },
        deckId: string(),
        revision: ref('SafeInteger'),
        name: string(),
        entries: array(ref('LocationDeckEntry')),
        contentHash: string(),
      },
      ['kind', 'order', 'deckId', 'revision', 'name', 'entries', 'contentHash'],
    ),
    MatchBootstrap: object(
      {
        matchId: string(),
        mode: ref('MatchMode'),
        seed: string(),
        rulesetId: string(),
        manifestVersion: ref('SafeInteger'),
        viewerSeat: ref('Seat'),
        participants: object(
          {
            P0: ref('ParticipantBootstrap'),
            P1: ref('ParticipantBootstrap'),
          },
          ['P0', 'P1'],
        ),
        decks: object(
          {
            P0: ref('PlayerDeckBootstrap'),
            P1: ref('PlayerDeckBootstrap'),
            LOCATIONS: ref('LocationDeckBootstrap'),
          },
          ['P0', 'P1', 'LOCATIONS'],
        ),
      },
      [
        'matchId',
        'mode',
        'seed',
        'rulesetId',
        'manifestVersion',
        'viewerSeat',
        'participants',
        'decks',
      ],
    ),
    CommittedIntentIdentity: object(
      {
        matchId: string(),
        seat: ref('ActorSeat'),
        intentId: string(),
        intentSeq: ref('SafeInteger'),
      },
      ['matchId', 'seat', 'intentId'],
    ),
    CommittedTransaction: object(
      {
        transactionId: string(),
        matchId: string(),
        baseRevision: ref('SafeInteger'),
        revision: ref('SafeInteger'),
        intent: ref('CommittedIntentIdentity'),
        frames: array(ref('CanonicalFrame'), { minItems: 1 }),
        rngDrawsBefore: ref('SafeInteger'),
        rngDrawsAfter: ref('SafeInteger'),
      },
      [
        'transactionId',
        'matchId',
        'baseRevision',
        'revision',
        'intent',
        'frames',
        'rngDrawsBefore',
        'rngDrawsAfter',
      ],
    ),
    AuthorityRecordMessage: {
      oneOf: [
        protocolMessage('MATCH_BOOTSTRAP', 'MatchBootstrap'),
        protocolMessage('CANONICAL_FRAME', 'CanonicalFrame'),
        protocolMessage('COMMITTED_TRANSACTION', 'CommittedTransaction'),
      ],
    },
  },
} as const satisfies JsonSchema;

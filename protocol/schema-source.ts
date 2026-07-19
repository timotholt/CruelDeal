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

const CORE_BOUNDARY_EVENT_TYPES = [
  'TURN_RESOLUTION_STARTED',
  'TURN_STARTED',
  'TURN_ENDED',
  'MATCH_ENDED',
] as const;

export const PROTOCOL_MATCH_EVENT_TYPES = [
  'GAMEPLAY_RNG_ADVANCED',
  'CARD_STAGED',
  'CARD_UNSTAGED',
  'ENERGY_CHANGED',
  'MAX_ENERGY_CHANGED',
  'NEXT_TURN_ENERGY_BONUS_CHANGED',
  'CARD_FLIPPED',
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
  'PENDING_EFFECT_ADDED',
  'PENDING_EFFECT_REMOVED',
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
  (type) => !(CORE_BOUNDARY_EVENT_TYPES as readonly string[]).includes(type),
);

const protocolMessage = (kind: string, payload: string): JsonSchema => object(
  {
    protocolVersion: { const: 1 },
    kind: { const: kind },
    payload: ref(payload),
  },
  ['protocolVersion', 'kind', 'payload'],
);

export const PROTOCOL_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://cruel-deal.local/protocol/cruel-deal-protocol-v1.schema.json',
  title: 'CruelDealProtocolMessageV1',
  description: 'Language-neutral structural boundary for Cruel Deal protocol v1.',
  $ref: '#/$defs/ProtocolMessage',
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
        ref('TurnResolutionStartedEvent'),
        ref('TurnStartedEvent'),
        ref('TurnEndedEvent'),
        ref('MatchEndedEvent'),
        ref('OtherMatchEvent'),
      ],
    },
    FramedEvent: object(
      {
        frame: ref('EventFrame'),
        scope: ref('TemporalScope'),
        event: ref('MatchEvent'),
      },
      ['frame', 'scope', 'event'],
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
        expectedRevision: ref('SafeInteger'),
        intentSeq: ref('SafeInteger'),
        intent: ref('RuntimeIntent'),
      },
      ['matchId', 'seat', 'intentId', 'expectedRevision', 'intent'],
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
        framedEvents: array(ref('FramedEvent'), { minItems: 1 }),
        rngDrawsBefore: ref('SafeInteger'),
        rngDrawsAfter: ref('SafeInteger'),
      },
      [
        'transactionId',
        'matchId',
        'baseRevision',
        'revision',
        'intent',
        'framedEvents',
        'rngDrawsBefore',
        'rngDrawsAfter',
      ],
    ),
    SeatVisibleCard: object(
      {
        token: string(),
        owner: ref('Seat'),
        zone: {
          enum: ['HAND', 'LANE', 'DISCARD', 'DESTROYED'],
        },
        lane: {
          anyOf: [ref('LaneId'), { type: 'null' }],
        },
        revealed: { type: 'boolean' },
        defId: string(),
        variantId: string(),
        cost: ref('SafeSignedInteger'),
        power: ref('SafeSignedInteger'),
        tags: array(string()),
        counters: object({}, [], {
          additionalProperties: ref('SafeSignedInteger'),
        }),
      },
      ['token', 'owner', 'zone', 'lane', 'revealed'],
    ),
    SeatVisibleLocation: object(
      {
        token: string(),
        face: { enum: ['FACE_DOWN', 'FACE_UP'] },
        revealAtTurn: {
          anyOf: [ref('PositiveInteger'), { type: 'null' }],
        },
        defId: string(),
      },
      ['token', 'face', 'revealAtTurn'],
    ),
    SeatVisibleLane: object(
      {
        id: ref('LaneId'),
        status: {
          enum: ['CREATING', 'ACTIVE', 'DESTROYING', 'DESTROYED'],
        },
        location: {
          anyOf: [ref('SeatVisibleLocation'), { type: 'null' }],
        },
        cards: object(
          {
            P0: array(string()),
            P1: array(string()),
          },
          ['P0', 'P1'],
        ),
      },
      ['id', 'status', 'location', 'cards'],
    ),
    SeatVisibleMatchState: object(
      {
        turn: ref('SafeInteger'),
        phase: {
          enum: [
            'SETUP',
            'AWAITING_INTENT',
            'RESOLVING',
            'BETWEEN_TURNS',
            'ENDED',
          ],
        },
        priority: ref('Seat'),
        energy: object(
          { P0: ref('SafeSignedInteger'), P1: ref('SafeSignedInteger') },
          ['P0', 'P1'],
        ),
        maxEnergy: object(
          { P0: ref('SafeSignedInteger'), P1: ref('SafeSignedInteger') },
          ['P0', 'P1'],
        ),
        nextTurnEnergyBonus: object(
          { P0: ref('SafeSignedInteger'), P1: ref('SafeSignedInteger') },
          ['P0', 'P1'],
        ),
        deckCounts: object(
          { P0: ref('SafeInteger'), P1: ref('SafeInteger') },
          ['P0', 'P1'],
        ),
        locationDeckCount: ref('SafeInteger'),
        hands: object(
          { P0: array(string()), P1: array(string()) },
          ['P0', 'P1'],
        ),
        cards: array(ref('SeatVisibleCard')),
        lanes: array(ref('SeatVisibleLane')),
        stagedCards: array(string()),
        discard: object(
          { P0: array(string()), P1: array(string()) },
          ['P0', 'P1'],
        ),
        destroyed: object(
          { P0: array(string()), P1: array(string()) },
          ['P0', 'P1'],
        ),
        banishedCounts: object(
          { P0: ref('SafeInteger'), P1: ref('SafeInteger') },
          ['P0', 'P1'],
        ),
        result: {
          anyOf: [ref('MatchResult'), { type: 'null' }],
        },
      },
      [
        'turn',
        'phase',
        'priority',
        'energy',
        'maxEnergy',
        'nextTurnEnergyBonus',
        'deckCounts',
        'locationDeckCount',
        'hands',
        'cards',
        'lanes',
        'stagedCards',
        'discard',
        'destroyed',
        'banishedCounts',
        'result',
      ],
    ),
    SeatMatchSnapshot: object(
      {
        version: { const: 1 },
        matchId: string(),
        revision: ref('SafeInteger'),
        frame: ref('SafeInteger'),
        viewerSeat: ref('Seat'),
        state: ref('SeatVisibleMatchState'),
      },
      ['version', 'matchId', 'revision', 'frame', 'viewerSeat', 'state'],
    ),
    SeatAnimationEvent: object(
      {
        type: { enum: PROTOCOL_MATCH_EVENT_TYPES },
        data: {
          type: 'object',
          additionalProperties: true,
        },
      },
      ['type', 'data'],
    ),
    SeatFramedAnimationEvent: object(
      {
        frame: ref('EventFrame'),
        scope: ref('TemporalScope'),
        event: ref('SeatAnimationEvent'),
      },
      ['frame', 'scope', 'event'],
    ),
    SeatCommittedTransaction: object(
      {
        version: { const: 1 },
        transactionId: string(),
        matchId: string(),
        baseRevision: ref('SafeInteger'),
        revision: ref('SafeInteger'),
        frame: ref('SafeInteger'),
        viewerSeat: ref('Seat'),
        events: array(ref('SeatFramedAnimationEvent')),
        postState: ref('SeatVisibleMatchState'),
      },
      [
        'version',
        'transactionId',
        'matchId',
        'baseRevision',
        'revision',
        'frame',
        'viewerSeat',
        'events',
        'postState',
      ],
    ),
    SeatResyncRequest: object(
      {
        version: { const: 1 },
        matchId: string(),
        viewerSeat: ref('Seat'),
        knownRevision: ref('SafeInteger'),
        knownFrame: ref('SafeInteger'),
      },
      ['version', 'matchId', 'viewerSeat', 'knownRevision', 'knownFrame'],
    ),
    SeatResyncResponse: object(
      {
        version: { const: 1 },
        snapshot: ref('SeatMatchSnapshot'),
        transactions: array(ref('SeatCommittedTransaction')),
      },
      ['version', 'snapshot', 'transactions'],
    ),
    ProtocolMessage: {
      oneOf: [
        protocolMessage('MATCH_BOOTSTRAP', 'MatchBootstrap'),
        protocolMessage('INTENT_ENVELOPE', 'IntentEnvelope'),
        protocolMessage('FRAMED_EVENT', 'FramedEvent'),
        protocolMessage('COMMITTED_TRANSACTION', 'CommittedTransaction'),
        protocolMessage('SEAT_MATCH_SNAPSHOT', 'SeatMatchSnapshot'),
        protocolMessage('SEAT_COMMITTED_TRANSACTION', 'SeatCommittedTransaction'),
        protocolMessage('SEAT_RESYNC_REQUEST', 'SeatResyncRequest'),
        protocolMessage('SEAT_RESYNC_RESPONSE', 'SeatResyncResponse'),
      ],
    },
  },
} as const satisfies JsonSchema;

type JsonSchema = Readonly<Record<string, unknown>>;

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const ref = (name: string): JsonSchema => ({ $ref: `#/$defs/${name}` });
const string = (): JsonSchema => ({ type: 'string', minLength: 1 });
const integer = (minimum: number): JsonSchema => ({
  type: 'integer',
  minimum,
  maximum: MAX_SAFE_INTEGER,
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
const kinded = (
  kind: string,
  properties: Readonly<Record<string, JsonSchema>> = {},
  required: readonly string[] = [],
): JsonSchema => object(
  { kind: { const: kind }, ...properties },
  ['kind', ...required],
);
const typed = (
  type: string,
  properties: Readonly<Record<string, JsonSchema>> = {},
  required: readonly string[] = [],
): JsonSchema => object(
  { type: { const: type }, ...properties },
  ['type', ...required],
);
const playerMessage = (kind: string, payload: string): JsonSchema => object(
  {
    protocolVersion: { const: 2 },
    kind: { const: kind },
    payload: ref(payload),
  },
  ['protocolVersion', 'kind', 'payload'],
);

export const PLAYER_WIRE_PROTOCOL_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://cruel-deal.local/protocol/cruel-deal-player-wire-v2.schema.json',
  title: 'CruelDealPlayerWireMessageV2',
  description: 'Default-deny seat-safe player wire boundary for Cruel Deal protocol v2.',
  $ref: '#/$defs/PlayerWireMessage',
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
    LaneId: integer(0),
    TimelinePhase: {
      enum: ['SETUP', 'ACTION', 'RESOLUTION', 'END', 'START', 'MATCH_END'],
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
    SeatVisibleCard: object(
      {
        token: string(),
        owner: ref('Seat'),
        zone: { enum: ['HAND', 'LANE', 'DISCARD', 'DESTROYED', 'BANISHED'] },
        lane: { anyOf: [ref('LaneId'), { type: 'null' }] },
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
        revealAtTurn: { anyOf: [ref('PositiveInteger'), { type: 'null' }] },
        defId: string(),
      },
      ['token', 'face', 'revealAtTurn'],
    ),
    SeatVisibleLane: object(
      {
        id: ref('LaneId'),
        status: { enum: ['CREATING', 'ACTIVE', 'DESTROYING', 'DESTROYED'] },
        location: { anyOf: [ref('SeatVisibleLocation'), { type: 'null' }] },
        cards: object(
          { P0: array(string()), P1: array(string()) },
          ['P0', 'P1'],
        ),
        power: object(
          { P0: ref('SafeSignedInteger'), P1: ref('SafeSignedInteger') },
          ['P0', 'P1'],
        ),
      },
      ['id', 'status', 'location', 'cards', 'power'],
    ),
    SeatVisibleMatchState: object(
      {
        turn: ref('SafeInteger'),
        phase: {
          enum: ['SETUP', 'AWAITING_INTENT', 'RESOLVING', 'BETWEEN_TURNS', 'ENDED'],
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
        banished: object(
          { P0: array(string()), P1: array(string()) },
          ['P0', 'P1'],
        ),
        banishedCounts: object(
          { P0: ref('SafeInteger'), P1: ref('SafeInteger') },
          ['P0', 'P1'],
        ),
        result: { anyOf: [ref('MatchResult'), { type: 'null' }] },
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
        'banished',
        'banishedCounts',
        'result',
      ],
    ),
    SeatMatchSnapshot: object(
      {
        version: { const: 2 },
        matchId: string(),
        publicRevision: ref('SafeInteger'),
        planRevision: ref('SafeInteger'),
        frame: ref('SafeInteger'),
        viewerSeat: ref('Seat'),
        interactionStatus: { enum: ['PLANNING', 'WAITING', 'PRESENTING', 'TERMINAL'] },
        state: ref('SeatVisibleMatchState'),
      },
      [
        'version',
        'matchId',
        'publicRevision',
        'planRevision',
        'frame',
        'viewerSeat',
        'interactionStatus',
        'state',
      ],
    ),
    JsonValue: {
      anyOf: [
        { type: 'null' },
        { type: 'boolean' },
        { type: 'number' },
        { type: 'string' },
        array(ref('JsonValue')),
        {
          type: 'object',
          additionalProperties: ref('JsonValue'),
        },
      ],
    },
    SeatAnimationEvent: object(
      {
        type: string(),
        data: {
          type: 'object',
          additionalProperties: ref('JsonValue'),
        },
      },
      ['type', 'data'],
    ),
    SeatEntityRef: {
      oneOf: [
        kinded('CARD', { token: string() }, ['token']),
        kinded('LOCATION', { token: string() }, ['token']),
        kinded('LANE', { laneId: ref('LaneId') }, ['laneId']),
        kinded('PLAYER', { owner: ref('Seat') }, ['owner']),
        kinded('ZONE', {
          owner: { oneOf: [ref('Seat'), { type: 'null' }] },
          zone: string(),
        }, ['owner', 'zone']),
        kinded('SYSTEM', { systemId: string() }, ['systemId']),
        kinded('HIDDEN', {
          category: { enum: ['CARD', 'LOCATION', 'RULE'] },
        }, ['category']),
      ],
    },
    SeatAbilityRef: {
      oneOf: [
        object(
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
        kinded('HIDDEN'),
      ],
    },
    SeatEffectInvocationStarted: kinded(
      'EFFECT_INVOCATION_STARTED',
      {
        invocationToken: string(),
        parentInvocationToken: { oneOf: [string(), { type: 'null' }] },
        source: ref('SeatEntityRef'),
        ability: ref('SeatAbilityRef'),
        invocationReason: {
          enum: ['NATURAL', 'RETRIGGER', 'REACTION', 'SCHEDULED', 'SYSTEM'],
        },
        depth: ref('SafeInteger'),
        candidates: array(ref('SeatEntityRef')),
      },
      [
        'invocationToken',
        'parentInvocationToken',
        'source',
        'ability',
        'invocationReason',
        'depth',
        'candidates',
      ],
    ),
    SeatEffectTargetResolved: kinded(
      'EFFECT_TARGET_RESOLVED',
      {
        invocationToken: string(),
        attemptToken: string(),
        attemptOrdinal: ref('SafeInteger'),
        operation: string(),
        target: ref('SeatEntityRef'),
        result: { enum: ['AFFECTED', 'BLOCKED', 'INVALIDATED', 'NO_CHANGE'] },
        blockedBy: array(ref('SeatEntityRef')),
        reason: {
          oneOf: [
            {
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
            { type: 'null' },
          ],
        },
      },
      [
        'invocationToken',
        'attemptToken',
        'attemptOrdinal',
        'operation',
        'target',
        'result',
        'blockedBy',
        'reason',
      ],
    ),
    SeatEffectInvocationCompleted: kinded(
      'EFFECT_INVOCATION_COMPLETED',
      {
        invocationToken: string(),
        attempted: ref('SafeInteger'),
        affected: ref('SafeInteger'),
        blocked: ref('SafeInteger'),
        invalidated: ref('SafeInteger'),
        unchanged: ref('SafeInteger'),
      },
      [
        'invocationToken',
        'attempted',
        'affected',
        'blocked',
        'invalidated',
        'unchanged',
      ],
    ),
    SeatEffectTraceEntry: {
      oneOf: [
        ref('SeatEffectInvocationStarted'),
        ref('SeatEffectTargetResolved'),
        ref('SeatEffectInvocationCompleted'),
      ],
    },
    SeatPresentationFrame: object(
      {
        index: ref('SafeInteger'),
        frame: ref('EventFrame'),
        scope: ref('TemporalScope'),
        event: { oneOf: [ref('SeatAnimationEvent'), { type: 'null' }] },
        effect: { oneOf: [ref('SeatEffectTraceEntry'), { type: 'null' }] },
        after: ref('SeatVisibleMatchState'),
      },
      ['index', 'frame', 'scope', 'event', 'effect', 'after'],
    ),
    SeatPresentationBlock: object(
      {
        version: { const: 2 },
        transactionId: string(),
        matchId: string(),
        viewerSeat: ref('Seat'),
        basePublicRevision: ref('SafeInteger'),
        publicRevision: ref('SafeInteger'),
        firstFrame: ref('EventFrame'),
        lastFrame: ref('EventFrame'),
        preState: ref('SeatVisibleMatchState'),
        frames: array(ref('SeatPresentationFrame')),
        postState: ref('SeatVisibleMatchState'),
        postStateHash: string(),
      },
      [
        'version',
        'transactionId',
        'matchId',
        'viewerSeat',
        'basePublicRevision',
        'publicRevision',
        'firstFrame',
        'lastFrame',
        'preState',
        'frames',
        'postState',
        'postStateHash',
      ],
    ),
    SeatCommand: {
      oneOf: [
        typed(
          'STAGE_CARD',
          {
            token: string(),
            lane: ref('LaneId'),
          },
          ['token', 'lane'],
        ),
        typed('UNSTAGE_CARD', { token: string() }, ['token']),
        typed('UNDO_TURN'),
        typed('END_TURN'),
        typed('CONCEDE'),
      ],
    },
    SeatCommandEnvelope: object(
      {
        version: { const: 2 },
        matchId: string(),
        commandId: string(),
        expectedPublicRevision: ref('SafeInteger'),
        expectedPlanRevision: ref('SafeInteger'),
        command: ref('SeatCommand'),
      },
      [
        'version',
        'matchId',
        'commandId',
        'expectedPublicRevision',
        'expectedPlanRevision',
        'command',
      ],
    ),
    SeatBlockAck: object(
      {
        version: { const: 2 },
        matchId: string(),
        viewerSeat: ref('Seat'),
        publicRevision: ref('SafeInteger'),
        frame: ref('SafeInteger'),
        postStateHash: string(),
      },
      [
        'version',
        'matchId',
        'viewerSeat',
        'publicRevision',
        'frame',
        'postStateHash',
      ],
    ),
    SeatResyncRequest: object(
      {
        version: { const: 2 },
        matchId: string(),
        viewerSeat: ref('Seat'),
        publicRevision: ref('SafeInteger'),
        planRevision: ref('SafeInteger'),
        frame: ref('SafeInteger'),
        postStateHash: { oneOf: [string(), { type: 'null' }] },
      },
      [
        'version',
        'matchId',
        'viewerSeat',
        'publicRevision',
        'planRevision',
        'frame',
        'postStateHash',
      ],
    ),
    SeatResyncResponse: {
      oneOf: [
        typed('SNAPSHOT', { snapshot: ref('SeatMatchSnapshot') }, ['snapshot']),
        typed(
          'PRESENTATION_BLOCK',
          { block: ref('SeatPresentationBlock') },
          ['block'],
        ),
      ],
    },
    PlayerWireMessage: {
      oneOf: [
        playerMessage('SEAT_MATCH_SNAPSHOT', 'SeatMatchSnapshot'),
        playerMessage('SEAT_PRESENTATION_BLOCK', 'SeatPresentationBlock'),
        playerMessage('SEAT_COMMAND_ENVELOPE', 'SeatCommandEnvelope'),
        playerMessage('SEAT_BLOCK_ACK', 'SeatBlockAck'),
        playerMessage('SEAT_RESYNC_REQUEST', 'SeatResyncRequest'),
        playerMessage('SEAT_RESYNC_RESPONSE', 'SeatResyncResponse'),
      ],
    },
  },
} as const satisfies JsonSchema;

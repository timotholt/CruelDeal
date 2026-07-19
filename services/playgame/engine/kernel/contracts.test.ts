import { describe, expect, it } from 'vitest';
import {
  C4A_PILOT,
  CLEAN_CUTOVER_REPLACEMENTS,
  DECK_DEPLOYMENT_CONTRACT,
  DEFAULT_RESOLUTION_BUDGET,
  KERNEL_FAILURE_ATOMICITY,
  KERNEL_FAILURE_CODES,
  KERNEL_LIFECYCLE_EVENT_TYPES,
  LIFECYCLE_TRANSITION_CONTRACTS,
  ON_REVEAL_INVOCATION_CONTRACT,
  PRIVATE_PLANNING_EVENT_TYPES,
  REACTION_ORDER_DIMENSIONS,
  REACTION_ORDER_PLANS,
  REQUIRED_KERNEL_COMMAND_TYPES,
  SPAWN_AND_REVEAL_CLEAN_CUTOVER,
  SUPERSEDED_LIFECYCLE_EVENT_TYPES,
  WONG_JUBILEE_REPEATER_EXPECTATIONS,
  WONG_JUBILEE_REPEATER_GOLDEN_TRACE,
} from './contracts';

describe('C4A kernel contract readiness', () => {
  it('closes the semantic contract over every target lifecycle event', () => {
    expect(Object.keys(LIFECYCLE_TRANSITION_CONTRACTS)).toEqual(
      KERNEL_LIFECYCLE_EVENT_TYPES,
    );
    expect(Object.keys(REACTION_ORDER_PLANS)).toEqual(
      KERNEL_LIFECYCLE_EVENT_TYPES,
    );

    for (const contract of Object.values(LIFECYCLE_TRANSITION_CONTRACTS)) {
      expect(contract.ownerRequired).toBe(true);
      expect(contract.causeRequired).toBe(true);
      expect(contract.entityRequired).toBe(true);
      expect(contract.allowedPriorZones.length).toBeGreaterThan(0);
      expect(contract.allowedResultingZones.length).toBeGreaterThan(0);
      expect(contract.ruleSourceEdges.length).toBeGreaterThan(0);
    }
  });

  it('keeps private planning outside committed lifecycle dispatch', () => {
    expect(PRIVATE_PLANNING_EVENT_TYPES).toEqual([
      'CARD_STAGED',
      'CARD_UNSTAGED',
    ]);
    expect(
      PRIVATE_PLANNING_EVENT_TYPES.some((type) =>
        KERNEL_LIFECYCLE_EVENT_TYPES.includes(
          type as (typeof KERNEL_LIFECYCLE_EVENT_TYPES)[number],
        ),
      ),
    ).toBe(false);
  });

  it('requires a clean event cutover instead of aliases or dual paths', () => {
    expect(SUPERSEDED_LIFECYCLE_EVENT_TYPES).toEqual([
      'CARD_FLIPPED',
      'CARD_ADDED_TO_DECK',
      'CARD_ADDED_TO_HAND',
      'CARD_ADDED_TO_LANE',
      'CARD_MOVED_TO_ZONE',
    ]);
    expect(CLEAN_CUTOVER_REPLACEMENTS.CARD_FLIPPED).toEqual([
      'CARD_REVEALED',
      'CARD_PLAY_COMPLETED',
    ]);
    expect(
      Object.values(CLEAN_CUTOVER_REPLACEMENTS).flat().every((type) =>
        KERNEL_LIFECYCLE_EVENT_TYPES.includes(type),
      ),
    ).toBe(true);
  });

  it('locks destruction to historical card then historical location order', () => {
    expect(REACTION_ORDER_PLANS.CARD_DESTROYED).toEqual([
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
    ]);
  });

  it('locks lane move order to source-left, destination-entered, moved-card', () => {
    expect(
      REACTION_ORDER_PLANS.CARD_MOVED.map((step) => step.hook),
    ).toEqual([
      'LOCATION_ON_CARD_LEFT_HERE',
      'LOCATION_ON_CARD_ENTERED_HERE',
      'CARD_ON_MOVE',
    ]);
    expect(
      REACTION_ORDER_PLANS.CARD_MOVED.map((step) => step.sourceEdge),
    ).toEqual(['BEFORE', 'AFTER', 'AFTER']);
  });

  it('uses explicit unique ascending timing bands for every event', () => {
    for (const plan of Object.values(REACTION_ORDER_PLANS)) {
      const bands = plan.map((step) => step.timingBand);
      expect(new Set(bands).size).toBe(bands.length);
      expect(bands).toEqual([...bands].sort((left, right) => left - right));
    }

    expect(REACTION_ORDER_DIMENSIONS).toEqual([
      'timingBand',
      'prioritySeatRank',
      'laneOrdinal',
      'cardOrdinal',
      'ruleIndex',
      'sourceInstanceId',
    ]);
  });

  it('names stored permanent power as the C4A vertical slice', () => {
    expect(C4A_PILOT.command).toBe('CHANGE_STORED_POWER');
    expect(C4A_PILOT.eventType).toBe('CARD_POWER_CHANGED');
    expect(C4A_PILOT.policy).toContain('COURTHOUSE');
    expect(C4A_PILOT.reactionPlan).toEqual(
      REACTION_ORDER_PLANS.CARD_POWER_CHANGED,
    );
    expect(
      REACTION_ORDER_PLANS.CARD_POWER_CHANGED.map((step) => [
        step.timingBand,
        step.hook,
        step.when,
      ]),
    ).toEqual([
      [100, 'CARD_ON_GAINED_POWER', 'POWER_GAIN'],
      [200, 'LOCATION_ON_CARD_GAINED_POWER_HERE', 'POWER_GAIN'],
      [300, 'LOCATION_ON_CARD_LOST_POWER_HERE', 'POWER_LOSS'],
    ]);
  });

  it('defines finite positive resolution budgets', () => {
    for (const value of Object.values(DEFAULT_RESOLUTION_BUDGET)) {
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('classifies every invariant failure as atomic and non-player-facing', () => {
    expect(KERNEL_FAILURE_CODES).toEqual([
      'BUDGET_EXCEEDED',
      'INVALID_OPERATION_OUTPUT',
      'MISSING_SEMANTICS',
      'INVALID_RULE_SOURCE',
      'ILLEGAL_EVENT_PRODUCER',
      'RNG_CONTRACT_VIOLATION',
      'REDUCER_INVARIANT',
    ]);
    expect(KERNEL_FAILURE_ATOMICITY).toMatchObject({
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
    });
  });

  it('moves the existing deck instance for Jubilee-style deployment', () => {
    expect(REQUIRED_KERNEL_COMMAND_TYPES).toContain('DEPLOY_FROM_DECK');
    expect(DECK_DEPLOYMENT_CONTRACT).toMatchObject({
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
    });
  });

  it('does not preserve the create/deploy conflation', () => {
    expect(SPAWN_AND_REVEAL_CLEAN_CUTOVER).toEqual({
      supersededEffect: 'SPAWN_AND_REVEAL',
      createNewInstance: ['CREATE_CARD', 'INVOKE_ON_REVEAL'],
      deployExistingDeckInstance: ['DEPLOY_FROM_DECK'],
      preserveLegacyPrimitive: false,
    });
  });

  it('snapshots Wong once per invocation without fabricating lifecycle events', () => {
    expect(ON_REVEAL_INVOCATION_CONTRACT).toMatchObject({
      multiplierSampleTiming: 'INVOCATION_START',
      multiplierPersistence: 'SNAPSHOT_SURVIVES_NESTED_SOURCE_REMOVAL',
      abilityListSampleTiming: 'INVOCATION_START',
      repeatUnit: 'WHOLE_ABILITY_LIST',
      effectState: 'CURRENT_CANDIDATE_STATE',
      selectorSampleTiming: 'EACH_EFFECT_EXECUTION_START',
      selectorTargets: 'IMMUTABLE_FOR_ONE_EFFECT_EXECUTION',
      nestedResolution: 'DEPTH_FIRST_BEFORE_NEXT_SIBLING',
      retriggerEmitsCardRevealed: false,
      retriggerEmitsCardPlayCompleted: false,
      retriggerFiresPlayedHere: false,
    });
  });

  it('freezes the Wong, Jubilee, repeater cascade as a C4D golden trace', () => {
    expect(WONG_JUBILEE_REPEATER_GOLDEN_TRACE).toEqual([
      'JUBILEE_NATURAL_INVOCATION_X2',
      'JUBILEE_REPETITION_1_DEPLOYS_REPEATER',
      'REPEATER_NATURAL_INVOCATION_X2',
      'REPEATER_REPETITION_1_RETRIGGERS_JUBILEE',
      'JUBILEE_RETRIGGER_1_X2_DEPLOYS_TWO',
      'REPEATER_REPETITION_2_RETRIGGERS_JUBILEE',
      'JUBILEE_RETRIGGER_2_X2_DEPLOYS_TWO',
      'JUBILEE_REPETITION_2_DEPLOYS_ONE',
    ]);
    expect(WONG_JUBILEE_REPEATER_EXPECTATIONS).toEqual({
      unlimitedCapacityDeckDeployments: 6,
      includesRepeaterDeployment: true,
      fourSlotLaneStartingOccupancy: 2,
      fourSlotLaneSuccessfulAdditionalDeployments: 2,
      fourSlotLaneFinalOccupancy: 4,
      blockedAttemptsAreNormalNoOps: true,
      laterAttemptsDoNotRemoveDeckCards: true,
      repeaterNeverTargetsItself: true,
    });
  });
});

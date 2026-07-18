import { describe, expect, test, vi } from 'vitest';

import {
  BOOTSTRAP_MANIFEST,
  apply,
  createRng,
  replayMatch,
  resolve,
  type MatchEvent,
  type MatchState,
  type Owner,
} from '../../../engine';
import {
  assertManifestValidDeck,
  createOpenedMatch,
  generateMatchCase,
  intentRng,
  type GeneratedMatchCase,
} from './generator';

const PROPERTY_FILE = 'services/playgame/runtime/__tests__/properties/engine-properties.test.ts';
const DEFAULT_LOCAL_CASES = 8;
const MINIMUM_CI_CASES = 200;
const DEFAULT_SUITE_SEED = 'phase0-task-b-properties-v1';
const PROPERTY_TIMEOUT_MS = 120_000;

interface CommitRecord {
  readonly label: string;
  readonly eventStart: number;
  readonly eventEnd: number;
  readonly state: MatchState;
}

interface EventApplication {
  readonly transactionId: string;
  readonly eventIndex: number;
  readonly globalIndex: number;
  readonly event: MatchEvent;
}

interface ExecutionResult {
  readonly genesis: MatchState;
  readonly finalState: MatchState;
  readonly events: readonly MatchEvent[];
  readonly commits: readonly CommitRecord[];
}

interface PropertyCaseRef {
  readonly index: number;
  readonly seed: string;
}

function positiveInteger(value: string | undefined, name: string): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer; received ${value}`);
  }
  return parsed;
}

const suiteSeed = process.env.PLAYGAME_PROPERTY_SEED ?? DEFAULT_SUITE_SEED;
const exactCaseSeed = process.env.PLAYGAME_PROPERTY_CASE_SEED;
const configuredCases = positiveInteger(
  process.env.PLAYGAME_PROPERTY_CASES ?? process.env.PROPERTY_CASES,
  'PLAYGAME_PROPERTY_CASES',
);
const runningInCi = /^(1|true|yes)$/i.test(process.env.CI ?? '');
const caseCount = runningInCi
  ? Math.max(configuredCases ?? MINIMUM_CI_CASES, MINIMUM_CI_CASES)
  : configuredCases ?? DEFAULT_LOCAL_CASES;

function propertyCases(): readonly PropertyCaseRef[] {
  if (exactCaseSeed) return [{ index: 0, seed: exactCaseSeed }];
  return Array.from({ length: caseCount }, (_, index) => ({
    index,
    seed: `${suiteSeed}::case:${index}`,
  }));
}

function commitEvents(
  transactionId: string,
  state: MatchState,
  batch: readonly MatchEvent[],
  allEvents: MatchEvent[],
  onApply?: (application: EventApplication) => void,
): MatchState {
  let next = state;
  batch.forEach((event, eventIndex) => {
    const globalIndex = allEvents.length;
    onApply?.({ transactionId, eventIndex, globalIndex, event });
    allEvents.push(event);
    next = apply(next, event, BOOTSTRAP_MANIFEST);
  });
  return next;
}

function executeGeneratedMatch(
  input: GeneratedMatchCase,
  onApply?: (application: EventApplication) => void,
  beforeIntent?: (intentIndex: number, intent: GeneratedMatchCase['intents'][number]) => void,
): ExecutionResult {
  const opened = createOpenedMatch(input, BOOTSTRAP_MANIFEST);
  const events: MatchEvent[] = [];
  const commits: CommitRecord[] = [];
  let state = opened.genesis;

  state = commitEvents('opening', state, opened.openingEvents, events, onApply);
  commits.push({
    label: 'opening-deal-reveal-turn-start-draws',
    eventStart: 0,
    eventEnd: events.length,
    state,
  });

  input.intents.forEach((intent, intentIndex) => {
    beforeIntent?.(intentIndex, intent);
    const eventStart = events.length;
    const batch = resolve(
      state,
      intent,
      intentRng(input.matchSeed, intentIndex, intent.type),
      BOOTSTRAP_MANIFEST,
    );
    if (batch.length === 0 || batch[0].type === 'INTENT_REJECTED') {
      const reason = batch[0]?.type === 'INTENT_REJECTED' ? batch[0].reason : 'no events';
      throw new Error(`generated ${intent.type} intent ${intent.intentId} was not legal: ${reason}`);
    }
    state = commitEvents(`intent:${intent.intentId}`, state, batch, events, onApply);
    commits.push({
      label: `${intentIndex}:${intent.type}`,
      eventStart,
      eventEnd: events.length,
      state,
    });
  });

  if (state.phase !== 'ENDED' || state.result === null) {
    throw new Error(`execution did not complete the match (turn=${state.turn}, phase=${state.phase})`);
  }

  return { genesis: opened.genesis, finalState: state, events, commits };
}

function reproductionMessage(
  propertyName: string,
  caseRef: PropertyCaseRef,
  input: GeneratedMatchCase | null,
  error: unknown,
): string {
  const cause = error instanceof Error ? error.stack ?? error.message : String(error);
  const generated = input
    ? [
        `match seed: ${input.matchSeed}`,
        `P0 deck: ${input.decks.P0.map((entry) => entry.defId).join(',')}`,
        `P1 deck: ${input.decks.P1.map((entry) => entry.defId).join(',')}`,
        `intent count: ${input.intents.length}`,
      ].join('\n')
    : 'match generation failed before an input was returned';
  return [
    `${propertyName} failed for generated case ${caseRef.index}`,
    `suite seed: ${suiteSeed}`,
    `generator seed: ${caseRef.seed}`,
    generated,
    'Reproduce with:',
    `PLAYGAME_PROPERTY_CASE_SEED='${caseRef.seed}' npx vitest run ${PROPERTY_FILE}`,
    'Cause:',
    cause,
  ].join('\n');
}

function runProperty(
  propertyName: string,
  check: (input: GeneratedMatchCase) => void,
): void {
  for (const caseRef of propertyCases()) {
    let input: GeneratedMatchCase | null = null;
    try {
      input = generateMatchCase(caseRef.seed, BOOTSTRAP_MANIFEST);
      check(input);
    } catch (error) {
      throw new Error(reproductionMessage(propertyName, caseRef, input, error), { cause: error });
    }
  }
}

function eventsFromLog(state: MatchState): readonly MatchEvent[] {
  return state.log.map((entry) => entry.event as MatchEvent);
}

function applicationKey(application: EventApplication): string {
  return `${application.transactionId}:${application.eventIndex}`;
}

function assertStableApplicationsExactlyOnce(applications: readonly EventApplication[]): void {
  const counts = new Map<string, number>();
  for (const application of applications) {
    const key = applicationKey(application);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = [...counts].filter(([, count]) => count !== 1);
  if (duplicates.length > 0) {
    throw new Error(
      `stable transaction event applied more than once: ${duplicates
        .map(([key, count]) => `${key}=${count}`)
        .join(', ')}`,
    );
  }
}

function parityFields(state: MatchState): unknown {
  return {
    turn: state.turn,
    phase: state.phase,
    priority: state.priority,
    energy: state.energy,
    result: state.result,
  };
}

function sortedDefIds(cards: readonly { readonly defId: string }[]): string[] {
  return cards.map((card) => card.defId).sort();
}

function explicitCreationOwner(event: MatchEvent): Owner | null {
  switch (event.type) {
    case 'CARD_ADDED_TO_DECK':
    case 'CARD_ADDED_TO_HAND':
    case 'CARD_ADDED_TO_LANE':
      return event.owner;
    default:
      return null;
  }
}

function assertZoneReferences(state: MatchState): void {
  for (const owner of ['P0', 'P1'] as const) {
    for (const card of state.deck[owner]) {
      expect(state.cards[card.id]).toBeDefined();
      expect(state.cards[card.id].owner).toBe(owner);
      expect(state.cards[card.id].zone).toBe('DECK');
      expect(card.owner).toBe(owner);
      expect(card.zone).toBe('DECK');
    }
    for (const card of state.hand[owner]) {
      expect(state.cards[card.id]).toBeDefined();
      expect(state.cards[card.id].owner).toBe(owner);
      expect(state.cards[card.id].zone).toBe('HAND');
      expect(card.owner).toBe(owner);
      expect(card.zone).toBe('HAND');
    }
    for (const lane of state.lanes) {
      for (const cardId of lane.cards[owner]) {
        const card = state.cards[cardId];
        expect(card).toBeDefined();
        expect(card.owner).toBe(owner);
        expect(card.zone).toBe('LANE');
        expect(card.lane).toBe(lane.idx);
      }
    }
  }
}

function assertProvenance(input: GeneratedMatchCase, execution: ExecutionResult): void {
  expect(Object.isFrozen(input.decks)).toBe(true);
  for (const owner of ['P0', 'P1'] as const) {
    const deck = input.decks[owner];
    expect(Object.isFrozen(deck)).toBe(true);
    expect(deck.every((entry) => Object.isFrozen(entry))).toBe(true);
    assertManifestValidDeck(deck, BOOTSTRAP_MANIFEST);
    expect(sortedDefIds(execution.genesis.deck[owner])).toEqual(sortedDefIds(deck));
  }

  const initialIds: Record<Owner, Set<string>> = {
    P0: new Set(execution.genesis.deck.P0.map((card) => card.id)),
    P1: new Set(execution.genesis.deck.P1.map((card) => card.id)),
  };
  const explicitlyCreatedFor = new Map<string, Owner>();
  const replay = replayMatch({
    seed: input.matchSeed,
    manifest: BOOTSTRAP_MANIFEST,
    initialState: execution.genesis,
    framedEvents: execution.finalState.log.map(({ frame, scope, event }) => ({
      frame,
      scope,
      event: event as MatchEvent,
    })),
  });

  replay.steps.forEach((frame, frameIndex) => {
    if (frame.event) {
      const previous = replay.steps[frameIndex - 1].state;
      const owner = explicitCreationOwner(frame.event);
      if (owner && 'cardId' in frame.event && !previous.cards[frame.event.cardId]) {
        explicitlyCreatedFor.set(frame.event.cardId, owner);
      }
    }

    for (const card of Object.values(frame.state.cards)) {
      const fromSeatDeck = initialIds[card.owner].has(card.id);
      const createdForSeat = explicitlyCreatedFor.get(card.id) === card.owner;
      expect(
        fromSeatDeck || createdForSeat,
        `card ${card.id} (${card.defId}) for ${card.owner} at frame ${frame.frame} lacks provenance`,
      ).toBe(true);
      if (!fromSeatDeck) {
        expect(card.spawnSource.kind).not.toBe('DECK_CREATION');
      }
    }
    assertZoneReferences(frame.state);
  });
}

function executeWithEntropyGuards(
  input: GeneratedMatchCase,
  fixedWallClock: number,
): { readonly execution: ExecutionResult; readonly nowCalls: number; readonly randomCalls: number } {
  const now = vi.spyOn(Date, 'now').mockReturnValue(fixedWallClock);
  const random = vi.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Math.random reached authoritative match execution');
  });
  try {
    const execution = executeGeneratedMatch(input);
    return {
      execution,
      nowCalls: now.mock.calls.length,
      randomCalls: random.mock.calls.length,
    };
  } finally {
    random.mockRestore();
    now.mockRestore();
  }
}

function gameplayNamespaceProbe(seed: string, cosmeticForkOrder: readonly string[]): readonly number[] {
  const root = createRng(seed);
  for (const tag of cosmeticForkOrder) {
    const cosmetic = root.fork(`cosmetic:${tag}`);
    cosmetic.int(0, 0x7fffffff);
    cosmetic.int(0, 0x7fffffff);
  }
  const gameplay = root.fork('gameplay:probe');
  return [
    gameplay.int(0, 0x7fffffff),
    gameplay.int(0, 0x7fffffff),
    gameplay.int(0, 0x7fffffff),
  ];
}

function executeWithCosmeticNoise(
  input: GeneratedMatchCase,
  cosmeticForkOrder: readonly string[],
): ExecutionResult {
  const cosmeticRoot = createRng(`${input.matchSeed}:presentation`);
  return executeGeneratedMatch(input, undefined, (intentIndex) => {
    for (const tag of cosmeticForkOrder) {
      cosmeticRoot
        .fork(`${tag}:intent:${intentIndex}`)
        .int(0, 0x7fffffff);
    }
  });
}

describe('seeded engine properties', () => {
  test('P-PARITY: direct execution equals replay fold', { timeout: PROPERTY_TIMEOUT_MS }, () => {
    runProperty('P-PARITY', (input) => {
      const direct = executeGeneratedMatch(input);
      const replayed = replayMatch({
        seed: input.matchSeed,
        manifest: BOOTSTRAP_MANIFEST,
        initialState: direct.genesis,
        framedEvents: direct.finalState.log.map(({ frame, scope, event }) => ({
          frame,
          scope,
          event: event as MatchEvent,
        })),
      });

      expect(replayed.finalState).toEqual(direct.finalState);
      expect(eventsFromLog(replayed.finalState)).toEqual(direct.events);
      expect(replayed.finalState.log).toEqual(direct.finalState.log);
      expect(parityFields(replayed.finalState)).toEqual(parityFields(direct.finalState));
    });
  });

  test('P-EXACTLY-ONCE: each committed event index is reduced once', { timeout: PROPERTY_TIMEOUT_MS }, () => {
    runProperty('P-EXACTLY-ONCE', (input) => {
      const applications: EventApplication[] = [];
      const direct = executeGeneratedMatch(input, (application) => {
        applications.push(application);
      });
      const replayed = replayMatch({
        seed: input.matchSeed,
        manifest: BOOTSTRAP_MANIFEST,
        initialState: direct.genesis,
        framedEvents: direct.finalState.log.map(({ frame, scope, event }) => ({
          frame,
          scope,
          event: event as MatchEvent,
        })),
      });

      assertStableApplicationsExactlyOnce(applications);
      expect(applications).toHaveLength(direct.events.length);
      expect(applications.map((application) => application.globalIndex))
        .toEqual(direct.events.map((_, index) => index));
      expect(applications.map((application) => application.event)).toEqual(direct.events);

      // Prove the oracle is sensitive to the failure it claims to guard.
      // A retried transaction retains its transaction/event identity even if
      // it would otherwise be appended at fresh global log positions.
      expect(() => assertStableApplicationsExactlyOnce([
        ...applications,
        { ...applications[0], globalIndex: applications.length },
      ])).toThrow(/applied more than once/);

      expect(direct.finalState.log).toHaveLength(direct.events.length);
      expect(replayed.finalState).toEqual(direct.finalState);
    });
  });

  test('P-PROVENANCE: cards come from the seat deck or an explicit creation event', { timeout: PROPERTY_TIMEOUT_MS }, () => {
    runProperty('P-PROVENANCE', (input) => {
      assertProvenance(input, executeGeneratedMatch(input));
    });
  });

  test('P-FOLD: every commit state equals its replay log prefix', { timeout: PROPERTY_TIMEOUT_MS }, () => {
    runProperty('P-FOLD', (input) => {
      const direct = executeGeneratedMatch(input);
      const replayed = replayMatch({
        seed: input.matchSeed,
        manifest: BOOTSTRAP_MANIFEST,
        initialState: direct.genesis,
        framedEvents: direct.finalState.log.map(({ frame, scope, event }) => ({
          frame,
          scope,
          event: event as MatchEvent,
        })),
      });

      for (const commit of direct.commits) {
        expect(
          replayed.steps[commit.eventEnd].state,
          `commit ${commit.label} covering events [${commit.eventStart}, ${commit.eventEnd})`,
        ).toEqual(commit.state);
      }
    });
  });

  test('P-NO-TIME: wall clock and Math.random cannot affect resolution', { timeout: PROPERTY_TIMEOUT_MS }, () => {
    runProperty('P-NO-TIME', (input) => {
      const early = executeWithEntropyGuards(input, 1);
      const late = executeWithEntropyGuards(input, 4_102_444_800_000);
      const quiet = executeWithCosmeticNoise(input, []);
      const noisyForward = executeWithCosmeticNoise(input, ['card-glint', 'screen-shake', 'particle']);
      const noisyReverse = executeWithCosmeticNoise(input, ['particle', 'screen-shake', 'card-glint']);

      expect(early.nowCalls).toBe(0);
      expect(late.nowCalls).toBe(0);
      expect(early.randomCalls).toBe(0);
      expect(late.randomCalls).toBe(0);
      expect(early.execution.events).toEqual(late.execution.events);
      expect(early.execution.finalState).toEqual(late.execution.finalState);
      expect(noisyForward.events).toEqual(quiet.events);
      expect(noisyForward.finalState).toEqual(quiet.finalState);
      expect(noisyReverse.events).toEqual(quiet.events);
      expect(noisyReverse.finalState).toEqual(quiet.finalState);
      expect(gameplayNamespaceProbe(input.matchSeed, []))
        .toEqual(gameplayNamespaceProbe(input.matchSeed, ['card-glint', 'particle']));
      expect(gameplayNamespaceProbe(input.matchSeed, ['card-glint', 'particle']))
        .toEqual(gameplayNamespaceProbe(input.matchSeed, ['particle', 'card-glint']));
    });
  });
});

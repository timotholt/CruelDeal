import { describe, expect, it } from 'vitest';

import { createMatchGenesis, createSetupMatch } from '../cli/initState';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import { buildLocationSetupTransaction } from '../locationSetup';
import { frameAndFoldEvents } from '../transactionTimeline';
import {
  buildRuntimeFixture,
  orderedTestLocationDeck,
} from '../testkit/runtimeFixture';
import type { MatchState } from '../types/state';
import { KernelInvariantError } from './failure';
import { kernelStepFailure } from './kernel';
import {
  resolveRulesTransaction,
  type RulesCommand,
} from './rulesTransaction';

const manifest = BOOTSTRAP_MANIFEST;
const locationDeck = orderedTestLocationDeck(manifest);

function run(
  state: MatchState,
  commands: readonly RulesCommand[],
  budget?: Parameters<typeof resolveRulesTransaction>[2]['budget'],
) {
  return resolveRulesTransaction(state, commands, {
    manifest,
    baseDepth: 0,
    expandEffect: () => kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Match lifecycle tests do not execute authored effects.',
    }),
    ...(budget === undefined ? {} : { budget }),
  });
}

function openedState(seed = 'match-lifecycle-opened'): MatchState {
  return createSetupMatch(seed, manifest, {}, locationDeck).state;
}

describe('C5A-6 governed match lifecycle', () => {
  it('keeps location setup closed until the complete opening commits', () => {
    const genesis = createMatchGenesis('match-lifecycle-setup', manifest);
    const setup = buildLocationSetupTransaction(genesis, manifest, locationDeck);
    const located = frameAndFoldEvents({
      transactionId: setup.transactionId,
      initialState: genesis,
      events: setup.events,
      manifest,
      initialPhase: 'SETUP',
    }).finalState;

    expect(located.phase).toBe('SETUP');
    expect(() => run(located, [{
      type: 'COMPLETE_SETUP',
      authority: 'SYSTEM',
    }])).toThrow(KernelInvariantError);

    const opened = createSetupMatch(
      'match-lifecycle-complete',
      manifest,
      {},
      locationDeck,
    );
    expect(opened.opening.transitions.at(-1)?.event.type)
      .toBe('MATCH_SETUP_COMPLETED');
    expect(opened.state.phase).toBe('AWAITING_INTENT');
  });

  it('owns the exact phase graph and derives turn progression', () => {
    const initial = openedState();
    const begun = run(initial, [{
      type: 'BEGIN_RESOLUTION',
      authority: 'SYSTEM',
    }]);
    const ended = run(begun.state, [{
      type: 'END_TURN',
      authority: 'SYSTEM',
    }]);
    const started = run(ended.state, [{
      type: 'START_TURN',
      authority: 'SYSTEM',
      tiedPriority: 'P1',
    }]);

    expect(begun.events).toEqual([{
      type: 'TURN_RESOLUTION_STARTED',
      turn: 1,
    }]);
    expect(ended.events).toEqual([{ type: 'TURN_ENDED', turn: 1 }]);
    expect(started.events).toEqual([{
      type: 'TURN_STARTED',
      turn: 2,
      priority: 'P1',
      priorityReason: 'COIN_FLIP',
    }]);
    expect(started.state.phase).toBe('AWAITING_INTENT');
    expect(started.state.turn).toBe(2);
    expect(started.transitions[0].semantics).toMatchObject({
      transitionKind: 'TURN_OPENED',
      prior: { phase: 'BETWEEN_TURNS', turn: 1 },
      result: { phase: 'AWAITING_INTENT', turn: 2, priority: 'P1' },
    });
  });

  it('rejects stale, skipped, duplicate, and post-terminal boundaries', () => {
    const initial = openedState('match-lifecycle-invalid');
    expect(() => run(initial, [{
      type: 'END_TURN',
      authority: 'SYSTEM',
    }])).toThrow(KernelInvariantError);
    expect(() => run(initial, [{
      type: 'START_TURN',
      authority: 'SYSTEM',
      tiedPriority: 'P0',
    }])).toThrow(KernelInvariantError);

    const begun = run(initial, [{
      type: 'BEGIN_RESOLUTION',
      authority: 'SYSTEM',
    }]);
    expect(() => run(begun.state, [{
      type: 'BEGIN_RESOLUTION',
      authority: 'SYSTEM',
    }])).toThrow(KernelInvariantError);

    const conceded = run(initial, [{
      type: 'END_MATCH',
      authority: 'SYSTEM',
      reason: 'CONCESSION',
      concedingOwner: 'P0',
    }]);
    expect(conceded.state.phase).toBe('ENDED');
    expect(() => run(conceded.state, [{
      type: 'BEGIN_RESOLUTION',
      authority: 'SYSTEM',
    }])).toThrow(KernelInvariantError);
  });

  it('closes concession through the phase graph and computes truthful score fields', () => {
    const result = run(openedState('match-lifecycle-concede'), [{
      type: 'END_MATCH',
      authority: 'SYSTEM',
      reason: 'CONCESSION',
      concedingOwner: 'P0',
    }]);

    expect(result.events.map(event => event.type)).toEqual([
      'TURN_RESOLUTION_STARTED',
      'TURN_ENDED',
      'MATCH_ENDED',
    ]);
    expect(result.state.result).toEqual({
      winner: 'P1',
      lanesWon: { P0: 0, P1: 0 },
      totalPower: { P0: 0, P1: 0 },
    });
  });

  it('derives a final-score draw and rejects a premature final-score request', () => {
    const early = {
      ...openedState('match-lifecycle-early-score'),
      phase: 'BETWEEN_TURNS' as const,
    };
    expect(() => run(early, [{
      type: 'END_MATCH',
      authority: 'SYSTEM',
      reason: 'FINAL_SCORE',
    }])).toThrow(KernelInvariantError);

    const final = {
      ...early,
      turn: manifest.constants.turnLimit,
      maxEnergy: {
        P0: manifest.constants.turnLimit,
        P1: manifest.constants.turnLimit,
      },
    };
    const ended = run(final, [{
      type: 'END_MATCH',
      authority: 'SYSTEM',
      reason: 'FINAL_SCORE',
    }]);
    expect(ended.state.result).toEqual({
      winner: 'DRAW',
      lanesWon: { P0: 0, P1: 0 },
      totalPower: { P0: 0, P1: 0 },
    });
  });

  it('does not close the final turn before every delayed reveal resolves', () => {
    const state = buildRuntimeFixture({
      seed: 'match-lifecycle-delayed-final',
      localSeat: 'P0',
      turn: manifest.constants.turnLimit,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{
            id: 'delayed',
            defId: 'guard',
            revealed: false,
            revealTiming: { kind: 'END_OF_GAME' },
          }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
    }).state;

    expect(() => run(state, [{
      type: 'END_TURN',
      authority: 'SYSTEM',
    }])).toThrow(/final reveals/i);
    expect(state.phase).toBe('RESOLVING');
  });

  it('rejects an injected tie-breaker when board standing already owns priority', () => {
    const state = buildRuntimeFixture({
      seed: 'match-lifecycle-priority',
      localSeat: 'P0',
      turn: 1,
      phase: 'BETWEEN_TURNS',
      priority: 'P1',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{ id: 'leader', defId: 'guard', revealed: true }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
    }).state;

    expect(() => run(state, [{
      type: 'START_TURN',
      authority: 'SYSTEM',
      tiedPriority: 'P1',
    }])).toThrow(/rejects a tie-breaker/i);
    const started = run(state, [{
      type: 'START_TURN',
      authority: 'SYSTEM',
      tiedPriority: null,
    }]);
    expect(started.events).toEqual([{
      type: 'TURN_STARTED',
      turn: 2,
      priority: 'P0',
      priorityReason: 'MORE_LANES',
    }]);
  });

  it('publishes no prefix when a late boundary exceeds the shared budget', () => {
    const initial = openedState('match-lifecycle-rollback');
    const snapshot = structuredClone(initial);
    expect(() => run(initial, [{
      type: 'END_MATCH',
      authority: 'SYSTEM',
      reason: 'CONCESSION',
      concedingOwner: 'P0',
    }], {
      maxWorkItems: 20,
      maxEvents: 2,
      maxReactions: 20,
      maxEffectDepth: 10,
      maxCreatedEntities: 10,
    })).toThrow(KernelInvariantError);
    expect(initial).toEqual(snapshot);
  });
});

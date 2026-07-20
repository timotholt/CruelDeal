import { describe, expect, it } from 'vitest';

import { executeRulesCommands } from '../effects/rulesInterpreter';
import type { Manifest } from '../manifest/types';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { CardId } from '../types/ids';
import type { EnergyReason, MatchState } from '../types/state';
import type { ResolutionBudget } from './contracts';
import { KernelInvariantError } from './failure';
import type { ChangeEnergyCommand } from './types';

const CAUSE: EffectRef = {
  sourceId: 'kernel-energy-source' as CardId,
  effectKind: 'SYSTEM',
  reason: 'KERNEL_ENERGY_TEST',
};

function fixture() {
  const manifest = testManifest([]);
  const state = buildRuntimeFixture({
    seed: 'kernel-energy-transaction',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [], P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
    energy: { P0: 3, P1: 2 },
    maxEnergy: { P0: 4, P1: 4 },
    nextTurnEnergyBonus: { P0: 1, P1: 0 },
  }).state;
  return { manifest, state };
}

function command(
  target: ChangeEnergyCommand['target'],
  delta: number,
  options: {
    readonly cause?: EffectRef;
    readonly reason?: EnergyReason;
    readonly owner?: ChangeEnergyCommand['owner'];
  } = {},
): ChangeEnergyCommand {
  return {
    type: 'CHANGE_ENERGY',
    target,
    owner: options.owner ?? 'P0',
    delta,
    reason: options.reason ?? 'EFFECT',
    cause: options.cause ?? CAUSE,
  };
}

function run(
  state: MatchState,
  manifest: Manifest,
  commands: readonly ChangeEnergyCommand[],
  budget?: ResolutionBudget,
) {
  return executeRulesCommands(
    state,
    commands,
    {
      rng: createRng('energy-transaction-test'),
      ...(budget === undefined ? {} : { budget }),
    },
    manifest,
  );
}

describe('energy kernel transaction', () => {
  it('commits all three Energy resources in command order with closed semantics', () => {
    const { manifest, state } = fixture();
    const result = run(state, manifest, [
      command('CURRENT', -2, { reason: 'CARD_PLAYED' }),
      command('MAXIMUM', 1, { reason: 'TURN_START', owner: 'P1' }),
      command('NEXT_TURN_BONUS', 2),
    ]);

    expect(result.events).toEqual([
      {
        type: 'ENERGY_CHANGED',
        owner: 'P0',
        delta: -2,
        reason: 'CARD_PLAYED',
        cause: CAUSE,
      },
      {
        type: 'MAX_ENERGY_CHANGED',
        owner: 'P1',
        delta: 1,
        reason: 'TURN_START',
        cause: CAUSE,
      },
      {
        type: 'NEXT_TURN_ENERGY_BONUS_CHANGED',
        owner: 'P0',
        delta: 2,
        reason: 'EFFECT',
        cause: CAUSE,
      },
    ]);
    expect(result.state.energy).toEqual({ P0: 1, P1: 2 });
    expect(result.state.maxEnergy).toEqual({ P0: 4, P1: 5 });
    expect(result.state.nextTurnEnergyBonus).toEqual({ P0: 3, P1: 0 });
    expect(result.transitions.map(({ semantics }) => semantics))
      .toMatchObject([
        {
          eventType: 'ENERGY_CHANGED',
          transitionKind: 'CURRENT_ENERGY_DECREASE',
          affectedOwner: 'P0',
          target: 'CURRENT',
          reason: 'CARD_PLAYED',
          signedChange: -2,
          prior: { current: 3, maximum: 4, nextTurnBonus: 1 },
          result: { current: 1, maximum: 4, nextTurnBonus: 1 },
        },
        {
          eventType: 'MAX_ENERGY_CHANGED',
          transitionKind: 'MAXIMUM_ENERGY_INCREASE',
          affectedOwner: 'P1',
          target: 'MAXIMUM',
          signedChange: 1,
          prior: { current: 2, maximum: 4, nextTurnBonus: 0 },
          result: { current: 2, maximum: 5, nextTurnBonus: 0 },
        },
        {
          eventType: 'NEXT_TURN_ENERGY_BONUS_CHANGED',
          transitionKind: 'NEXT_TURN_BONUS_INCREASE',
          affectedOwner: 'P0',
          target: 'NEXT_TURN_BONUS',
          signedChange: 2,
          prior: { current: 1, maximum: 4, nextTurnBonus: 1 },
          result: { current: 1, maximum: 4, nextTurnBonus: 3 },
        },
      ]);
    expect(result.transitions.every(
      ({ semantics }) => semantics.cause.reason === 'KERNEL_ENERGY_TEST',
    )).toBe(true);
  });

  it('treats zero changes as exact no-ops for every target', () => {
    const { manifest, state } = fixture();
    for (const target of [
      'CURRENT',
      'MAXIMUM',
      'NEXT_TURN_BONUS',
    ] as const) {
      const result = run(state, manifest, [command(target, 0)]);
      expect(result.events).toEqual([]);
      expect(result.state).toBe(state);
    }
  });

  it('records an exact zero-cost current-Energy card payment', () => {
    const { manifest, state } = fixture();
    const result = run(state, manifest, [
      command('CURRENT', 0, { reason: 'CARD_PLAYED' }),
    ]);

    expect(result.events).toEqual([{
      type: 'ENERGY_CHANGED',
      owner: 'P0',
      delta: 0,
      reason: 'CARD_PLAYED',
      cause: CAUSE,
    }]);
    expect(result.state.energy).toEqual(state.energy);
    expect(result.transitions[0]?.semantics).toMatchObject({
      transitionKind: 'CURRENT_ENERGY_PAYMENT_RECORDED',
      signedChange: 0,
    });
  });

  it('rejects invalid provenance, reason, owner, and numeric values', () => {
    const { manifest, state } = fixture();
    const invalid = [
      command('CURRENT', 1, {
        cause: { ...CAUSE, sourceId: '' as CardId },
      }),
      command('CURRENT', 1, {
        cause: { ...CAUSE, reason: '' },
      }),
      {
        ...command('CURRENT', 1),
        reason: 'UNKNOWN',
      } as unknown as ChangeEnergyCommand,
      {
        ...command('CURRENT', 1),
        target: 'UNKNOWN',
      } as unknown as ChangeEnergyCommand,
      {
        ...command('CURRENT', 1),
        owner: 'P2',
      } as unknown as ChangeEnergyCommand,
      command('MAXIMUM', Number.NaN),
      command('NEXT_TURN_BONUS', Number.POSITIVE_INFINITY),
      command('CURRENT', 0.5),
      command('CURRENT', Number.MAX_SAFE_INTEGER + 1),
    ];

    for (const candidate of invalid) {
      expect(() => run(state, manifest, [candidate]))
        .toThrow(KernelInvariantError);
      expect(state.energy).toEqual({ P0: 3, P1: 2 });
      expect(state.maxEnergy).toEqual({ P0: 4, P1: 4 });
      expect(state.nextTurnEnergyBonus).toEqual({ P0: 1, P1: 0 });
    }
  });

  it('rejects a safe delta when it would overflow Energy state', () => {
    const { manifest, state } = fixture();
    const saturated = {
      ...state,
      energy: {
        ...state.energy,
        P0: Number.MAX_SAFE_INTEGER,
      },
    };
    expect(() => run(
      saturated,
      manifest,
      [command('CURRENT', 1)],
    )).toThrow(KernelInvariantError);
    expect(saturated.energy.P0).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('publishes no partial candidate when a later Energy command fails', () => {
    const { manifest, state } = fixture();
    let thrown: unknown;
    try {
      run(state, manifest, [
        command('CURRENT', -1),
        command('MAXIMUM', Number.NaN),
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(KernelInvariantError);
    expect(thrown).toMatchObject({
      failure: {
        code: 'INVALID_OPERATION_OUTPUT',
        eventsProduced: 1,
      },
    });
    expect(state.energy.P0).toBe(3);
    expect(state.maxEnergy.P0).toBe(4);
  });

  it('enforces the work budget without exposing its private candidate', () => {
    const { manifest, state } = fixture();
    expect(() => run(
      state,
      manifest,
      [command('NEXT_TURN_BONUS', 1)],
      {
        maxWorkItems: 1,
        maxEvents: 10,
        maxReactions: 10,
        maxEffectDepth: 10,
        maxCreatedEntities: 10,
      },
    )).toThrow(KernelInvariantError);
    expect(state.nextTurnEnergyBonus.P0).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import type { CardDef, LocationCardDef } from '../manifest/types';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
  type RuntimeCardSpec,
} from '../testkit/runtimeFixture';
import type { CardId } from '../types/ids';
import type { PowerMutation } from '../types/state';
import {
  getCardPower,
  getCardPowerAfterStoredMutation,
} from './power';

const CARD_ID = 'subject' as CardId;
const SELF = { kind: 'SELF' } as const;

function courthouseDef(): LocationCardDef {
  return {
    ...testLocationDef('courthouse'),
    abilities: {
      ongoing: [{
        kind: 'BLOCK_POWER_INCREASE',
        target: {
          kind: 'SAME_LANE',
          of: SELF,
          ownerFilter: 'ANY_OWNER',
        },
        stack: 'SINGLE',
      }],
    },
  };
}

function globalBoosterDef(): CardDef {
  return {
    ...testCardDef('global-booster', { power: 1 }),
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'ALL_CARDS',
          ownerFilter: 'SELF_OWNER',
          zoneFilter: 'LANE',
        },
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
  };
}

function fixture(
  subject: RuntimeCardSpec,
  options: {
    readonly courthouse?: boolean;
    readonly booster?: boolean;
  } = {},
) {
  const booster = options.booster ? globalBoosterDef() : null;
  const manifest = testManifest(
    [testCardDef('subject', { power: 3 }), ...(booster ? [booster] : [])],
    options.courthouse ? [courthouseDef()] : [],
  );
  const state = buildRuntimeFixture({
    seed: 'power-mutation-projection',
    localSeat: 'P0',
    turn: 3,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [subject], P1: [] },
      { P0: booster ? [{ id: 'global-booster', defId: booster.defId, revealed: true }] : [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [
      options.courthouse
        ? { id: 'courthouse@0', defId: 'courthouse', revealed: true }
        : null,
      null,
      null,
    ],
  }).state;
  return { manifest, state };
}

function project(mutation: PowerMutation): number {
  const { manifest, state } = fixture({
    id: CARD_ID,
    defId: 'subject',
    revealed: true,
    powerMutations: [{ kind: 'ADD', delta: 1 }],
  });
  const result = getCardPowerAfterStoredMutation(state, CARD_ID, mutation, manifest);
  expect(getCardPower(state, CARD_ID, manifest)).toBe(4);
  return result;
}

describe('getCardPowerAfterStoredMutation', () => {
  it('projects ADD, SET, and RESET using ledger replacement semantics', () => {
    expect(project({ kind: 'ADD', delta: 2 })).toBe(6);
    expect(project({ kind: 'SET', value: 7 })).toBe(7);
    expect(project({ kind: 'RESET' })).toBe(3);
  });

  it('includes live ongoing modifiers without storing them in the ledger', () => {
    const { manifest, state } = fixture({
      id: CARD_ID,
      defId: 'subject',
      revealed: true,
    }, { booster: true });

    expect(getCardPower(state, CARD_ID, manifest)).toBe(5);
    expect(getCardPowerAfterStoredMutation(
      state,
      CARD_ID,
      { kind: 'SET', value: 4 },
      manifest,
    )).toBe(6);
  });

  it('suppresses each positive stored contribution at Courthouse', () => {
    const { manifest, state } = fixture({
      id: CARD_ID,
      defId: 'subject',
      revealed: true,
      powerMutations: [
        { kind: 'ADD', delta: 4 },
        { kind: 'ADD', delta: -2 },
      ],
    }, { courthouse: true });

    expect(getCardPower(state, CARD_ID, manifest)).toBe(1);
    expect(getCardPowerAfterStoredMutation(
      state,
      CARD_ID,
      { kind: 'ADD', delta: 5 },
      manifest,
    )).toBe(1);
    expect(getCardPowerAfterStoredMutation(
      state,
      CARD_ID,
      { kind: 'ADD', delta: -1 },
      manifest,
    )).toBe(0);
    expect(getCardPowerAfterStoredMutation(
      state,
      CARD_ID,
      { kind: 'SET', value: 5 },
      manifest,
    )).toBe(3);
    expect(getCardPowerAfterStoredMutation(
      state,
      CARD_ID,
      { kind: 'RESET' },
      manifest,
    )).toBe(3);
  });

  it('applies SHURI_DOUBLED after the projected stored contribution', () => {
    const { manifest, state } = fixture({
      id: CARD_ID,
      defId: 'subject',
      revealed: true,
      tags: [{ kind: 'SHURI_DOUBLED' }],
    });

    expect(getCardPower(state, CARD_ID, manifest)).toBe(6);
    expect(getCardPowerAfterStoredMutation(
      state,
      CARD_ID,
      { kind: 'ADD', delta: 2 },
      manifest,
    )).toBe(10);
  });
});

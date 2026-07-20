import { describe, expect, it } from 'vitest';
import { executeHandCommands } from '../effects/evaluator';
import type { CardDef, Manifest } from '../manifest/types';
import { getCardState } from '../projections/cardRuntime';
import { getStoredCardPowerDelta } from '../powerLedger';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectExpr, EffectRef, OngoingExpr } from '../types/ability';
import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';
import { KernelInvariantError } from './failure';
import { resolveHandTransaction } from './handTransaction';

const CAUSE: EffectRef = {
  sourceId: 'hand-test-source' as CardId,
  effectKind: 'SYSTEM',
  reason: 'HAND_TRANSACTION_TEST',
};

function cardWithAbilities(
  defId: string,
  abilities: CardDef['abilities'],
  power = 1,
): CardDef {
  return {
    ...testCardDef(defId, { power }),
    abilities,
  };
}

function fixture(
  manifest: Manifest,
  options: {
    readonly deckP0?: readonly string[];
    readonly deckP1?: readonly string[];
    readonly handP0?: readonly string[];
    readonly handP1?: readonly string[];
    readonly lanes?: readonly [
      {
        readonly P0: readonly { id: string; defId: string }[];
        readonly P1: readonly { id: string; defId: string }[];
      },
      {
        readonly P0: readonly { id: string; defId: string }[];
        readonly P1: readonly { id: string; defId: string }[];
      },
      {
        readonly P0: readonly { id: string; defId: string }[];
        readonly P1: readonly { id: string; defId: string }[];
      },
    ];
  } = {},
): MatchState {
  const definitionFor = (id: string) => {
    const defId = id.includes(':') ? id.split(':')[0]! : id;
    return { id, defId };
  };
  const lanes = options.lanes ?? [
    { P0: [], P1: [] },
    { P0: [], P1: [] },
    { P0: [], P1: [] },
  ] as const;
  const revealLane = (lane: (typeof lanes)[number]) => ({
    P0: lane.P0.map(card => ({ ...card, revealed: true })),
    P1: lane.P1.map(card => ({ ...card, revealed: true })),
  });
  return buildRuntimeFixture({
    seed: 'hand-transaction-test',
    localSeat: 'P0',
    turn: 3,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: {
      P0: (options.deckP0 ?? []).map(definitionFor),
      P1: (options.deckP1 ?? []).map(definitionFor),
    },
    hands: {
      P0: (options.handP0 ?? []).map(definitionFor),
      P1: (options.handP1 ?? []).map(definitionFor),
    },
    lanes: [
      revealLane(lanes[0]),
      revealLane(lanes[1]),
      revealLane(lanes[2]),
    ],
    locations: [null, null, null],
  }).state;
}

function execute(
  state: MatchState,
  manifest: Manifest,
  commands: Parameters<typeof executeHandCommands>[1],
) {
  return executeHandCommands(
    state,
    commands,
    { rng: createRng('hand-transaction-test') },
    manifest,
  );
}

describe('hand kernel transaction', () => {
  it('draws the canonical top card or an explicitly selected deck card', () => {
    const manifest = testManifest([
      testCardDef('first'),
      testCardDef('second'),
      testCardDef('third'),
    ]);
    const state = fixture(manifest, {
      deckP0: ['first:1', 'second:1', 'third:1'],
    });

    const top = execute(state, manifest, [{
      type: 'DRAW_CARD',
      owner: 'P0',
      selection: { kind: 'TOP' },
      cause: CAUSE,
    }]);
    expect(top.events).toMatchObject([{
      type: 'CARD_DRAWN',
      cardId: 'first:1',
      owner: 'P0',
      cause: CAUSE,
    }]);
    expect(top.state.hand.P0).toEqual(['first:1']);
    expect(top.state.deck.P0).toEqual(['second:1', 'third:1']);

    const exact = execute(top.state, manifest, [{
      type: 'DRAW_CARD',
      owner: 'P0',
      selection: {
        kind: 'CARD',
        cardId: 'third:1' as CardId,
      },
      cause: CAUSE,
    }]);
    expect(exact.events[0]).toMatchObject({
      type: 'CARD_DRAWN',
      cardId: 'third:1',
    });
    expect(exact.state.hand.P0).toEqual(['first:1', 'third:1']);
    expect(exact.state.deck.P0).toEqual(['second:1']);
  });

  it('treats empty decks, foreign selections, and full hands as no-ops', () => {
    const manifest = testManifest(
      [testCardDef('card')],
      [],
      { handCap: 2 },
    );
    const empty = fixture(manifest);
    const emptyResult = execute(empty, manifest, [{
      type: 'DRAW_CARD',
      owner: 'P0',
      selection: { kind: 'TOP' },
      cause: CAUSE,
    }]);
    expect(emptyResult.events).toEqual([]);
    expect(emptyResult.state).toBe(empty);

    const foreign = fixture(manifest, {
      deckP1: ['card:foreign'],
    });
    const foreignResult = execute(foreign, manifest, [{
      type: 'DRAW_CARD',
      owner: 'P0',
      selection: {
        kind: 'CARD',
        cardId: 'card:foreign' as CardId,
      },
      cause: CAUSE,
    }]);
    expect(foreignResult.events).toEqual([]);
    expect(foreignResult.state).toBe(foreign);

    const full = fixture(manifest, {
      deckP0: ['card:deck'],
      handP0: ['card:hand-1', 'card:hand-2'],
    });
    const fullResult = execute(full, manifest, [{
      type: 'DRAW_CARD',
      owner: 'P0',
      selection: { kind: 'TOP' },
      cause: CAUSE,
    }]);
    expect(fullResult.events).toEqual([]);
    expect(fullResult.state).toBe(full);
  });

  it('only discards cards currently in hand', () => {
    const manifest = testManifest([testCardDef('card')]);
    const state = fixture(manifest, {
      deckP0: ['card:deck'],
      handP0: ['card:hand'],
    });
    const rejected = execute(state, manifest, [{
      type: 'DISCARD_CARD',
      cardId: 'card:deck' as CardId,
      reason: 'FORCED_EFFECT',
      cause: CAUSE,
    }]);
    expect(rejected.events).toEqual([]);
    expect(rejected.state).toBe(state);

    const discarded = execute(state, manifest, [{
      type: 'DISCARD_CARD',
      cardId: 'card:hand' as CardId,
      reason: 'FORCED_EFFECT',
      cause: CAUSE,
    }]);
    expect(discarded.events[0]).toMatchObject({
      type: 'CARD_DISCARDED',
      cardId: 'card:hand',
      reason: 'FORCED_EFFECT',
      cause: CAUSE,
    });
    expect(discarded.state.hand.P0).toEqual([]);
    expect(getCardState(discarded.state, 'card:hand' as CardId)?.zone)
      .toBe('DISCARD');
  });

  it('freezes and executes each discarded card rule exactly once', () => {
    const draw: EffectExpr = {
      kind: 'DRAW',
      owner: 'SELF_OWNER',
      count: { kind: 'LIT', n: 1 },
    };
    const manifest = testManifest([
      cardWithAbilities('discarder', { onDiscarded: [draw, draw] }),
      testCardDef('drawn'),
    ]);
    const state = fixture(manifest, {
      deckP0: ['drawn:1', 'drawn:2'],
      handP0: ['discarder:1'],
    });
    const result = execute(state, manifest, [{
      type: 'DISCARD_CARD',
      cardId: 'discarder:1' as CardId,
      reason: 'FORCED_EFFECT',
      cause: CAUSE,
    }]);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_DISCARDED',
      'CARD_DRAWN',
      'CARD_DRAWN',
    ]);
    expect(result.state.hand.P0).toEqual(['drawn:1', 'drawn:2']);
    expect(result.state.deck.P0).toEqual([]);
  });

  it('orders and applies every active hand-entry policy', () => {
    const handRule = {
      kind: 'HAND_ENTRY_POWER_ADD',
      ownerFilter: 'OPP_OWNER',
      delta: { kind: 'LIT', n: -1 },
      stack: 'ADDITIVE',
    } as const satisfies OngoingExpr;
    const manifest = testManifest([
      testCardDef('drawn', { power: 5 }),
      cardWithAbilities('watcher', { ongoing: [handRule] }),
    ]);
    const state = fixture(manifest, {
      deckP0: ['drawn:1'],
      lanes: [
        { P0: [], P1: [{ id: 'watcher:1', defId: 'watcher' }] },
        { P0: [], P1: [{ id: 'watcher:2', defId: 'watcher' }] },
        { P0: [], P1: [] },
      ],
    });
    const result = execute(state, manifest, [{
      type: 'DRAW_CARD',
      owner: 'P0',
      selection: { kind: 'TOP' },
      cause: CAUSE,
    }]);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_DRAWN',
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
    ]);
    expect(result.events.slice(1).map(event =>
      event.type === 'CARD_POWER_CHANGED'
        ? event.cause.sourceId
        : null,
    )).toEqual(['watcher:1', 'watcher:2']);
    expect(getStoredCardPowerDelta(
      result.state,
      'drawn:1' as CardId,
      manifest,
    )).toBe(-2);
  });

  it('publishes no candidate state when its work budget is exhausted', () => {
    const manifest = testManifest([testCardDef('drawn')]);
    const state = fixture(manifest, { deckP0: ['drawn:1'] });

    let thrown: unknown;
    try {
      resolveHandTransaction(state, [{
        type: 'DRAW_CARD',
        owner: 'P0',
        selection: { kind: 'TOP' },
        cause: CAUSE,
      }], {
        manifest,
        baseDepth: 0,
        interpretEffect: candidate => ({ state: candidate, events: [] }),
        budget: {
          maxWorkItems: 1,
          maxEvents: 10,
          maxReactions: 10,
          maxEffectDepth: 10,
          maxCreatedEntities: 10,
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(KernelInvariantError);
    expect(thrown).toMatchObject({
      failure: {
        code: 'BUDGET_EXCEEDED',
        eventsProduced: 0,
      },
    });
    expect(state.deck.P0).toEqual(['drawn:1']);
    expect(state.hand.P0).toEqual([]);
  });
});

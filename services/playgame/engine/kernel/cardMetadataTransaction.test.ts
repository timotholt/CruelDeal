import { describe, expect, it } from 'vitest';

import { apply } from '../apply';
import { executeRulesCommands } from '../effects/rulesInterpreter';
import type { EffectCtx } from '../effects/rulesInterpreter';
import { executeEffectForTest } from '../testkit/rulesExecution';
import type { CardDef, Manifest } from '../manifest/types';
import { getCardState, getCardRuntime } from '../projections/cardRuntime';
import { evalPredicate } from '../projections/select';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectRef, TextOverride } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId } from '../types/ids';
import type { CardTag, MatchState } from '../types/state';
import { KernelInvariantError } from './failure';
import type { ResolutionBudget } from './contracts';
import type { CardMetadataCommand } from './cardMetadataTransaction';

const CARD_ID = 'kernel-metadata-card' as CardId;
const CAUSE: EffectRef = {
  sourceId: 'kernel-metadata-source' as CardId,
  effectKind: 'SYSTEM',
  reason: 'KERNEL_METADATA_TEST',
};

function fixture(tags: readonly CardTag[] = []) {
  const definition = testCardDef('kernel-metadata-def');
  const manifest = testManifest([definition]);
  const state = buildRuntimeFixture({
    seed: 'kernel-metadata-transaction',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      {
        P0: [{
          id: CARD_ID,
          defId: definition.defId,
          revealed: true,
          tags,
        }],
        P1: [],
      },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
  return { manifest, state };
}

function run(
  state: MatchState,
  manifest: Manifest,
  commands: readonly CardMetadataCommand[],
  budget?: ResolutionBudget,
) {
  return executeRulesCommands(
    state,
    commands,
    {
      rng: createRng('card-metadata-transaction-test'),
      ...(budget === undefined ? {} : { budget }),
    },
    manifest,
  );
}

describe('card metadata kernel transaction', () => {
  it('adds exact tag payloads, ignores exact duplicates, and removes by kind', () => {
    const { manifest, state } = fixture();
    const firstSource = 'disabler-one' as CardId;
    const secondSource = 'disabler-two' as CardId;
    const result = run(state, manifest, [
      {
        type: 'CHANGE_CARD_TAG',
        cardId: CARD_ID,
        mutation: {
          kind: 'ADD',
          tag: { kind: 'ONGOING_DISABLED', sourceId: firstSource },
        },
        cause: CAUSE,
      },
      {
        type: 'CHANGE_CARD_TAG',
        cardId: CARD_ID,
        mutation: {
          kind: 'ADD',
          tag: { kind: 'ONGOING_DISABLED', sourceId: firstSource },
        },
        cause: CAUSE,
      },
      {
        type: 'CHANGE_CARD_TAG',
        cardId: CARD_ID,
        mutation: {
          kind: 'ADD',
          tag: { kind: 'ONGOING_DISABLED', sourceId: secondSource },
        },
        cause: CAUSE,
      },
    ]);

    expect(result.events).toHaveLength(2);
    expect(getCardState(result.state, CARD_ID)?.tags).toEqual([
      { kind: 'ONGOING_DISABLED', sourceId: firstSource },
      { kind: 'ONGOING_DISABLED', sourceId: secondSource },
    ]);
    expect(result.transitions.map(transition => transition.semantics))
      .toMatchObject([
        {
          transitionKind: 'TAG_ADDED',
          priorPresent: false,
          resultPresent: true,
          reason: 'KERNEL_METADATA_TEST',
        },
        {
          transitionKind: 'TAG_ADDED',
          priorPresent: false,
          resultPresent: true,
          reason: 'KERNEL_METADATA_TEST',
        },
      ]);

    const removed = run(result.state, manifest, [{
      type: 'CHANGE_CARD_TAG',
      cardId: CARD_ID,
      mutation: { kind: 'REMOVE', tag: 'ONGOING_DISABLED' },
      cause: CAUSE,
    }]);
    expect(removed.events).toHaveLength(1);
    expect(getCardState(removed.state, CARD_ID)?.tags).toEqual([]);

    const noOp = run(removed.state, manifest, [{
      type: 'CHANGE_CARD_TAG',
      cardId: CARD_ID,
      mutation: { kind: 'REMOVE', tag: 'ONGOING_DISABLED' },
      cause: CAUSE,
    }]);
    expect(noOp.events).toEqual([]);
    expect(noOp.state).toBe(removed.state);
  });

  it('folds sequential counter commands against private candidate state', () => {
    const { manifest, state } = fixture();
    const result = run(state, manifest, [
      {
        type: 'CHANGE_CARD_COUNTER',
        cardId: CARD_ID,
        name: 'charges',
        delta: 3,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_CARD_COUNTER',
        cardId: CARD_ID,
        name: 'charges',
        delta: -1,
        cause: CAUSE,
      },
    ]);

    expect(getCardState(result.state, CARD_ID)?.counters.charges).toBe(2);
    expect(result.transitions.map(transition => transition.semantics))
      .toMatchObject([
        {
          transitionKind: 'COUNTER_INCREASE',
          priorValue: 0,
          resultValue: 3,
          signedChange: 3,
        },
        {
          transitionKind: 'COUNTER_DECREASE',
          priorValue: 3,
          resultValue: 2,
          signedChange: -1,
        },
      ]);
  });

  it('publishes no partial counter state when a later command overflows', () => {
    const { manifest, state } = fixture();
    expect(() => run(state, manifest, [
      {
        type: 'CHANGE_CARD_COUNTER',
        cardId: CARD_ID,
        name: 'charges',
        delta: 1,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_CARD_COUNTER',
        cardId: CARD_ID,
        name: 'charges',
        delta: Number.MAX_SAFE_INTEGER,
        cause: CAUSE,
      },
    ])).toThrow(KernelInvariantError);
    expect(getCardState(state, CARD_ID)?.counters).toEqual({});
  });

  it('makes zero counters, identical text, and missing cards exact no-ops', () => {
    const { manifest, state } = fixture();
    const override = {
      kind: 'BLANKED_TEXT' as const,
      abilities: {},
      rulesText: '',
      copiedFrom: null,
    };
    const set = run(state, manifest, [{
      type: 'OVERRIDE_CARD_TEXT',
      cardId: CARD_ID,
      override,
      cause: CAUSE,
    }]);
    const result = run(set.state, manifest, [
      {
        type: 'CHANGE_CARD_COUNTER',
        cardId: CARD_ID,
        name: 'charges',
        delta: 0,
        cause: CAUSE,
      },
      {
        type: 'OVERRIDE_CARD_TEXT',
        cardId: CARD_ID,
        override,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_CARD_TAG',
        cardId: 'missing-card' as CardId,
        mutation: { kind: 'ADD', tag: { kind: 'DESTROY_IMMUNE' } },
        cause: CAUSE,
      },
    ]);
    expect(result.events).toEqual([]);
    expect(result.state).toBe(set.state);
  });

  it('enforces work budget without exposing private candidate state', () => {
    const { manifest, state } = fixture();
    expect(() => run(
      state,
      manifest,
      [{
        type: 'CHANGE_CARD_TAG',
        cardId: CARD_ID,
        mutation: { kind: 'ADD', tag: { kind: 'DESTROY_IMMUNE' } },
        cause: CAUSE,
      }],
      {
        maxWorkItems: 1,
        maxEvents: 10,
        maxReactions: 10,
        maxEffectDepth: 10,
        maxCreatedEntities: 10,
      },
    )).toThrow(KernelInvariantError);
    expect(getCardState(state, CARD_ID)?.tags).toEqual([]);
  });

  it('sets and clears immutable text snapshots', () => {
    const { manifest, state } = fixture();
    const override: TextOverride = {
      kind: 'COPIED_TEXT',
      sourceCardId: 'copy-source' as CardId,
      sourceDefId: 'copied-definition',
      scope: 'ON_REVEAL',
      abilities: {
        onReveal: [{
          kind: 'ADD_POWER',
          target: { kind: 'SELF' },
          delta: { kind: 'LIT', n: 2 },
        }],
      },
      rulesText: 'Gain 2 Power.',
    };
    const result = run(state, manifest, [{
      type: 'OVERRIDE_CARD_TEXT',
      cardId: CARD_ID,
      override,
      cause: CAUSE,
    }]);
    (override.abilities.onReveal as { kind: string }[])[0]!.kind = 'BROKEN';
    override.rulesText = 'mutated';

    expect(result.events[0]).toMatchObject({
      type: 'CARD_TEXT_OVERRIDDEN',
      override: { rulesText: 'Gain 2 Power.' },
      cause: CAUSE,
    });
    expect(getCardState(result.state, CARD_ID)?.textOverride)
      .toMatchObject({ rulesText: 'Gain 2 Power.' });
    expect(result.transitions[0]?.semantics).toMatchObject({
      transitionKind: 'TEXT_SET',
      prior: null,
      result: { rulesText: 'Gain 2 Power.' },
    });

    const reorderedOverride: TextOverride = {
      rulesText: 'Gain 2 Power.',
      abilities: {
        onReveal: [{
          delta: { n: 2, kind: 'LIT' },
          target: { kind: 'SELF' },
          kind: 'ADD_POWER',
        }],
      },
      scope: 'ON_REVEAL',
      sourceDefId: 'copied-definition',
      sourceCardId: 'copy-source' as CardId,
      kind: 'COPIED_TEXT',
    };
    const semanticNoOp = run(result.state, manifest, [{
      type: 'OVERRIDE_CARD_TEXT',
      cardId: CARD_ID,
      override: reorderedOverride,
      cause: CAUSE,
    }]);
    expect(semanticNoOp.events).toEqual([]);
    expect(semanticNoOp.state).toBe(result.state);

    const cleared = run(result.state, manifest, [{
      type: 'OVERRIDE_CARD_TEXT',
      cardId: CARD_ID,
      override: null,
      cause: CAUSE,
    }]);
    expect(getCardState(cleared.state, CARD_ID)?.textOverride).toBeNull();
    expect(cleared.transitions[0]?.semantics)
      .toMatchObject({ transitionKind: 'TEXT_CLEARED', result: null });
  });

  it('rejects invalid provenance and unsafe counter commands', () => {
    const { manifest, state } = fixture();
    const invalid: CardMetadataCommand[] = [
      {
        type: 'CHANGE_CARD_TAG',
        cardId: CARD_ID,
        mutation: { kind: 'ADD', tag: { kind: 'DESTROY_IMMUNE' } },
        cause: { ...CAUSE, sourceId: '' as CardId },
      },
      {
        type: 'OVERRIDE_CARD_TEXT',
        cardId: CARD_ID,
        override: {
          kind: 'BLANKED_TEXT',
          abilities: {},
          rulesText: '',
          copiedFrom: null,
        },
        cause: { ...CAUSE, reason: '' },
      },
      {
        type: 'CHANGE_CARD_COUNTER',
        cardId: CARD_ID,
        name: ' ',
        delta: 1,
        cause: CAUSE,
      },
      {
        type: 'CHANGE_CARD_COUNTER',
        cardId: CARD_ID,
        name: 'charges',
        delta: Number.NaN,
        cause: CAUSE,
      },
    ];
    for (const command of invalid) {
      expect(() => run(state, manifest, [command]))
        .toThrow(KernelInvariantError);
      expect(getCardState(state, CARD_ID)).toMatchObject({
        tags: [],
        counters: {},
        textOverride: null,
      });
    }
  });

  it('requires metadata event provenance at the reducer boundary', () => {
    const { manifest, state } = fixture();
    const events = [
      {
        type: 'CARD_TAG_ADDED',
        cardId: CARD_ID,
        tag: { kind: 'DESTROY_IMMUNE' },
      },
      {
        type: 'CARD_TAG_REMOVED',
        cardId: CARD_ID,
        tag: 'DESTROY_IMMUNE',
      },
      {
        type: 'CARD_COUNTER_CHANGED',
        cardId: CARD_ID,
        name: 'charges',
        delta: 1,
      },
      {
        type: 'CARD_TEXT_OVERRIDDEN',
        cardId: CARD_ID,
        override: {
          kind: 'BLANKED_TEXT',
          abilities: {},
          rulesText: '',
          copiedFrom: null,
        },
      },
    ] as unknown as MatchEvent[];
    for (const event of events) {
      expect(() => apply(state, event, manifest))
        .toThrow(`${event.type} cause is required`);
    }
  });

  it('rejects unsafe counter events at the reducer boundary', () => {
    const { manifest, state } = fixture();
    expect(() => apply(state, {
      type: 'CARD_COUNTER_CHANGED',
      cardId: CARD_ID,
      name: 'charges',
      delta: Number.NaN,
      cause: CAUSE,
    }, manifest)).toThrow(/delta must be a safe integer/);

    const saturated = apply(state, {
      type: 'CARD_COUNTER_CHANGED',
      cardId: CARD_ID,
      name: 'charges',
      delta: Number.MAX_SAFE_INTEGER,
      cause: CAUSE,
    }, manifest);
    expect(() => apply(saturated, {
      type: 'CARD_COUNTER_CHANGED',
      cardId: CARD_ID,
      name: 'charges',
      delta: 1,
      cause: CAUSE,
    }, manifest)).toThrow(/result must be a safe integer/);
  });

  it('materializes truthful scoped removals and composes them', () => {
    const base = testCardDef('blank-on-reveal-def', {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
      }],
    });
    const definition: CardDef = {
      ...base,
      abilities: {
        ...base.abilities,
        ongoing: [{
          kind: 'POWER_ADD',
          target: { kind: 'SELF' },
          delta: { kind: 'LIT', n: 1 },
          stack: 'ADDITIVE',
        }],
      },
    };
    const manifest = testManifest([definition]);
    const printedState = buildRuntimeFixture({
      seed: 'blank-on-reveal',
      localSeat: 'P0',
      turn: 2,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{ id: CARD_ID, defId: definition.defId, revealed: true }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
    }).state;
    const context: EffectCtx = {
      state: printedState,
      manifest,
      self: CARD_ID,
      selfKind: 'card',
      selfLane: 0,
      selfOwner: 'P0',
      rng: createRng('blank-on-reveal'),
      source: CAUSE,
      depth: 0,
    };
    const result = executeEffectForTest(printedState, {
      kind: 'REMOVE_TEXT',
      target: { kind: 'SELF' },
      textKind: 'ON_REVEAL',
    }, context, manifest);

    expect(result.events).toMatchObject([{
      type: 'CARD_TEXT_OVERRIDDEN',
      override: {
        kind: 'BLANKED_TEXT',
        rulesText: '',
        copiedFrom: null,
      },
    }]);
    const afterRevealRemoval = getCardRuntime(result.state, CARD_ID, manifest);
    expect(afterRevealRemoval?.text.abilities.onReveal).toBeUndefined();
    expect(afterRevealRemoval?.text.abilities.ongoing).toHaveLength(1);
    expect(afterRevealRemoval?.text.rulesText).toBe('');

    const composed = executeEffectForTest(result.state, {
      kind: 'REMOVE_TEXT',
      target: { kind: 'SELF' },
      textKind: 'ONGOING',
    }, { ...context, state: result.state }, manifest);
    const afterBoth = getCardRuntime(composed.state, CARD_ID, manifest);
    expect(afterBoth?.text.abilities).toEqual({});
    expect(afterBoth?.text.rulesText).toBe('');

    const repeated = executeEffectForTest(composed.state, {
      kind: 'REMOVE_TEXT',
      target: { kind: 'SELF' },
      textKind: 'ONGOING',
    }, { ...context, state: composed.state }, manifest);
    expect(repeated.events).toEqual([]);
  });

  it('preserves copied provenance while removing copied text slots', () => {
    const onReveal = {
      kind: 'ADD_POWER' as const,
      target: { kind: 'SELF' as const },
      delta: { kind: 'LIT' as const, n: 1 },
    };
    const ongoing = {
      kind: 'POWER_ADD' as const,
      target: { kind: 'SELF' as const },
      delta: { kind: 'LIT' as const, n: 1 },
      stack: 'ADDITIVE' as const,
    };
    const base = testCardDef('copied-removal-def');
    const manifest = testManifest([base]);
    const printedState = buildRuntimeFixture({
      seed: 'copied-removal',
      localSeat: 'P0',
      turn: 2,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [{
        P0: [{
          id: CARD_ID,
          defId: base.defId,
          revealed: true,
        }],
        P1: [],
      }, { P0: [], P1: [] }, { P0: [], P1: [] }],
      locations: [null, null, null],
    }).state;
    const copiedState = run(printedState, manifest, [{
      type: 'OVERRIDE_CARD_TEXT',
      cardId: CARD_ID,
      override: {
        kind: 'COPIED_TEXT',
        sourceCardId: 'copied-source' as CardId,
        sourceDefId: 'copied-source-def',
        scope: 'ALL',
        abilities: { onReveal: [onReveal], ongoing: [ongoing] },
        rulesText: 'Copied reveal and ongoing text.',
      },
      cause: CAUSE,
    }]).state;
    const context: EffectCtx = {
      state: copiedState,
      manifest,
      self: CARD_ID,
      selfKind: 'card',
      selfLane: 0,
      selfOwner: 'P0',
      rng: createRng('copied-removal'),
      source: CAUSE,
      depth: 0,
    };
    const removed = executeEffectForTest(copiedState, {
      kind: 'REMOVE_TEXT',
      target: { kind: 'SELF' },
      textKind: 'ON_REVEAL',
    }, context, manifest);
    expect(getCardRuntime(removed.state, CARD_ID, manifest)?.text)
      .toMatchObject({
        abilities: { ongoing: [ongoing] },
        rulesText: '',
        override: {
          kind: 'BLANKED_TEXT',
          copiedFrom: {
            sourceCardId: 'copied-source',
            sourceDefId: 'copied-source-def',
            scope: 'ALL',
          },
        },
      });
    expect(evalPredicate({
      kind: 'HAS_COPIED_TEXT',
      target: { kind: 'SELF' },
    }, { ...context, state: removed.state })).toBe(true);

    const cleared = executeEffectForTest(removed.state, {
      kind: 'REMOVE_COPIED_TEXT',
      target: { kind: 'SELF' },
    }, { ...context, state: removed.state }, manifest);
    expect(getCardRuntime(cleared.state, CARD_ID, manifest)?.text.override)
      .toBeNull();
  });
});

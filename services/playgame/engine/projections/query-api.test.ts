import { describe, expect, it } from 'vitest';
import { executeRulesCommands } from '../effects/rulesInterpreter';
import { createRng } from '../rng';
import type { EffectExpr, OngoingExpr } from '../types/ability';
import type { CardId } from '../types/ids';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import {
  findCard,
  findCardDef,
  findCardDefs,
  findCards,
} from './query';

const selfPower: EffectExpr = {
  kind: 'ADD_POWER',
  target: { kind: 'SELF' },
  delta: { kind: 'LIT', n: 1 },
};

const selfOngoingPower: OngoingExpr = {
  kind: 'POWER_ADD',
  target: { kind: 'SELF' },
  delta: { kind: 'LIT', n: 1 },
  stack: 'ADDITIVE',
};

const vanilla = testCardDef('vanilla', { power: 2, cost: 1 });
const revealer = testCardDef('revealer', {
  power: 3,
  cost: 2,
  onReveal: [selfPower],
});
const ender = testCardDef('ender', {
  power: 4,
  cost: 3,
  onEndOfTurn: [selfPower],
});
const device = {
  ...testCardDef('device', { power: 5, cost: 4 }),
  cardType: 'device' as const,
  abilities: { ongoing: [selfOngoingPower] },
};
const retired = testCardDef('retired', { power: 9, cost: 5 });

const baseManifest = testManifest([vanilla, revealer, ender, device, retired]);
const manifest = {
  ...baseManifest,
  disabled: {
    ...baseManifest.disabled,
    cards: ['retired'],
  },
};

const fixture = buildRuntimeFixture({
  seed: 'query-api-tests',
  localSeat: 'P0',
  turn: 3,
  phase: 'AWAITING_INTENT',
  priority: 'P0',
  decks: {
    P0: [{ id: 'deck-vanilla', defId: 'vanilla' }],
    P1: [{ id: 'enemy-deck-retired', defId: 'retired' }],
  },
  hands: {
    P0: [
      { id: 'hand-revealer', defId: 'revealer' },
      { id: 'hand-vanilla', defId: 'vanilla' },
    ],
    P1: [],
  },
  lanes: [
    {
      P0: [{ id: 'board-vanilla', defId: 'vanilla', revealed: true }],
      P1: [{ id: 'enemy-device', defId: 'device', revealed: true }],
    },
    {
      P0: [{
        id: 'created-ender',
        defId: 'ender',
        revealed: true,
        powerMutations: [{ kind: 'ADD', delta: 2 }],
        costDelta: -2,
        lifecycle: {
          frameLastMoved: 4 as never,
          turnLastMoved: 2,
        },
        spawnSource: {
          kind: 'CARD_CREATED',
          sourceCardId: 'creator' as CardId,
        },
      }],
      P1: [{ id: 'enemy-revealer', defId: 'revealer', revealed: true }],
    },
    { P0: [], P1: [] },
  ],
  locations: [null, null, null],
});

const state = fixture.state;

describe('live InternalCardRecord queries', () => {
  it('findCard combines game-state and manifest-backed criteria', () => {
    const match = findCard(state, manifest, {
      zone: 'LANE',
      lane: 1,
      owner: 'P0',
      power: { gte: 6 },
      hasOnEndOfTurn: true,
      hasTag: 'EVER_MOVED',
      createdInGame: true,
    });

    expect(match?.id).toBe('created-ender');
  });

  it('findCards returns every matching instance, not one result per template', () => {
    const matches = findCards(state, manifest, { defId: 'vanilla' });

    expect(matches.map((card) => card.id)).toEqual([
      'deck-vanilla',
      'hand-vanilla',
      'board-vanilla',
    ]);
  });

  it('supports nested AND, OR, and NOT criteria', () => {
    const matches = findCards(state, manifest, {
      zone: 'LANE',
      and: [
        { owner: 'P0' },
        {
          or: [
            { hasAnyAbility: false },
            { hasOnEndOfTurn: true },
          ],
        },
      ],
      not: { cardType: 'device' },
    });

    expect(matches.map((card) => card.id)).toEqual([
      'board-vanilla',
      'created-ender',
    ]);
  });

  it('findCard returns the first stable match and null when nothing matches', () => {
    expect(findCard(state, manifest, {
      zone: 'HAND',
      owner: 'P0',
    })?.id).toBe('hand-revealer');

    expect(findCard(state, manifest, {
      zone: 'DISCARD',
    })).toBeNull();
  });

  it('queries effective current cost rather than printed template cost', () => {
    expect(findCards(state, manifest, {
      cost: 1,
      hasOnEndOfTurn: true,
    }).map(card => card.id)).toEqual(['created-ender']);

    expect(findCardDefs(manifest, {
      cost: 3,
      hasOnEndOfTurn: true,
    }).map(card => card.defId)).toEqual(['ender']);
  });

  it('never assigns board geometry to cards outside a lane', () => {
    expect(findCards(state, manifest, {
      slot: [1, 2, 3, 4],
    }).map(card => card.id)).toEqual([
      'board-vanilla',
      'enemy-device',
      'created-ender',
      'enemy-revealer',
    ]);
    expect(findCards(state, manifest, {
      zone: ['DECK', 'HAND'],
      row: [1, 2],
    })).toEqual([]);
  });

  it('requires every supplied position axis to agree', () => {
    expect(findCards(state, manifest, {
      lane: 0,
      slot: 1,
      row: 2,
    })).toEqual([]);
    expect(findCards(state, manifest, {
      lane: 0,
      slot: 1,
      row: 1,
      column: 1,
    }).map(card => card.id)).toEqual([
      'board-vanilla',
      'enemy-device',
    ]);
  });

  it('queries effective replaced or blanked text without changing template queries', () => {
    const source = {
      sourceId: 'text-boundary-source' as CardId,
      effectKind: 'SYSTEM' as const,
      reason: 'QUERY_EFFECTIVE_TEXT_BOUNDARY',
    };
    const blanked = executeRulesCommands(state, [{
      type: 'OVERRIDE_CARD_TEXT',
      cardId: 'hand-revealer' as CardId,
      override: {
        kind: 'BLANKED_TEXT',
        abilities: {},
        rulesText: '',
        copiedFrom: null,
      },
      cause: source,
    }], { rng: createRng('query-api-blank-text') }, manifest);
    const copied = executeRulesCommands(blanked.state, [{
      type: 'OVERRIDE_CARD_TEXT',
      cardId: 'hand-vanilla' as CardId,
      override: {
        kind: 'COPIED_TEXT',
        sourceCardId: 'hand-revealer' as CardId,
        sourceDefId: 'revealer',
        scope: 'ALL',
        abilities: { onReveal: [selfPower] },
        rulesText: 'On Reveal: Gain +1 Power.',
      },
      cause: source,
    }], { rng: createRng('query-api-copy-text') }, manifest);

    expect(findCards(copied.state, manifest, {
      zone: 'HAND',
      hasAnyAbility: false,
    }).map(card => card.id)).toEqual(['hand-revealer']);
    expect(findCards(copied.state, manifest, {
      zone: 'HAND',
      hasOnReveal: true,
    }).map(card => card.id)).toEqual(['hand-vanilla']);
    expect(findCardDefs(manifest, {
      hasOnReveal: true,
    }).map(card => card.defId)).toEqual(['revealer']);
  });

  it('treats empty position sets as matching nothing', () => {
    expect(findCards(state, manifest, { slot: [] })).toEqual([]);
    expect(findCards(state, manifest, { row: [] })).toEqual([]);
    expect(findCards(state, manifest, { column: [] })).toEqual([]);
  });
});

describe('manifest CardDef queries', () => {
  it('findCardDefs queries templates without requiring MatchState', () => {
    const matches = findCardDefs(manifest, {
      hasAnyAbility: false,
      disabled: false,
    });

    expect(matches.map((def) => def.defId)).toEqual(['vanilla']);
  });

  it('combines taxonomy, cost, and ability criteria', () => {
    expect(findCardDefs(manifest, {
      cardType: 'device',
      cost: { between: [3, 5] },
      hasOngoing: true,
    }).map((def) => def.defId)).toEqual(['device']);

    expect(findCardDefs(manifest, {
      hasOnEndOfTurn: true,
    }).map((def) => def.defId)).toEqual(['ender']);
  });

  it('supports disabled and composed template criteria', () => {
    expect(findCardDefs(manifest, {
      disabled: true,
    }).map((def) => def.defId)).toEqual(['retired']);

    expect(findCardDefs(manifest, {
      and: [
        { cost: { gte: 2 } },
        { not: { cardType: 'device' } },
      ],
    }).map((def) => def.defId)).toEqual([
      'revealer',
      'ender',
      'retired',
    ]);
  });

  it('findCardDef returns the first stable match and null when none qualify', () => {
    expect(findCardDef(manifest, {
      cost: { gte: 2 },
      not: { cardType: 'device' },
    })?.defId).toBe('revealer');

    expect(findCardDef(manifest, {
      defId: 'missing-template',
    })).toBeNull();
  });
});

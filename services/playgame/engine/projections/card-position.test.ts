import { getCardState } from './cardRuntime';
import { describe, expect, it } from 'vitest';
import { evalEffect, type EffectCtx } from '../effects/evaluator';
import type { CardDef, Manifest } from '../manifest/types';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectExpr, Selector } from '../types/ability';
import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';
import { findCards } from './query';
import { select } from './select';

const SELF = { kind: 'SELF' } as const;

function positionFixture(): MatchState {
  return buildRuntimeFixture({
    seed: 'card-position-query',
    localSeat: 'P0',
    turn: 2,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      {
        P0: [
          { id: 'p0-slot-1', defId: 'body', revealed: true },
          { id: 'p0-slot-2', defId: 'body', revealed: true },
          { id: 'p0-slot-3', defId: 'body', revealed: true },
          { id: 'p0-slot-4', defId: 'body', revealed: true },
        ],
        P1: [
          { id: 'p1-slot-1', defId: 'body', revealed: true },
          { id: 'p1-slot-2', defId: 'body', revealed: true },
        ],
      },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
}

function evalCtx(state: MatchState, manifest: Manifest) {
  return {
    state,
    manifest,
    self: 'p0-slot-1' as CardId,
    selfKind: 'card' as const,
    selfLane: 0,
    selfOwner: 'P0' as const,
  };
}

describe('owner-relative card position queries', () => {
  const manifest = testManifest([testCardDef('body')]);
  const state = positionFixture();

  it('findCards searches by 1-based slot', () => {
    expect(findCards(state, manifest, {
      zone: 'LANE',
      slot: [1, 4],
    }).map((card) => card.id)).toEqual([
      'p0-slot-1',
      'p0-slot-4',
      'p1-slot-1',
    ]);
  });

  it('findCards searches by row and column', () => {
    expect(findCards(state, manifest, {
      zone: 'LANE',
      row: 1,
    }).map((card) => card.id)).toEqual([
      'p0-slot-1',
      'p0-slot-2',
      'p1-slot-1',
      'p1-slot-2',
    ]);

    expect(findCards(state, manifest, {
      zone: 'LANE',
      owner: 'P0',
      column: 2,
    }).map((card) => card.id)).toEqual([
      'p0-slot-2',
      'p0-slot-4',
    ]);
  });

  it('the serializable Selector DSL can consume the same row criteria', () => {
    const firstRow: Selector = {
      kind: 'WHERE',
      of: {
        kind: 'ALL_CARDS',
        ownerFilter: 'ANY_OWNER',
        zoneFilter: 'LANE',
      },
      pred: {
        kind: 'CARD_POSITION',
        target: SELF,
        row: 1,
      },
    };

    expect(select(firstRow, evalCtx(state, manifest))).toEqual([
      'p0-slot-1',
      'p0-slot-2',
      'p1-slot-1',
      'p1-slot-2',
    ]);
  });
});

function barricadeStyleDef(): CardDef {
  return {
    ...testCardDef('row-protector'),
    abilities: {
      ongoing: [{
        kind: 'BLOCK_DESTROY',
        target: {
          kind: 'WHERE',
          of: {
            kind: 'SAME_LANE',
            of: SELF,
            ownerFilter: 'ANY_OWNER',
          },
          pred: {
            kind: 'CARD_POSITION',
            target: SELF,
            row: 1,
          },
        },
        stack: 'SINGLE',
      }],
    },
  };
}

function protectedState(manifest: Manifest): MatchState {
  return buildRuntimeFixture({
    seed: 'first-row-destroy-protection',
    localSeat: 'P0',
    turn: 3,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      {
        P0: [
          { id: 'protector', defId: 'row-protector', revealed: true },
          { id: 'front-victim', defId: 'body', revealed: true },
          { id: 'rear-victim', defId: 'body', revealed: true },
        ],
        P1: [
          { id: 'enemy-filler-1', defId: 'body', revealed: true },
          { id: 'enemy-filler-2', defId: 'body', revealed: true },
          { id: 'enemy-destroyer', defId: 'destroyer', revealed: true },
        ],
      },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
}

function destroyRow(row: 1 | 2): EffectExpr {
  return {
    kind: 'DESTROY',
    target: {
      kind: 'WHERE',
      of: {
        kind: 'SAME_LANE',
        of: SELF,
        ownerFilter: 'OPP_OWNER',
      },
      pred: {
        kind: 'CARD_POSITION',
        target: SELF,
        row,
      },
    },
  };
}

function destroyCtx(state: MatchState, manifest: Manifest): EffectCtx {
  const destroyer = 'enemy-destroyer' as CardId;
  return {
    state,
    manifest,
    self: destroyer,
    selfKind: 'card',
    selfLane: 0,
    selfOwner: 'P1',
    rng: createRng('row-destroy-attempt'),
    source: { sourceId: destroyer, effectKind: 'ON_REVEAL', reason: 'TEST' },
    depth: 0,
  };
}

describe('row-targeted destruction protection', () => {
  const manifest = testManifest([
    barricadeStyleDef(),
    testCardDef('body'),
    testCardDef('destroyer'),
  ]);

  it('can protect any first-row card from an enemy destroy effect', () => {
    const state = protectedState(manifest);
    const result = evalEffect(state, destroyRow(1), destroyCtx(state, manifest), manifest);

    expect(result.events.filter((event) => event.type === 'CARD_DESTROYED')).toEqual([]);
    expect(getCardState(result.state, 'protector' as CardId)!.zone).toBe('LANE');
    expect(getCardState(result.state, 'front-victim' as CardId)!.zone).toBe('LANE');
  });

  it('does not protect a matching card in the second row', () => {
    const state = protectedState(manifest);
    const result = evalEffect(state, destroyRow(2), destroyCtx(state, manifest), manifest);

    expect(result.events.filter((event) => event.type === 'CARD_DESTROYED')).toHaveLength(1);
    expect(getCardState(result.state, 'rear-victim' as CardId)!.zone).toBe('DESTROYED');
  });
});

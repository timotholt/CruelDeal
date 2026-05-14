/**
 * Tests for new DSL atoms added in the trackedVariables pass:
 *   NumExpr:   COST_OF, HAND_SIZE, IF_ELSE, TRACKED_STAT
 *   Predicate: NUM_CMP, WAS_CREATED, POWER_INCREASED, COST_REDUCED,
 *              TRACKED_FLAG, HAND_EMPTY, HAS_UNSPENT_ENERGY, EVER_MOVED,
 *              IN_FULL_LANE, LANE_FULL, HAS_ONGOING, TEXT_DISABLED
 *   Selector:  MIN_POWER_OF, MAX_POWER_OF, MIN_COST_OF, MAX_COST_OF
 */

import { describe, it, expect } from 'vitest';
import { evalNum } from '../projections/numexpr';
import { evalPredicate, select } from '../projections/select';
import { EMPTY_TRACKED_VARIABLES } from '../types/state';
import type { MatchState, CardInstance, TrackedVariables } from '../types/state';
import type { CardId, Owner } from '../types/ids';
import type { CardDef, Manifest } from '../manifest/types';
import type { EvalCtx } from '../projections/context';

// ---- Fixture helpers -------------------------------------------------------

function mkDef(defId: string, basePower: number, cost: number, hasOngoing = false): CardDef {
  return {
    defId, version: 1, name: defId, basePower, cost,
    cardType: 'character',
    abilities: hasOngoing ? {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    } : {},
    cosmetic: {
      displayName: defId, flavorText: '', rulesText: hasOngoing ? 'has ongoing' : '',
      art: { portrait: { path: '' } },
    },
  };
}

function mkCard(
  id: string,
  defId: string,
  owner: Owner,
  opts: Partial<CardInstance> = {},
): CardInstance {
  return {
    id: id as CardId,
    defId,
    version: 1,
    owner,
    lane: 0,
    zone: 'LANE',
    revealed: true,
    powerDelta: 0,
    costDelta: 0,
    powerLog: [],
    costLog: [],
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
    ...opts,
  };
}

function buildState(
  cards: CardInstance[],
  tv: Partial<TrackedVariables> = {},
  hand: { P0: CardInstance[]; P1: CardInstance[] } = { P0: [], P1: [] },
  energy: { P0: number; P1: number } = { P0: 3, P1: 0 },
): MatchState {
  const cardMap = Object.fromEntries(cards.map(c => [c.id, c])) as Record<CardId, CardInstance>;
  const lanesCards: { P0: CardId[]; P1: CardId[] } = { P0: [], P1: [] };
  for (const c of cards) {
    if (c.zone === 'LANE' && c.lane === 0) lanesCards[c.owner].push(c.id);
  }
  return {
    turn: 3,
    maxEnergy: { P0: 3, P1: 3 },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed: 'test',
    priority: 'P0',
    energy,
    deck: { P0: [], P1: [] },
    hand,
    cards: cardMap,
    lanes: [
      { idx: 0, location: null, locationRevealed: false, cards: lanesCards },
      { idx: 1, location: null, locationRevealed: false, cards: { P0: [], P1: [] } },
      { idx: 2, location: null, locationRevealed: false, cards: { P0: [], P1: [] } },
    ],
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { P0: null, P1: null },
    result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: { ...EMPTY_TRACKED_VARIABLES, ...tv },
  };
}

function mkManifest(defs: CardDef[]): Manifest {
  return {
    cards: Object.fromEntries(defs.map(d => [d.defId, d])),
    locations: {},
    disabled: { cards: [], locations: [] },
    version: 1, protocolVersion: 1,
    constants: { handCap: 7, deckSize: 12, laneCapacity: 4, turnLimit: 6, energyCurve: [1,2,3,4,5,6] },
  };
}

function ctx(state: MatchState, manifest: Manifest, self: CardId, selfOwner: Owner): EvalCtx {
  return {
    state, manifest,
    self,
    selfKind: 'card',
    selfLane: state.cards[self]?.lane ?? null,
    selfOwner,
  };
}

// ---- Tests -----------------------------------------------------------------

describe('NumExpr: COST_OF', () => {
  it('returns cost of selected card', () => {
    const c = mkCard('c1', 'cheap', 'P0');
    const manifest = mkManifest([mkDef('cheap', 1, 2)]);
    const state = buildState([c]);
    const result = evalNum(
      { kind: 'COST_OF', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(2);
  });

  it('returns 0 when target resolves to nothing', () => {
    const c = mkCard('c1', 'cheap', 'P0');
    const manifest = mkManifest([mkDef('cheap', 1, 2)]);
    const state = buildState([c]);
    const result = evalNum(
      { kind: 'COST_OF', target: { kind: 'ALL_CARDS', ownerFilter: 'OPP_OWNER', zoneFilter: 'HAND' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(0);
  });
});

describe('NumExpr: HAND_SIZE', () => {
  it('returns hand size for SELF_OWNER', () => {
    const c = mkCard('c1', 'cheap', 'P0');
    const h1 = mkCard('h1', 'cheap', 'P0', { zone: 'HAND', lane: null });
    const h2 = mkCard('h2', 'cheap', 'P0', { zone: 'HAND', lane: null });
    const manifest = mkManifest([mkDef('cheap', 1, 1)]);
    const state = buildState([c], {}, { P0: [h1, h2], P1: [] });
    const result = evalNum(
      { kind: 'HAND_SIZE', owner: 'SELF_OWNER' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(2);
  });

  it('returns opponent hand size for OPP_OWNER', () => {
    const c = mkCard('c1', 'cheap', 'P0');
    const h1 = mkCard('h1', 'cheap', 'P1', { zone: 'HAND', lane: null });
    const manifest = mkManifest([mkDef('cheap', 1, 1)]);
    const state = buildState([c], {}, { P0: [], P1: [h1] });
    const result = evalNum(
      { kind: 'HAND_SIZE', owner: 'OPP_OWNER' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(1);
  });
});

describe('NumExpr: IF_ELSE', () => {
  it('returns then-branch when predicate is true', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    const result = evalNum(
      {
        kind: 'IF_ELSE',
        if: { kind: 'TRUE' },
        then: { kind: 'LIT', n: 10 },
        else: { kind: 'LIT', n: 0 },
      },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(10);
  });

  it('returns else-branch when predicate is false', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    const result = evalNum(
      {
        kind: 'IF_ELSE',
        if: { kind: 'NOT', p: { kind: 'TRUE' } },
        then: { kind: 'LIT', n: 10 },
        else: { kind: 'LIT', n: 5 },
      },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(5);
  });
});

describe('NumExpr: TRACKED_STAT', () => {
  it('reads per-owner stat', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], {
      P0: { ...EMPTY_TRACKED_VARIABLES.P0, cardsYouDestroyed: 4 },
    });
    const result = evalNum(
      { kind: 'TRACKED_STAT', owner: 'SELF_OWNER', stat: 'cardsYouDestroyed' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(4);
  });

  it('reads totalCardsDestroyed global stat', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], { totalCardsDestroyed: 7 });
    const result = evalNum(
      { kind: 'TRACKED_STAT', owner: 'SELF_OWNER', stat: 'totalCardsDestroyed' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toBe(7);
  });
});

// ---- Predicates ------------------------------------------------------------

describe('Predicate: NUM_CMP', () => {
  it('compares two numeric expressions', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    const evalCtx = ctx(state, manifest, 'c1' as CardId, 'P0');
    expect(evalPredicate(
      { kind: 'NUM_CMP', a: { kind: 'LIT', n: 3 }, op: '>=', b: { kind: 'LIT', n: 2 } },
      evalCtx,
    )).toBe(true);
    expect(evalPredicate(
      { kind: 'NUM_CMP', a: { kind: 'LIT', n: 1 }, op: '>', b: { kind: 'LIT', n: 2 } },
      evalCtx,
    )).toBe(false);
  });
});

describe('Predicate: WAS_CREATED', () => {
  it('true for CARD_CREATED spawn source', () => {
    const c = mkCard('c1', 'def', 'P0', {
      spawnSource: { kind: 'CARD_CREATED', sourceCardId: 'src' as CardId },
    });
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('false for DECK_CREATION spawn source', () => {
    const c = mkCard('c1', 'def', 'P0'); // default is DECK_CREATION
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'WAS_CREATED', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });
});

describe('Predicate: POWER_INCREASED', () => {
  it('true when powerDelta > 0', () => {
    const c = mkCard('c1', 'def', 'P0', { powerDelta: 2 });
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'POWER_INCREASED', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('false when powerDelta = 0', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'POWER_INCREASED', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });
});

describe('Predicate: COST_REDUCED', () => {
  it('true when costDelta < 0', () => {
    const c = mkCard('c1', 'def', 'P0', { costDelta: -1 });
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'COST_REDUCED', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });
});

describe('Predicate: TRACKED_FLAG', () => {
  it('returns true when flag is set', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], {
      P0: { ...EMPTY_TRACKED_VARIABLES.P0, hadUnspentEnergyLastTurn: true },
    });
    expect(evalPredicate(
      { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'hadUnspentEnergyLastTurn' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('returns false when flag is not set', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'TRACKED_FLAG', owner: 'SELF_OWNER', flag: 'hadUnspentEnergyLastTurn' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });

  it('can read opponent flag via OPP_OWNER', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], {
      P1: { ...EMPTY_TRACKED_VARIABLES.P1, spentAllEnergyLastTurn: true },
    });
    expect(evalPredicate(
      { kind: 'TRACKED_FLAG', owner: 'OPP_OWNER', flag: 'spentAllEnergyLastTurn' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });
});

describe('Predicate: HAND_EMPTY', () => {
  it('true when hand is empty', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], {}, { P0: [], P1: [] });
    expect(evalPredicate(
      { kind: 'HAND_EMPTY', owner: 'SELF_OWNER' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('false when hand has cards', () => {
    const c = mkCard('c1', 'def', 'P0');
    const h = mkCard('h1', 'def', 'P0', { zone: 'HAND', lane: null });
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], {}, { P0: [h], P1: [] });
    expect(evalPredicate(
      { kind: 'HAND_EMPTY', owner: 'SELF_OWNER' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });
});

describe('Predicate: HAS_UNSPENT_ENERGY', () => {
  it('true when energy > 0', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], {}, { P0: [], P1: [] }, { P0: 2, P1: 0 });
    expect(evalPredicate(
      { kind: 'HAS_UNSPENT_ENERGY', owner: 'SELF_OWNER' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('false when energy = 0', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c], {}, { P0: [], P1: [] }, { P0: 0, P1: 0 });
    expect(evalPredicate(
      { kind: 'HAS_UNSPENT_ENERGY', owner: 'SELF_OWNER' },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });
});

describe('Predicate: EVER_MOVED', () => {
  it('true when card has EVER_MOVED tag', () => {
    const c = mkCard('c1', 'def', 'P0', { tags: [{ kind: 'EVER_MOVED' }] });
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'EVER_MOVED', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('false when card has never moved', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'EVER_MOVED', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });
});

describe('Predicate: IN_FULL_LANE', () => {
  it('true when lane has 4 cards for owner', () => {
    const cards = [
      mkCard('c1', 'def', 'P0'),
      mkCard('c2', 'def', 'P0'),
      mkCard('c3', 'def', 'P0'),
      mkCard('c4', 'def', 'P0'),
    ];
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState(cards);
    expect(evalPredicate(
      { kind: 'IN_FULL_LANE', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('false when lane has fewer than 4', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'IN_FULL_LANE', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });
});

describe('Predicate: HAS_ONGOING', () => {
  it('true when card has ongoing ability', () => {
    const c = mkCard('c1', 'withOngoing', 'P0');
    const manifest = mkManifest([mkDef('withOngoing', 3, 2, true)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'HAS_ONGOING', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(true);
  });

  it('false when card has no ongoing', () => {
    const c = mkCard('c1', 'def', 'P0');
    const manifest = mkManifest([mkDef('def', 3, 2, false)]);
    const state = buildState([c]);
    expect(evalPredicate(
      { kind: 'HAS_ONGOING', target: { kind: 'SELF' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    )).toBe(false);
  });
});

// ---- Selectors -------------------------------------------------------------

describe('Selector: MIN_POWER_OF / MAX_POWER_OF', () => {
  it('MIN_POWER_OF returns weakest card', () => {
    const c1 = mkCard('c1', 'weak', 'P0');   // power 1
    const c2 = mkCard('c2', 'strong', 'P0'); // power 5
    const manifest = mkManifest([mkDef('weak', 1, 1), mkDef('strong', 5, 3)]);
    const state = buildState([c1, c2]);
    const result = select(
      { kind: 'MIN_POWER_OF', of: { kind: 'ALL_CARDS', ownerFilter: 'SELF_OWNER', zoneFilter: 'LANE' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toEqual(['c1']);
  });

  it('MAX_POWER_OF returns strongest card', () => {
    const c1 = mkCard('c1', 'weak', 'P0');
    const c2 = mkCard('c2', 'strong', 'P0');
    const manifest = mkManifest([mkDef('weak', 1, 1), mkDef('strong', 5, 3)]);
    const state = buildState([c1, c2]);
    const result = select(
      { kind: 'MAX_POWER_OF', of: { kind: 'ALL_CARDS', ownerFilter: 'SELF_OWNER', zoneFilter: 'LANE' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toEqual(['c2']);
  });
});

describe('Selector: MIN_COST_OF / MAX_COST_OF', () => {
  it('MIN_COST_OF returns cheapest card', () => {
    const c1 = mkCard('c1', 'cheap', 'P0');
    const c2 = mkCard('c2', 'pricey', 'P0');
    const manifest = mkManifest([mkDef('cheap', 2, 1), mkDef('pricey', 3, 5)]);
    const state = buildState([c1, c2]);
    const result = select(
      { kind: 'MIN_COST_OF', of: { kind: 'ALL_CARDS', ownerFilter: 'SELF_OWNER', zoneFilter: 'LANE' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toEqual(['c1']);
  });

  it('MAX_COST_OF returns most expensive card', () => {
    const c1 = mkCard('c1', 'cheap', 'P0');
    const c2 = mkCard('c2', 'pricey', 'P0');
    const manifest = mkManifest([mkDef('cheap', 2, 1), mkDef('pricey', 3, 5)]);
    const state = buildState([c1, c2]);
    const result = select(
      { kind: 'MAX_COST_OF', of: { kind: 'ALL_CARDS', ownerFilter: 'SELF_OWNER', zoneFilter: 'LANE' } },
      ctx(state, manifest, 'c1' as CardId, 'P0'),
    );
    expect(result).toEqual(['c2']);
  });
});

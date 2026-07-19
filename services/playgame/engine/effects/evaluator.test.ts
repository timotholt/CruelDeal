import { getCardState } from '../projections/cardRuntime';
/**
 * Effect evaluator + revealPlayedCard tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/effects/evaluator.test.ts
 *
 * Each test builds a MatchState fixture + a small synthetic manifest,
 * fires revealPlayedCard (or evalEffect directly), and verifies the resulting
 * event stream and end-state.
 */

import { createRng } from '../rng';
import { apply } from '../apply';
import {
  evalEffect,
  revealPlayedCard,
  MAX_REVEAL_RECURSION,
  type EffectCtx,
} from './evaluator';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import type {
  InternalCardRecord,
  LaneState,
  MatchState,
} from '../types/state';
import { EMPTY_CARD_LIFECYCLE, EMPTY_TRACKED_VARIABLES } from '../types/state';
import type { CardId, LaneId, LocationCardInstanceId, Owner } from '../types/ids';
import type { EffectExpr } from '../types/ability';
import { getCardCost, getCardPower } from '../projections';
import {
  testLaneRegistry,
  testLaneState,
  testPowerLedger,
  emptyTestMatchState,
  withTestLocation,
} from '../testkit/runtimeFixture';

// ---- Tiny assertion shim ---------------------------------------------------

let failures = 0;
const pass = (label: string) => { console.log(`PASS: ${label}`); };
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail, null, 2) : ''}`);
};
const eq = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(label);
  else fail(label, { actual, expected });
};
const truthy = (cond: boolean, label: string) => cond ? pass(label) : fail(label);

// ---- Fixture builders ------------------------------------------------------

const mkCard = (defId: string, basePower: number, cost: number, extra: Partial<CardDef> = {}): CardDef => ({
  defId, version: 1, name: defId, basePower, cost, cardType: 'character', abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  ...extra,
});

const mkLoc = (defId: string, extra: Partial<LocationCardDef> = {}): LocationCardDef => ({
  defId, version: 1, name: defId, rarity: 1, abilities: {},
  cosmetic: { displayName: defId, description: '', art: { map: { path: '' } } },
  ...extra,
});

/** Compile a cards array into a valid Manifest shell. */
function mkManifest(cards: CardDef[], locations: LocationCardDef[] = []): Manifest {
  const byId = <T extends { defId: string }>(arr: T[]): Record<string, T> =>
    Object.fromEntries(arr.map(e => [e.defId, e]));
  return {
    version: 1,
    protocolVersion: 1,
    constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12, startingHandSize: 3, turnStartDraw: 1 },
    rulesets: { standard: {
      rulesetId: 'standard',
      deckConstruction: { defaultCopyLimit: 1 },
      laneRules: { initialLaneCount: 3, maximumActiveLaneCount: 3 },
      locationDeck: { minimumReserveCount: 0, copyLimit: 1 },
    } },
    cards: byId(cards),
    locations: byId(locations),
    disabled: { cards: [], locations: [] },
  };
}

let idCounter = 0;
const nextCardId = (): CardId => `c${++idCounter}` as CardId;

function blankLane(i: LaneId): LaneState {
  return testLaneState(i);
}

interface CardSpec {
  def: string;
  owner: Owner;
  lane: LaneId | null;
  zone?: 'LANE' | 'HAND' | 'DECK';
  revealed?: boolean;
  powerMutations?: InternalCardRecord['powerLedger'][number]['mutation'][];
}

function buildState(
  cardSpecs: CardSpec[],
  locSpecs: Partial<Record<LaneId, string>> = {},
  opts: { seed?: string; turn?: number } = {},
): MatchState {
  idCounter = 0;
  const cards: Record<CardId, InternalCardRecord> = {};
  const hand: Record<Owner, CardId[]> = { P0: [], P1: [] };
  const deck: Record<Owner, CardId[]> = { P0: [], P1: [] };
  const lanes: [LaneState, LaneState, LaneState] = [blankLane(0), blankLane(1), blankLane(2)];

  for (const spec of cardSpecs) {
    const id = nextCardId();
    const zone = spec.zone ?? 'LANE';
    const revealed = spec.revealed ?? (zone === 'LANE');
    const inst: InternalCardRecord = {
      id,
      defId: spec.def,
      version: 1,
      owner: spec.owner,
      lane: zone === 'LANE' ? spec.lane : null,
      zone,
      revealed,
      revealTiming: !revealed && spec.lane !== null
        ? { kind: 'TURN', turn: opts.turn ?? 1 }
        : null,
      lifecycle: { ...EMPTY_CARD_LIFECYCLE },
      powerLedger: testPowerLedger(id, spec.powerMutations ?? []),
      costDelta: 0,
      costLog: [],
      tags: [],
      textOverride: null,
    textLog: [],
      counters: {},
      spawnSource: { kind: 'DECK_CREATION' },
    };
    cards[id] = inst;
    if (zone === 'LANE' && spec.lane !== null) {
      (lanes[spec.lane].cards[spec.owner] as CardId[]).push(id);
    } else if (zone === 'HAND') {
      hand[spec.owner].push(id);
    } else if (zone === 'DECK') {
      deck[spec.owner].push(id);
    }
  }
  let state: MatchState = emptyTestMatchState({
    turn: opts.turn ?? 3,
    maxEnergy: { P0: 3, P1: 3 },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed: opts.seed ?? 'test-seed',
    priority: 'P0',
    energy: { P0: 0, P1: 0 },
    deck,
    hand,
    lanesById: testLaneRegistry(lanes),
    activeLaneOrder: [0, 1, 2],
    nextLaneId: 3,
    locationDeck: {
      drawPile: [], staging: [], discardPile: [], destroyed: [], banished: [],
    },
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    lastPlayedBy: { P0: null, P1: null },
    result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: EMPTY_TRACKED_VARIABLES,
    cards,
  });
  for (const laneStr of Object.keys(locSpecs)) {
    const laneIdx = Number(laneStr) as LaneId;
    state = withTestLocation(
      state,
      laneIdx,
      locSpecs[laneIdx]!,
      true,
      `loc${laneIdx}` as LocationCardInstanceId,
    );
  }
  return state;
}

// ============================================================================
// Tests
// ============================================================================

// -- ADD_POWER: On Reveal buffs a selected target --------------------------

{
  // "Hex Witch" buffs a random friendly card +1.
  const hexWitch = mkCard('hex-witch', 2, 2, {
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: {
            kind: 'SAME_LANE',
            of: { kind: 'SELF' },
            ownerFilter: 'SELF_OWNER',
            exclude: { kind: 'SELF' },
          },
        },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const grunt = mkCard('grunt', 3, 2);
  const manifest = mkManifest([hexWitch, grunt]);

  const s0 = buildState([
    { def: 'hex-witch', owner: 'P0', lane: 0, revealed: false },
    { def: 'grunt',     owner: 'P0', lane: 0 },
    { def: 'grunt',     owner: 'P0', lane: 0 },
  ]);
  const rng = createRng('hex-test');
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, rng);

  const flips = res.events.filter(e => e.type === 'CARD_FLIPPED');
  eq(flips.length, 1, 'Hex Witch: CARD_FLIPPED emitted once');

  const powerChanges = res.events.filter(e => e.type === 'CARD_POWER_CHANGED');
  eq(powerChanges.length, 1, 'Hex Witch: exactly one POWER_CHANGED (random 1 target)');
  truthy(
    powerChanges[0]?.type === 'CARD_POWER_CHANGED'
      && powerChanges[0].mutation.kind === 'ADD'
      && powerChanges[0].mutation.delta === 1,
    'Hex Witch: delta = +1',
  );

  // Power projection picks up the delta.
  const buffed = (powerChanges[0] as { cardId: CardId }).cardId;
  eq(getCardPower(res.state, buffed, manifest), 4, 'target card power = 3 + 1 = 4');

  // Determinism check: same seed → same target.
  const res2 = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('hex-test'));
  eq(
    (res.events.find(e => e.type === 'CARD_POWER_CHANGED') as { cardId: CardId }).cardId,
    (res2.events.find(e => e.type === 'CARD_POWER_CHANGED') as { cardId: CardId }).cardId,
    'Hex Witch: same seed ⇒ same random target',
  );
}

// -- Cosmo suppression: OR doesn't fire ------------------------------------

{
  const pyro = mkCard('pyro', 4, 3, {
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const cosmo = mkCard('cosmo', 3, 3, {
    abilities: {
      ongoing: [{
        kind: 'DISABLE_ON_REVEAL',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        stack: 'SINGLE',
      }],
    },
  });
  const manifest = mkManifest([pyro, cosmo]);
  const s0 = buildState([
    { def: 'cosmo', owner: 'P1',    lane: 0 },
    { def: 'pyro',  owner: 'P0', lane: 0, revealed: false },
  ]);
  const rng = createRng('cosmo-test');
  const res = revealPlayedCard(s0, 'c2' as CardId, manifest, rng);

  // The card still flips face-up but no OR window opens and no effects fire.
  eq(res.events.filter(e => e.type === 'CARD_FLIPPED').length, 1, 'Cosmo: CARD_FLIPPED still emitted');
  eq(res.events.filter(e => e.type === 'OR_WINDOW_OPEN').length, 0, 'Cosmo: no OR_WINDOW_OPEN');
  eq(res.events.filter(e => e.type === 'CARD_POWER_CHANGED').length, 0, 'Cosmo: OR effects suppressed');
}

// -- Wong-style ×2 OR: effect fires twice ----------------------------------

{
  const pyro = mkCard('pyro', 4, 3, {
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const wong = mkCard('wong', 2, 4, {
    abilities: {
      ongoing: [{
        kind: 'ON_REVEAL_MULTIPLIER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      }],
    },
  });
  const manifest = mkManifest([pyro, wong]);
  const s0 = buildState([
    { def: 'wong', owner: 'P0', lane: 0 },
    { def: 'pyro', owner: 'P0', lane: 0, revealed: false },
  ]);
  const res = revealPlayedCard(s0, 'c2' as CardId, manifest, createRng('wong-test'));
  eq(
    (res.events.find(e => e.type === 'OR_WINDOW_OPEN') as { multiplier: number }).multiplier,
    2,
    'Wong: OR_WINDOW_OPEN.multiplier = 2',
  );
  eq(
    res.events.filter(e => e.type === 'CARD_POWER_CHANGED').length,
    2,
    'Wong: +1 self fires twice (×2 OR)',
  );
  eq(getCardPower(res.state, 'c2' as CardId, manifest), 4 + 2, 'Pyro power = 4 + 2 = 6');
}

// -- MOVE: Dune Sapper moves to another random lane ------------------------

{
  const sapper = mkCard('sapper', 1, 1, {
    abilities: {
      onReveal: [{
        kind: 'MOVE',
        target: { kind: 'SELF' },
        to: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'OTHER_LANES', of: { kind: 'SELF' } },
        },
      }],
    },
  });
  const manifest = mkManifest([sapper]);
  const s0 = buildState([{ def: 'sapper', owner: 'P0', lane: 0, revealed: false }]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('sapper'));
  const moved = res.events.find(e => e.type === 'CARD_MOVED') as { fromLane: LaneId; toLane: LaneId };
  truthy(!!moved, 'MOVE: CARD_MOVED emitted');
  eq(moved.fromLane, 0, 'MOVE: fromLane = 0');
  truthy(moved.toLane !== 0 && (moved.toLane === 1 || moved.toLane === 2), 'MOVE: toLane is another lane');
  eq(getCardState(res.state, 'c1' as CardId)?.lane, moved.toLane, 'MOVE: state.cards.lane updated');
  eq(res.state.lanesById[0].cards.P0.length, 0, 'MOVE: card removed from old lane');
}

// -- DESTROY + DISCARD ------------------------------------------------------

{
  const gun = mkCard('gun', 3, 2, {
    abilities: {
      onReveal: [{
        kind: 'DESTROY',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'OPP_OWNER' },
      }],
    },
  });
  const grunt = mkCard('grunt', 2, 1);
  const manifest = mkManifest([gun, grunt]);
  const s0 = buildState([
    { def: 'gun',   owner: 'P0', lane: 0, revealed: false },
    { def: 'grunt', owner: 'P1',    lane: 0 },
    { def: 'grunt', owner: 'P1',    lane: 0 },
  ]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('destroy'));
  const destroyed = res.events.filter(e => e.type === 'CARD_DESTROYED');
  eq(destroyed.length, 2, 'DESTROY: both opp grunts destroyed');
  eq(getCardState(res.state, 'c2' as CardId)?.zone, 'DESTROYED', 'zone = DESTROYED (not DISCARD)');
  eq(res.state.lanesById[0].cards.P1.length, 0, 'opp lane cleared');
}

// -- SPAWN_AND_REVEAL: nested cascade with spawnSource propagation ---------

{
  // A "tinkerer" spawns a 'grunt' at its own lane and immediately reveals
  // it. grunt's OR then buffs friendlies +1.
  const grunt = mkCard('grunt', 2, 1, {
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const tinkerer = mkCard('tinkerer', 2, 2, {
    abilities: {
      onReveal: [{
        kind: 'SPAWN_AND_REVEAL',
        pool: { kind: 'DEF_ID_LIST', ids: ['grunt'] },
        owner: 'SELF_OWNER',
        to: { kind: 'LANE_OF', of: { kind: 'SELF' } },
      }],
    },
  });
  const manifest = mkManifest([grunt, tinkerer]);
  const s0 = buildState([{ def: 'tinkerer', owner: 'P0', lane: 0, revealed: false }]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('spawn'));

  const added = res.events.find(e => e.type === 'CARD_ADDED_TO_LANE') as
    | { cardId: CardId; defId: string; spawnSource: { kind: string } } | undefined;
  truthy(!!added, 'SPAWN_AND_REVEAL: CARD_ADDED_TO_LANE emitted');
  eq(added!.defId, 'grunt', 'spawned defId = grunt');
  eq(added!.spawnSource.kind, 'CARD_CREATED', 'spawnSource = CARD_CREATED');

  // The spawn's own OR fires — so TWO OR_WINDOW_OPEN events exist
  // (tinkerer + grunt) and the grunt's ADD_POWER hits both tinkerer and grunt.
  eq(
    res.events.filter(e => e.type === 'OR_WINDOW_OPEN').length,
    2,
    'SPAWN_AND_REVEAL: nested OR window opened',
  );
  // After: tinkerer power = 2 + 1 (grunt buff) = 3; grunt power = 2 + 1 = 3.
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 3, 'tinkerer = 2 + 1 (grunt buff) = 3');
  eq(getCardPower(res.state, added!.cardId, manifest), 3, 'grunt = 2 + 1 (self buff) = 3');
}

// -- Recursion cap: SPAWN_AND_REVEAL that spawns itself forever -----------

{
  // A Sera-like card that spawns another of itself. Should stop at MAX_REVEAL_RECURSION.
  const recur = mkCard('recur', 1, 1, {
    abilities: {
      onReveal: [{
        kind: 'SPAWN_AND_REVEAL',
        pool: { kind: 'DEF_ID_LIST', ids: ['recur'] },
        owner: 'SELF_OWNER',
        to: { kind: 'LANE_OF', of: { kind: 'SELF' } },
      }],
    },
  });
  const manifest = mkManifest([recur]);
  // Use a big lane capacity to let it actually recurse.
  manifest.constants = { ...manifest.constants, laneCapacity: 100 };
  const s0 = buildState([{ def: 'recur', owner: 'P0', lane: 0, revealed: false }]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('recur'));
  const limitHits = res.events.filter(e => e.type === 'RECURSION_LIMIT_HIT');
  truthy(limitHits.length >= 1, `Recursion cap: RECURSION_LIMIT_HIT emitted (${limitHits.length} times)`);
  // Total spawns should be bounded by MAX_REVEAL_RECURSION.
  const spawned = res.events.filter(e => e.type === 'CARD_ADDED_TO_LANE').length;
  truthy(spawned <= MAX_REVEAL_RECURSION + 1, `Recursion cap: spawn count bounded (got ${spawned})`);
}

// -- DRAW: pulls from top of deck ------------------------------------------

{
  const helper = mkCard('helper', 1, 1, {
    abilities: {
      onReveal: [{ kind: 'DRAW', owner: 'SELF_OWNER', count: { kind: 'LIT', n: 2 } }],
    },
  });
  const grunt = mkCard('grunt', 2, 1);
  const manifest = mkManifest([helper, grunt]);
  const s0 = buildState([
    { def: 'helper', owner: 'P0', lane: 0, revealed: false },
    { def: 'grunt',  owner: 'P0', lane: null, zone: 'DECK' },
    { def: 'grunt',  owner: 'P0', lane: null, zone: 'DECK' },
    { def: 'grunt',  owner: 'P0', lane: null, zone: 'DECK' },
  ]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('draw'));
  const draws = res.events.filter(e => e.type === 'CARD_DRAWN');
  eq(draws.length, 2, 'DRAW: two CARD_DRAWN emitted');
  eq(res.state.hand.P0.length, 2, 'DRAW: 2 cards in hand');
  eq(res.state.deck.P0.length, 1, 'DRAW: 1 card remaining in deck');
}

// -- SEQUENCE: events chain in order, each sees prior state ----------------

{
  const seqCard = mkCard('seq', 0, 0, {
    abilities: {
      onReveal: [{
        kind: 'SEQUENCE',
        items: [
          { kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } },
          { kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 3 } },
        ],
      }],
    },
  });
  const manifest = mkManifest([seqCard]);
  const s0 = buildState([{ def: 'seq', owner: 'P0', lane: 0, revealed: false }]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('seq'));
  eq(
    res.events.filter(e => e.type === 'CARD_POWER_CHANGED').length,
    2,
    'SEQUENCE: both items fired',
  );
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 5, 'SEQUENCE: +2 then +3 = +5');
}

// -- CONDITIONAL: predicate gate ------------------------------------------

{
  const condCard = mkCard('cond', 0, 0, {
    abilities: {
      onReveal: [{
        kind: 'CONDITIONAL',
        if: {
          kind: 'EXISTS',
          target: {
            kind: 'SAME_LANE',
            of: { kind: 'SELF' },
            ownerFilter: 'SELF_OWNER',
            exclude: { kind: 'SELF' },
          },
        },
        then: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 5 } }],
        else: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
      }],
    },
  });
  const grunt = mkCard('grunt', 2, 1);
  const manifest = mkManifest([condCard, grunt]);

  // Case A: alone → else branch, +1.
  const sAlone = buildState([{ def: 'cond', owner: 'P0', lane: 0, revealed: false }]);
  const rA = revealPlayedCard(sAlone, 'c1' as CardId, manifest, createRng('cond-a'));
  eq(getCardPower(rA.state, 'c1' as CardId, manifest), 1, 'CONDITIONAL: alone → +1');

  // Case B: with friend → then branch, +5.
  const sFriend = buildState([
    { def: 'cond',  owner: 'P0', lane: 0, revealed: false },
    { def: 'grunt', owner: 'P0', lane: 0 },
  ]);
  const rB = revealPlayedCard(sFriend, 'c1' as CardId, manifest, createRng('cond-b'));
  eq(getCardPower(rB.state, 'c1' as CardId, manifest), 5, 'CONDITIONAL: with friend → +5');
}

// -- FOREACH: iterate over selector ---------------------------------------

{
  const fe = mkCard('fe', 0, 0, {
    abilities: {
      onReveal: [{
        kind: 'FOREACH',
        over: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER', exclude: { kind: 'SELF' } },
        do: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
      }],
    },
  });
  const grunt = mkCard('grunt', 2, 1);
  const manifest = mkManifest([fe, grunt]);
  const s0 = buildState([
    { def: 'fe',    owner: 'P0', lane: 0, revealed: false },
    { def: 'grunt', owner: 'P0', lane: 0 },
    { def: 'grunt', owner: 'P0', lane: 0 },
    { def: 'grunt', owner: 'P0', lane: 0 },
  ]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('fe'));
  // 3 friendlies -> 3 ADD_POWERs. FOREACH's inner SELF resolves to the
  // current iteration card, not the source card.
  eq(
    res.events.filter(e => e.type === 'CARD_POWER_CHANGED').length,
    3,
    'FOREACH: 3 iterations for 3 friendlies',
  );
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 0, 'FOREACH: source card unchanged');
  eq(getCardPower(res.state, 'c2' as CardId, manifest), 3, 'FOREACH: first iteration card gained +1');
  eq(getCardPower(res.state, 'c3' as CardId, manifest), 3, 'FOREACH: second iteration card gained +1');
  eq(getCardPower(res.state, 'c4' as CardId, manifest), 3, 'FOREACH: third iteration card gained +1');
}

// -- Pure purity: running twice with same seed → identical results --------

{
  const hex = mkCard('hex', 2, 2, {
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER', exclude: { kind: 'SELF' } },
        },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const grunt = mkCard('grunt', 3, 2);
  const manifest = mkManifest([hex, grunt]);
  const build = () => buildState([
    { def: 'hex',   owner: 'P0', lane: 0, revealed: false },
    { def: 'grunt', owner: 'P0', lane: 0 },
    { def: 'grunt', owner: 'P0', lane: 0 },
    { def: 'grunt', owner: 'P0', lane: 0 },
  ]);
  const rA = revealPlayedCard(build(), 'c1' as CardId, manifest, createRng('pure'));
  const rB = revealPlayedCard(build(), 'c1' as CardId, manifest, createRng('pure'));
  eq(JSON.stringify(rA.events), JSON.stringify(rB.events), 'Purity: same seed ⇒ identical event stream');
}

// -- evalEffect directly: ADD_POWER with targetCtx re-anchoring ------------

{
  // Calling evalEffect directly (not through revealPlayedCard) for a POWER_ADD
  // targeting SAME_LANE SELF_OWNER: the per-target delta evaluation must
  // anchor SELF to the target, not the outer SELF.
  const grunt = mkCard('grunt', 3, 2);
  const manifest = mkManifest([grunt]);
  const s0 = buildState([
    { def: 'grunt', owner: 'P0', lane: 0 },
    { def: 'grunt', owner: 'P0', lane: 0 },
  ]);
  const rng = createRng('direct');
  const effect: EffectExpr = {
    kind: 'ADD_POWER',
    target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
    delta: { kind: 'LIT', n: 2 },
  };
  const ctx: EffectCtx = {
    state: s0,
    manifest,
    self: 'c1' as CardId,
    selfKind: 'card' as const,
    selfLane: 0 as LaneId,
    selfOwner: 'P0' as Owner,
    rng,
    source: { sourceId: 'c1' as CardId, effectKind: 'ON_REVEAL', reason: 'TEST' },
    depth: 0,
  };
  const res = evalEffect(s0, effect, ctx, manifest);
  eq(res.events.length, 2, 'evalEffect direct: 2 targets buffed');
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 5, 'evalEffect direct: self = 3+2');
  eq(getCardPower(res.state, 'c2' as CardId, manifest), 5, 'evalEffect direct: friend = 3+2');
}

// -- Energy primitives: ADJUST_ENERGY / ADJUST_MAX_ENERGY / ADJUST_NEXT_TURN_ENERGY_BONUS

{
  // Psylocke-ish: "next turn, +1 energy". Then Electra-ish: permanent +1 max.
  // Then refund-ish: +2 energy now. Exercises all three new DSL kinds and
  // verifies the emitted events land in state via apply().
  const psy = mkCard('psy', 2, 2, {
    abilities: {
      onReveal: [
        { kind: 'ADJUST_NEXT_TURN_ENERGY_BONUS', owner: 'SELF_OWNER', delta: { kind: 'LIT', n: 1 } },
        { kind: 'ADJUST_MAX_ENERGY',             owner: 'SELF_OWNER', delta: { kind: 'LIT', n: 1 } },
        { kind: 'ADJUST_ENERGY',                 owner: 'SELF_OWNER', delta: { kind: 'LIT', n: 2 } },
        // Test OPP_OWNER resolution: -1 energy to opponent.
        { kind: 'ADJUST_ENERGY',                 owner: 'OPP_OWNER',  delta: { kind: 'LIT', n: -1 } },
      ],
    },
  });
  const manifest = mkManifest([psy]);
  const s0 = buildState([
    { def: 'psy', owner: 'P0', lane: 0, revealed: false },
  ]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('energy-dsl'));

  // Next-turn bonus for P0: +1
  eq(res.state.nextTurnEnergyBonus['P0'], 1, 'ADJUST_NEXT_TURN_ENERGY_BONUS: P0 +1');
  // Max energy for P0: baseline (3) + 1
  eq(res.state.maxEnergy['P0'], 4, 'ADJUST_MAX_ENERGY: P0 +1');
  // Current energy for P0: baseline (0) + 2 = 2
  eq(res.state.energy['P0'], 2, 'ADJUST_ENERGY: P0 +2');
  // P1 energy: baseline (0) - 1 = -1 (engine allows negative; caller may clamp)
  eq(res.state.energy['P1'], -1, 'ADJUST_ENERGY OPP_OWNER: P1 -1');

  // Verify event shapes
  const energyEvents = res.events.filter(
    (e) => e.type === 'ENERGY_CHANGED' || e.type === 'MAX_ENERGY_CHANGED' || e.type === 'NEXT_TURN_ENERGY_BONUS_CHANGED',
  );
  eq(energyEvents.length, 4, 'Energy primitives emit exactly 4 events');
  const nextTurn = energyEvents.find((e) => e.type === 'NEXT_TURN_ENERGY_BONUS_CHANGED');
  eq(nextTurn !== undefined, true, 'NEXT_TURN_ENERGY_BONUS_CHANGED emitted');
}

// -- Energy primitive edge case: delta=0 is a no-op -----------------------

{
  const noop = mkCard('noop', 2, 2, {
    abilities: {
      onReveal: [
        { kind: 'ADJUST_ENERGY', owner: 'SELF_OWNER', delta: { kind: 'LIT', n: 0 } },
      ],
    },
  });
  const manifest = mkManifest([noop]);
  const s0 = buildState([
    { def: 'noop', owner: 'P0', lane: 0, revealed: false },
  ]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('noop'));
  eq(
    res.events.filter((e) => e.type === 'ENERGY_CHANGED').length,
    0,
    'ADJUST_ENERGY delta=0 emits no event',
  );
}

// -- Cost primitive: ADJUST_COST persists and logs on the target card ------

{
  const iceBox = mkLoc('iceBox', {
    abilities: {
      onReveal: [{
        kind: 'ADJUST_COST',
        target: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'HAND_OF', owner: 'P0' },
        },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const grunt = mkCard('grunt', 3, 2);
  const manifest = mkManifest([grunt], [iceBox]);
  const s0 = buildState(
    [
      { def: 'grunt', owner: 'P0', lane: null, zone: 'HAND', revealed: false },
      { def: 'grunt', owner: 'P0', lane: null, zone: 'HAND', revealed: false },
    ],
    { 0: 'iceBox' },
  );
  const effect = manifest.locations.iceBox?.abilities.onReveal?.[0] as EffectExpr;
  const ctx: EffectCtx = {
    state: s0,
    manifest,
    self: 'loc0' as LocationCardInstanceId,
    selfKind: 'location' as const,
    selfLane: 0 as LaneId,
    selfOwner: null,
    rng: createRng('ice-box'),
    source: { sourceId: 'loc0' as LocationCardInstanceId, effectKind: 'LOCATION', reason: 'TEST' },
    depth: 0,
  };
  const res = evalEffect(s0, effect, ctx, manifest);
  eq(res.events.filter((e) => e.type === 'CARD_COST_CHANGED').length, 1, 'ADJUST_COST emits one CARD_COST_CHANGED');
  const hitId = (res.events.find((e) => e.type === 'CARD_COST_CHANGED') as { cardId: CardId }).cardId;
  eq(getCardState(res.state, hitId)?.costDelta, 1, 'ADJUST_COST persists costDelta on the target');
  eq(getCardState(res.state, hitId)?.costLog.length, 1, 'ADJUST_COST appends one cost log entry');
}

// -- onMove trigger: Void Hound gains +2 when moved -----------------------

{
  // Void Hound gains +2 power when it moves. Dune Sapper moves itself on
  // reveal, so this test pairs the two: Sapper wouldn't trigger onMove
  // (it has no such ability) — we use a hound-style moved card instead.
  const teleport = mkCard('teleport', 1, 1, {
    abilities: {
      onReveal: [{
        kind: 'MOVE',
        target: { kind: 'SELF' },
        to: { kind: 'RANDOM_N', count: { kind: 'LIT', n: 1 },
              of: { kind: 'OTHER_LANES', of: { kind: 'SELF' } } },
      }],
      onMove: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 2 },
      }],
    },
  });
  const manifest = mkManifest([teleport]);
  const s0 = buildState([{ def: 'teleport', owner: 'P0', lane: 0, revealed: false }]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('move-trigger'));
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 3, 'onMove: base(1) + moveBuff(2) = 3');
  const moves = res.events.filter((e) => e.type === 'CARD_MOVED');
  eq(moves.length, 1, 'onMove: exactly 1 CARD_MOVED');
}

// -- onDestroyed trigger: self-destroying card emits last-breath effect ----

{
  // Bomber: self-destructs on reveal, dealing 5 damage to opponents in
  // its lane on the way out. Verifies that `onDestroyed` fires AFTER the
  // CARD_DESTROYED event and can still reference SELF's pre-destroy lane
  // (the reducer removes the card from lane arrays but keeps it in
  // `state.cards`, so SELF-anchored selectors keep resolving).
  const bomber = mkCard('bomber', 2, 2, {
    abilities: {
      onReveal: [{ kind: 'DESTROY', target: { kind: 'SELF' } }],
      onDestroyed: [{
        kind: 'ADD_POWER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'OPP_OWNER' },
        delta: { kind: 'LIT', n: -5 },
      }],
    },
  });
  const enemy = mkCard('enemy', 6, 1);
  const manifest = mkManifest([bomber, enemy]);
  const s0 = buildState([
    { def: 'bomber', owner: 'P0', lane: 0, revealed: false },
    { def: 'enemy',  owner: 'P1',    lane: 0, revealed: true },
  ]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('bomber'));
  eq(getCardPower(res.state, 'c2' as CardId, manifest), 1, 'onDestroyed: enemy 6 - 5 = 1');
  const destroyed = res.events.filter((e) => e.type === 'CARD_DESTROYED');
  eq(destroyed.length, 1, 'onDestroyed: exactly 1 CARD_DESTROYED');
}

// -- CREATE_CARD_IN_ZONE: created hand card can have its cost set -----------

{
  const illegalClone = mkCard('illegal-clone', 2, 1, {
    abilities: {
      onReveal: [{ kind: 'DESTROY', target: { kind: 'SELF' } }],
      onDestroyed: [{
        kind: 'CREATE_CARD_IN_ZONE',
        pool: { kind: 'DEF_ID_LIST', ids: ['illegal-clone'] },
        owner: 'SELF_OWNER',
        destination: { kind: 'HAND' },
        setCost: { kind: 'LIT', n: 0 },
      }],
    },
  });
  const manifest = mkManifest([illegalClone]);
  const s0 = buildState([{ def: 'illegal-clone', owner: 'P0', lane: 0, revealed: false }]);
  eq(getCardCost(s0, 'c1' as CardId, manifest), 1, 'Illegal Clone: fresh card costs 1');

  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('illegal-clone'));
  const copyId = res.state.hand.P0[0];
  const copy = copyId === undefined ? null : getCardState(res.state, copyId);
  truthy(copy !== null, 'Illegal Clone: destruction adds a copy to its owner hand');
  eq(copy?.defId, 'illegal-clone', 'Illegal Clone: hand card uses the same definition');
  if (copyId !== undefined) {
    eq(getCardCost(res.state, copyId, manifest), 0, 'Illegal Clone: destroyed copy costs 0');
    truthy(
      res.events.some((event) =>
        event.type === 'CARD_COST_CHANGED' && event.cardId === copyId && event.delta === -1),
      'Illegal Clone: copy receives a permanent -1 cost adjustment',
    );
    const replayed = apply(res.state, {
      type: 'CARD_STAGED',
      intentId: 'illegal-clone-second-life',
      cardId: copyId,
      lane: 1,
      owner: 'P0',
      cost: 0,
    }, manifest);
    const secondDeath = revealPlayedCard(
      replayed,
      copyId,
      manifest,
      createRng('illegal-clone-second-life'),
    );
    const secondCopyId = secondDeath.state.hand.P0[0];
    truthy(
      secondCopyId !== undefined && secondCopyId !== copyId,
      'Illegal Clone: a zero-cost copy can die and create exactly one new identity',
    );
    eq(
      secondDeath.state.hand.P0.length,
      1,
      'Illegal Clone: repeated destruction does not duplicate extra hand copies',
    );
    if (secondCopyId !== undefined) {
      eq(
        getCardCost(secondDeath.state, secondCopyId, manifest),
        0,
        'Illegal Clone: every later destroyed copy is reset to cost 0',
      );
      eq(
        getCardState(secondDeath.state, secondCopyId)?.owner,
        'P0',
        'Illegal Clone: repeated copies retain the destroyed card owner',
      );
    }
  }
}

// -- onAnyCardPlayedHere trigger: Iron-Fist-style +1 power per play -------

{
  // A card that gains +1 power every time ANY other card is revealed in
  // its lane. A fresh reveal here should bump it by 1.
  const watcher = mkCard('watcher', 2, 2, {
    abilities: {
      onAnyCardPlayedHere: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
      }],
    },
  });
  const grunt = mkCard('grunt', 3, 1);
  const manifest = mkManifest([watcher, grunt]);
  const s0 = buildState([
    { def: 'watcher', owner: 'P0', lane: 0, revealed: true },
    { def: 'grunt',   owner: 'P0', lane: 0, revealed: false },
  ]);
  const res = revealPlayedCard(s0, 'c2' as CardId, manifest, createRng('on-play'));
  // Watcher starts at 2, grunt reveals, +1 to watcher → 3.
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 3, 'onAnyCardPlayedHere: watcher 2 + 1 = 3');
  // Grunt itself shouldn't trigger for self.
  eq(getCardPower(res.state, 'c2' as CardId, manifest), 3, 'onAnyCardPlayedHere: grunt unchanged');
}

// -- MOVE with capacity filtering (Dune Sapper fix) -------------------------

{
  // Test 1: Sapper in lane 1, lanes 0 and 2 both empty → moves to one of them
  const sapper = mkCard('sapper', 1, 1, {
    abilities: {
      onReveal: [{
        kind: 'MOVE',
        target: { kind: 'SELF' },
        to: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'OTHER_LANES', of: { kind: 'SELF' } },
        },
      }],
    },
  });
  const filler = mkCard('filler', 1, 1);
  const manifest = mkManifest([sapper, filler]);
  
  const s0 = buildState([
    // Lane 0: empty
    // Lane 1: sapper (will move to lane 0 or 2)
    { def: 'sapper', owner: 'P0', lane: 1, revealed: false },
    // Lane 2: empty
  ]);
  
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('sapper-move-1'));
  const sappCard = getCardState(res.state, 'c1' as CardId)!;
  // Sapper should move to lane 0 or 2 (both have capacity, not lane 1)
  truthy(sappCard.lane === 0 || sappCard.lane === 2, 'MOVE: sapper moved to lane 0 or 2 (not current lane 1)');
  const moveEvent = res.events.find((e) => e.type === 'CARD_MOVED');
  truthy(moveEvent !== undefined, 'MOVE: CARD_MOVED event emitted');
}

{
  // Test 2: Sapper in lane 1, lane 0 full, lane 2 empty → moves only to lane 2
  const sapper = mkCard('sapper', 1, 1, {
    abilities: {
      onReveal: [{
        kind: 'MOVE',
        target: { kind: 'SELF' },
        to: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'OTHER_LANES', of: { kind: 'SELF' } },
        },
      }],
    },
  });
  const filler = mkCard('filler', 1, 1);
  const manifest = mkManifest([sapper, filler]);
  
  const s0 = buildState([
    // Lane 0: 4 fillers (full)
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    // Lane 1: sapper (will move to lane 2, only option)
    { def: 'sapper', owner: 'P0', lane: 1, revealed: false },
    // Lane 2: empty
  ]);
  
  const res = revealPlayedCard(s0, 'c5' as CardId, manifest, createRng('sapper-move-2'));
  const sappCard = getCardState(res.state, 'c5' as CardId)!;
  eq(sappCard.lane, 2, 'MOVE: sapper moved to lane 2 (only non-full lane besides current)');
  const moveEvent = res.events.find((e) => e.type === 'CARD_MOVED');
  truthy(moveEvent !== undefined, 'MOVE: CARD_MOVED event emitted');
}

{
  // Test 3: Sapper in lane 1, lanes 0 and 2 both full → no move
  const sapper = mkCard('sapper', 1, 1, {
    abilities: {
      onReveal: [{
        kind: 'MOVE',
        target: { kind: 'SELF' },
        to: {
          kind: 'RANDOM_N',
          count: { kind: 'LIT', n: 1 },
          of: { kind: 'OTHER_LANES', of: { kind: 'SELF' } },
        },
      }],
    },
  });
  const filler = mkCard('filler', 1, 1);
  const manifest = mkManifest([sapper, filler]);
  
  const s0 = buildState([
    // Lane 0: 4 fillers (full)
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    { def: 'filler', owner: 'P0', lane: 0, revealed: true },
    // Lane 1: sapper (no valid moves)
    { def: 'sapper', owner: 'P0', lane: 1, revealed: false },
    // Lane 2: 4 fillers (full)
    { def: 'filler', owner: 'P0', lane: 2, revealed: true },
    { def: 'filler', owner: 'P0', lane: 2, revealed: true },
    { def: 'filler', owner: 'P0', lane: 2, revealed: true },
    { def: 'filler', owner: 'P0', lane: 2, revealed: true },
  ]);
  
  const res = revealPlayedCard(s0, 'c5' as CardId, manifest, createRng('sapper-move-3'));
  const sappCard = getCardState(res.state, 'c5' as CardId)!;
  eq(sappCard.lane, 1, 'MOVE: sapper stays in lane 1 (no empty lanes)');
  const moveEvent = res.events.find((e) => e.type === 'CARD_MOVED');
  truthy(moveEvent === undefined, 'MOVE: no CARD_MOVED event (no valid move)');
}

// -- MOVE_CARD_TO_ZONE: existing card can be relocated non-semantically ------

{
  const bouncer = mkCard('bouncer', 0, 0, {
    abilities: {
      onReveal: [{
        kind: 'MOVE_CARD_TO_ZONE',
        target: { kind: 'SELF' },
        destination: { kind: 'HAND' },
      }],
    },
  });
  const manifest = mkManifest([bouncer]);
  const s0 = buildState([{ def: 'bouncer', owner: 'P0', lane: 0, revealed: false }]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('move-zone'));
  truthy(res.events.some((e) => e.type === 'CARD_MOVED_TO_ZONE'), 'MOVE_CARD_TO_ZONE: emits CARD_MOVED_TO_ZONE');
  eq(getCardState(res.state, 'c1' as CardId)?.zone, 'HAND', 'MOVE_CARD_TO_ZONE: card moved to hand');
  eq(res.state.lanesById[0].cards.P0.length, 0, 'MOVE_CARD_TO_ZONE: card removed from lane');
  eq(res.state.hand.P0, ['c1'] as CardId[], 'MOVE_CARD_TO_ZONE: card appears in hand');
}

// -- SPELL cards resolve, then banish ---------------------------------------

{
  const pulse = mkCard('pulse', 0, 1, {
    cardType: 'spell',
    abilities: {
      onReveal: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 2 },
      }],
    },
  });
  const manifest = mkManifest([pulse]);
  const s0 = buildState([{ def: 'pulse', owner: 'P0', lane: 0, revealed: false }]);
  const res = revealPlayedCard(s0, 'c1' as CardId, manifest, createRng('spell-cleanup'));
  const banish = res.events.find((e) => e.type === 'CARD_BANISHED');
  truthy(banish !== undefined, 'SPELL: emits CARD_BANISHED after reveal');
  eq(
    banish?.cause,
    { sourceId: 'c1' as CardId, effectKind: 'SYSTEM', reason: 'SPELL_RESOLVED' },
    'SPELL: records its game-rules cleanup reason',
  );
  eq(getCardState(res.state, 'c1' as CardId)?.zone, 'BANISHED', 'SPELL: zone becomes BANISHED');
  eq(res.state.lanesById[0].cards.P0.length, 0, 'SPELL: removed from lane after resolving');
}

// -- Exit -------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll evaluator tests passed.');
}

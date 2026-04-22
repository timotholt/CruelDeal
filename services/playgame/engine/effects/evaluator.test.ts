/**
 * Effect evaluator + revealCard tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/effects/evaluator.test.ts
 *
 * Each test builds a MatchState fixture + a small synthetic manifest,
 * fires revealCard (or evalEffect directly), and verifies the resulting
 * event stream and end-state.
 */

import { createRng } from '../rng';
import { evalEffect, revealCard, MAX_REVEAL_RECURSION } from './evaluator';
import type { CardDef, Manifest } from '../manifest/types';
import type {
  CardInstance,
  LaneState,
  LocationInstance,
  MatchState,
} from '../types/state';
import type { CardId, LaneIdx, LocationId, Owner } from '../types/ids';
import type { EffectExpr } from '../types/ability';
import { getCardPower } from '../projections';

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
  defId, version: 1, name: defId, basePower, cost, tribes: [], abilities: {},
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
  ...extra,
});

// mkLoc intentionally omitted — no location-authored OR effects in the
// Step 6 test surface. Re-introduce when we add location-sourced OR tests.

/** Compile a cards array into a valid Manifest shell. */
function mkManifest(cards: CardDef[]): Manifest {
  const byId = <T extends { defId: string }>(arr: T[]): Record<string, T> =>
    Object.fromEntries(arr.map(e => [e.defId, e]));
  return {
    version: 1,
    protocolVersion: 1,
    constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12 },
    cards: byId(cards),
    locations: {},
    disabled: { cards: [], locations: [] },
  };
}

let idCounter = 0;
const nextCardId = (): CardId => `c${++idCounter}` as CardId;

function blankLane(i: LaneIdx): LaneState {
  return { idx: i, location: null, locationRevealed: false, cards: { PLAYER: [], OPP: [] } };
}

interface CardSpec {
  def: string;
  owner: Owner;
  lane: LaneIdx | null;
  zone?: 'LANE' | 'HAND' | 'DECK';
  revealed?: boolean;
  powerDelta?: number;
}

function buildState(
  cardSpecs: CardSpec[],
  locSpecs: Partial<Record<LaneIdx, string>> = {},
  opts: { seed?: string; turn?: number } = {},
): MatchState {
  idCounter = 0;
  const cards: Record<CardId, CardInstance> = {};
  const hand: Record<Owner, CardInstance[]> = { PLAYER: [], OPP: [] };
  const deck: Record<Owner, CardInstance[]> = { PLAYER: [], OPP: [] };
  const lanes: [LaneState, LaneState, LaneState] = [blankLane(0), blankLane(1), blankLane(2)];

  for (const spec of cardSpecs) {
    const id = nextCardId();
    const zone = spec.zone ?? 'LANE';
    const inst: CardInstance = {
      id,
      defId: spec.def,
      version: 1,
      owner: spec.owner,
      lane: zone === 'LANE' ? spec.lane : null,
      zone,
      revealed: spec.revealed ?? (zone === 'LANE'),
      powerDelta: spec.powerDelta ?? 0,
      tags: [],
      textOverride: null,
      counters: {},
      spawnSource: { kind: 'DECK_CREATION' },
    };
    cards[id] = inst;
    if (zone === 'LANE' && spec.lane !== null) {
      (lanes[spec.lane].cards[spec.owner] as CardId[]).push(id);
    } else if (zone === 'HAND') {
      hand[spec.owner].push(inst);
    } else if (zone === 'DECK') {
      deck[spec.owner].push(inst);
    }
  }
  for (const laneStr of Object.keys(locSpecs)) {
    const laneIdx = Number(laneStr) as LaneIdx;
    const loc: LocationInstance = {
      id: `loc${laneIdx}` as LocationId,
      defId: locSpecs[laneIdx]!,
      lane: laneIdx,
      tags: [],
    };
    lanes[laneIdx] = { ...lanes[laneIdx], location: loc, locationRevealed: true };
  }
  return {
    turn: opts.turn ?? 3,
    maxEnergy: 3,
    phase: 'AWAITING_INTENT',
    seed: opts.seed ?? 'test-seed',
    priority: 'PLAYER',
    energy: { PLAYER: 0, OPP: 0 },
    deck,
    hand,
    cards,
    lanes,
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { PLAYER: null, OPP: null },
    result: null,
  };
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
    { def: 'hex-witch', owner: 'PLAYER', lane: 0, revealed: false },
    { def: 'grunt',     owner: 'PLAYER', lane: 0 },
    { def: 'grunt',     owner: 'PLAYER', lane: 0 },
  ]);
  const rng = createRng('hex-test');
  const res = revealCard(s0, 'c1' as CardId, manifest, rng);

  const flips = res.events.filter(e => e.type === 'CARD_FLIPPED');
  eq(flips.length, 1, 'Hex Witch: CARD_FLIPPED emitted once');

  const powerChanges = res.events.filter(e => e.type === 'CARD_POWER_CHANGED');
  eq(powerChanges.length, 1, 'Hex Witch: exactly one POWER_CHANGED (random 1 target)');
  truthy((powerChanges[0] as { delta: number }).delta === 1, 'Hex Witch: delta = +1');

  // Power projection picks up the delta.
  const buffed = (powerChanges[0] as { cardId: CardId }).cardId;
  eq(getCardPower(res.state, buffed, manifest), 4, 'target card power = 3 + 1 = 4');

  // Determinism check: same seed → same target.
  const res2 = revealCard(s0, 'c1' as CardId, manifest, createRng('hex-test'));
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
    { def: 'cosmo', owner: 'OPP',    lane: 0 },
    { def: 'pyro',  owner: 'PLAYER', lane: 0, revealed: false },
  ]);
  const rng = createRng('cosmo-test');
  const res = revealCard(s0, 'c2' as CardId, manifest, rng);

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
    { def: 'wong', owner: 'PLAYER', lane: 0 },
    { def: 'pyro', owner: 'PLAYER', lane: 0, revealed: false },
  ]);
  const res = revealCard(s0, 'c2' as CardId, manifest, createRng('wong-test'));
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
  const s0 = buildState([{ def: 'sapper', owner: 'PLAYER', lane: 0, revealed: false }]);
  const res = revealCard(s0, 'c1' as CardId, manifest, createRng('sapper'));
  const moved = res.events.find(e => e.type === 'CARD_MOVED') as { fromLane: LaneIdx; toLane: LaneIdx };
  truthy(!!moved, 'MOVE: CARD_MOVED emitted');
  eq(moved.fromLane, 0, 'MOVE: fromLane = 0');
  truthy(moved.toLane !== 0 && (moved.toLane === 1 || moved.toLane === 2), 'MOVE: toLane is another lane');
  eq(res.state.cards['c1' as CardId]?.lane, moved.toLane, 'MOVE: state.cards.lane updated');
  eq(res.state.lanes[0].cards.PLAYER.length, 0, 'MOVE: card removed from old lane');
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
    { def: 'gun',   owner: 'PLAYER', lane: 0, revealed: false },
    { def: 'grunt', owner: 'OPP',    lane: 0 },
    { def: 'grunt', owner: 'OPP',    lane: 0 },
  ]);
  const res = revealCard(s0, 'c1' as CardId, manifest, createRng('destroy'));
  const destroyed = res.events.filter(e => e.type === 'CARD_DESTROYED');
  eq(destroyed.length, 2, 'DESTROY: both opp grunts destroyed');
  eq(res.state.cards['c2' as CardId]?.zone, 'DESTROYED', 'zone = DESTROYED (not DISCARD)');
  eq(res.state.lanes[0].cards.OPP.length, 0, 'opp lane cleared');
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
  const s0 = buildState([{ def: 'tinkerer', owner: 'PLAYER', lane: 0, revealed: false }]);
  const res = revealCard(s0, 'c1' as CardId, manifest, createRng('spawn'));

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
  const s0 = buildState([{ def: 'recur', owner: 'PLAYER', lane: 0, revealed: false }]);
  const res = revealCard(s0, 'c1' as CardId, manifest, createRng('recur'));
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
    { def: 'helper', owner: 'PLAYER', lane: 0, revealed: false },
    { def: 'grunt',  owner: 'PLAYER', lane: null, zone: 'DECK' },
    { def: 'grunt',  owner: 'PLAYER', lane: null, zone: 'DECK' },
    { def: 'grunt',  owner: 'PLAYER', lane: null, zone: 'DECK' },
  ]);
  const res = revealCard(s0, 'c1' as CardId, manifest, createRng('draw'));
  const draws = res.events.filter(e => e.type === 'CARD_DRAWN');
  eq(draws.length, 2, 'DRAW: two CARD_DRAWN emitted');
  eq(res.state.hand.PLAYER.length, 2, 'DRAW: 2 cards in hand');
  eq(res.state.deck.PLAYER.length, 1, 'DRAW: 1 card remaining in deck');
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
  const s0 = buildState([{ def: 'seq', owner: 'PLAYER', lane: 0, revealed: false }]);
  const res = revealCard(s0, 'c1' as CardId, manifest, createRng('seq'));
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
  const sAlone = buildState([{ def: 'cond', owner: 'PLAYER', lane: 0, revealed: false }]);
  const rA = revealCard(sAlone, 'c1' as CardId, manifest, createRng('cond-a'));
  eq(getCardPower(rA.state, 'c1' as CardId, manifest), 1, 'CONDITIONAL: alone → +1');

  // Case B: with friend → then branch, +5.
  const sFriend = buildState([
    { def: 'cond',  owner: 'PLAYER', lane: 0, revealed: false },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
  ]);
  const rB = revealCard(sFriend, 'c1' as CardId, manifest, createRng('cond-b'));
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
    { def: 'fe',    owner: 'PLAYER', lane: 0, revealed: false },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
  ]);
  const res = revealCard(s0, 'c1' as CardId, manifest, createRng('fe'));
  // 3 friendlies → 3 ADD_POWERs → +3 on self. (FOREACH's inner ADD_POWER
  // targets SELF, which still refers to the OUTER self — the `fe` card.)
  eq(
    res.events.filter(e => e.type === 'CARD_POWER_CHANGED').length,
    3,
    'FOREACH: 3 iterations for 3 friendlies',
  );
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 3, 'FOREACH: self gained +3 total');
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
    { def: 'hex',   owner: 'PLAYER', lane: 0, revealed: false },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
  ]);
  const rA = revealCard(build(), 'c1' as CardId, manifest, createRng('pure'));
  const rB = revealCard(build(), 'c1' as CardId, manifest, createRng('pure'));
  eq(JSON.stringify(rA.events), JSON.stringify(rB.events), 'Purity: same seed ⇒ identical event stream');
}

// -- evalEffect directly: ADD_POWER with targetCtx re-anchoring ------------

{
  // Calling evalEffect directly (not through revealCard) for a POWER_ADD
  // targeting SAME_LANE SELF_OWNER: the per-target delta evaluation must
  // anchor SELF to the target, not the outer SELF.
  const grunt = mkCard('grunt', 3, 2);
  const manifest = mkManifest([grunt]);
  const s0 = buildState([
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
  ]);
  const rng = createRng('direct');
  const effect: EffectExpr = {
    kind: 'ADD_POWER',
    target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
    delta: { kind: 'LIT', n: 2 },
  };
  const ctx = {
    state: s0,
    manifest,
    self: 'c1' as CardId,
    selfKind: 'card' as const,
    selfLane: 0 as LaneIdx,
    selfOwner: 'PLAYER' as Owner,
    rng,
    source: { sourceId: 'c1' as CardId, effectKind: 'ON_REVEAL' as const },
    depth: 0,
  };
  const res = evalEffect(s0, effect, ctx, manifest);
  eq(res.events.length, 2, 'evalEffect direct: 2 targets buffed');
  eq(getCardPower(res.state, 'c1' as CardId, manifest), 5, 'evalEffect direct: self = 3+2');
  eq(getCardPower(res.state, 'c2' as CardId, manifest), 5, 'evalEffect direct: friend = 3+2');
}

// -- Exit -------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll evaluator tests passed.');
}

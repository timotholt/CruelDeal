/**
 * Projection library tests. See spec §5 and §13.
 *
 * All tests build a MatchState fixture by hand against a small synthetic
 * manifest, then verify projections. No apply() reducer is needed because
 * projections are pure reads.
 *
 * Run:
 *   npx tsx services/playgame/engine/projections/projections.test.ts
 */

import type { CardDef, LocationDef, Manifest } from '../manifest/types';
import type {
  CardInstance,
  CardTag,
  LaneState,
  LocationInstance,
  MatchState,
} from '../types/state';
import type { CardId, LaneIdx, LocationId, Owner } from '../types/ids';
import {
  getCardPower,
  getLanePower,
  getOnRevealMultiplier,
  isOnRevealDisabled,
  getPriority,
} from './index';

// ---- Tiny assertion shim ---------------------------------------------------

let failures = 0;
const pass = (label: string) => { console.log(`PASS: ${label}`); };
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail) : ''}`);
};
const eq = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(label);
  else fail(label, { actual, expected });
};
const truthy = (cond: boolean, label: string) => cond ? pass(label) : fail(label);

// ---- Fixture: small synthetic manifest -------------------------------------

const mkCard = (defId: string, basePower: number, cost: number, extra: Partial<CardDef> = {}): CardDef => ({
  defId,
  version: 1,
  name: defId,
  basePower,
  cost,
  tribes: [],
  abilities: {},
  cosmetic: {
    displayName: defId,
    flavorText: '',
    rulesText: '',
    art: { portrait: { path: '' } },
  },
  ...extra,
});

const mkLoc = (defId: string, extra: Partial<LocationDef> = {}): LocationDef => ({
  defId,
  version: 1,
  name: defId,
  rarity: 1,
  abilities: {},
  cosmetic: {
    displayName: defId,
    description: '',
    art: { map: { path: '' } },
  },
  ...extra,
});

const CARDS: Record<string, CardDef> = {
  // Plain vanilla.
  grunt: mkCard('grunt', 3, 2),

  // Ongoing: POWER_ADD same-lane self-owner +1 (Sentinel-like, includes self).
  sentinel: mkCard('sentinel', 5, 3, {
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
  }),

  // Ongoing: POWER_ADD same-lane self-owner exclude self +1 (Sky Marshal).
  skyMarshal: mkCard('skyMarshal', 8, 5, {
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'SAME_LANE',
          of: { kind: 'SELF' },
          ownerFilter: 'SELF_OWNER',
          exclude: { kind: 'SELF' },
        },
        delta: { kind: 'LIT', n: 1 },
        stack: 'ADDITIVE',
      }],
    },
  }),

  // Iron Man: LANE_POWER_MULTIPLIER x2 (self-owner only).
  ironMan: mkCard('ironMan', 0, 5, {
    abilities: {
      ongoing: [{
        kind: 'LANE_POWER_MULTIPLIER',
        laneScope: { laneOf: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
  }),

  // Wong: ON_REVEAL_MULTIPLIER x2 on same-lane self-owner OR effects.
  wong: mkCard('wong', 2, 4, {
    abilities: {
      ongoing: [{
        kind: 'ON_REVEAL_MULTIPLIER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      }],
    },
  }),

  // Onslaught (card): BOOST_ONGOINGS x2, self-owner, exclude self.
  onslaught: mkCard('onslaught', 8, 6, {
    abilities: {
      ongoing: [{
        kind: 'BOOST_ONGOINGS',
        scope: { laneOf: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        excludeSelf: true,
        stack: 'ADDITIVE',
      }],
    },
  }),

  // Cosmo: DISABLE_ON_REVEAL at same-lane ANY_OWNER.
  cosmo: mkCard('cosmo', 3, 3, {
    abilities: {
      ongoing: [{
        kind: 'DISABLE_ON_REVEAL',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        stack: 'SINGLE',
      }],
    },
  }),
};

const LOCS: Record<string, LocationDef> = {
  empty: mkLoc('empty'),

  // Cathedral: ON_REVEAL_MULTIPLIER x2 ANY_OWNER.
  cathedral: mkLoc('cathedral', {
    abilities: {
      ongoing: [{
        kind: 'ON_REVEAL_MULTIPLIER',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'MULTIPLICATIVE',
      }],
    },
  }),

  // Science Lab: LANE_POWER_MULTIPLIER x2 ANY_OWNER.
  scienceLab: mkLoc('scienceLab', {
    abilities: {
      ongoing: [{
        kind: 'LANE_POWER_MULTIPLIER',
        laneScope: { laneOf: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
  }),

  // Jungle Trail: POWER_ADD +1 per other friendly here.
  jungleTrail: mkLoc('jungleTrail', {
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        delta: {
          kind: 'COUNT',
          of: {
            kind: 'SAME_LANE',
            of: { kind: 'SELF' },
            ownerFilter: 'SELF_OWNER',
            exclude: { kind: 'SELF' },
          },
        },
        stack: 'ADDITIVE',
      }],
    },
  }),

  // Citadel: BOOST_ONGOINGS x2 ANY_OWNER.
  citadel: mkLoc('citadel', {
    abilities: {
      ongoing: [{
        kind: 'BOOST_ONGOINGS',
        scope: { laneOf: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
        factor: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
  }),
};

const MANIFEST: Manifest = {
  version: 1,
  protocolVersion: 1,
  constants: { energyCurve: [1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12 },
  cards: CARDS,
  locations: LOCS,
  disabled: { cards: [], locations: [] },
};

// ---- State builder ---------------------------------------------------------

let idCounter = 0;
const nextId = (): CardId => `card${++idCounter}` as CardId;

interface CardSpec {
  def: string;
  owner: Owner;
  lane: LaneIdx;
  revealed?: boolean;      // default true
  tags?: CardTag[];
}

function buildState(
  cardSpecs: CardSpec[],
  locSpecs: Partial<Record<LaneIdx, { def: string; revealed?: boolean }>> = {},
  opts: { seed?: string; turn?: number } = {},
): MatchState {
  idCounter = 0;
  const cards: Record<CardId, CardInstance> = {};
  const lanesCards: [LaneState, LaneState, LaneState] = [
    blankLane(0), blankLane(1), blankLane(2),
  ];
  for (const spec of cardSpecs) {
    const id = nextId();
    const inst: CardInstance = {
      id,
      defId: spec.def,
      version: 1,
      owner: spec.owner,
      lane: spec.lane,
      zone: 'LANE',
      revealed: spec.revealed ?? true,
      powerDelta: 0,
      tags: spec.tags ?? [],
      textOverride: null,
      counters: {},
      spawnSource: { kind: 'SYSTEM' },
    };
    cards[id] = inst;
    (lanesCards[spec.lane].cards[spec.owner] as CardId[]).push(id);
  }
  for (const laneStr of Object.keys(locSpecs)) {
    const laneIdx = Number(laneStr) as LaneIdx;
    const ls = locSpecs[laneIdx]!;
    const loc: LocationInstance = {
      id: `loc${laneIdx}` as LocationId,
      defId: ls.def,
      lane: laneIdx,
      tags: [],
    };
    lanesCards[laneIdx] = {
      ...lanesCards[laneIdx],
      location: loc,
      locationRevealed: ls.revealed ?? true,
    };
  }
  return {
    turn: opts.turn ?? 3,
    maxEnergy: 3,
    phase: 'AWAITING_INTENT',
    seed: opts.seed ?? 'test-seed',
    priority: 'PLAYER',
    energy: { PLAYER: 0, OPP: 0 },
    deck: { PLAYER: [], OPP: [] },
    hand: { PLAYER: [], OPP: [] },
    cards,
    lanes: lanesCards,
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { PLAYER: null, OPP: null },
    result: null,
  };
}

function blankLane(i: LaneIdx): LaneState {
  return {
    idx: i,
    location: null,
    locationRevealed: false,
    cards: { PLAYER: [], OPP: [] },
  };
}

function firstCard(state: MatchState, owner: Owner, lane: LaneIdx): CardId {
  return state.lanes[lane].cards[owner][0];
}

// ============================================================================
// Tests
// ============================================================================

// -- getCardPower basic ------------------------------------------------------

{
  const s = buildState([{ def: 'grunt', owner: 'PLAYER', lane: 0 }]);
  eq(getCardPower(s, firstCard(s, 'PLAYER', 0), MANIFEST), 3, 'vanilla card reports base power');
}

// -- Sentinel buffs its own lane (including self) ---------------------------

{
  const s = buildState([
    { def: 'sentinel', owner: 'PLAYER', lane: 0 },
    { def: 'grunt',    owner: 'PLAYER', lane: 0 },
    { def: 'grunt',    owner: 'PLAYER', lane: 0 },
  ]);
  const cards = s.lanes[0].cards.PLAYER;
  eq(getCardPower(s, cards[0], MANIFEST), 6, 'sentinel +1 self (5->6)');
  eq(getCardPower(s, cards[1], MANIFEST), 4, 'sentinel +1 grunt (3->4)');
  eq(getCardPower(s, cards[2], MANIFEST), 4, 'sentinel +1 grunt (3->4)');
  eq(getLanePower(s, 0, 'PLAYER', MANIFEST), 14, 'lane power = 6+4+4 = 14');
}

// -- Sky Marshal excludes self ----------------------------------------------

{
  const s = buildState([
    { def: 'skyMarshal', owner: 'PLAYER', lane: 0 },
    { def: 'grunt',      owner: 'PLAYER', lane: 0 },
  ]);
  const cards = s.lanes[0].cards.PLAYER;
  eq(getCardPower(s, cards[0], MANIFEST), 8, 'sky marshal does NOT buff self');
  eq(getCardPower(s, cards[1], MANIFEST), 4, 'sky marshal buffs friendly (3->4)');
}

// -- Ongoings ignore unrevealed / wrong-zone sources ------------------------

{
  const s = buildState([
    { def: 'sentinel', owner: 'PLAYER', lane: 0, revealed: false },
    { def: 'grunt',    owner: 'PLAYER', lane: 0 },
  ]);
  const grunt = s.lanes[0].cards.PLAYER[1];
  eq(getCardPower(s, grunt, MANIFEST), 3, 'face-down sentinel does NOT emit ongoings');
}

// -- Iron Man doubles lane total (self-owner only) --------------------------

{
  const s = buildState([
    { def: 'grunt',   owner: 'PLAYER', lane: 0 },
    { def: 'grunt',   owner: 'PLAYER', lane: 0 },
    { def: 'ironMan', owner: 'PLAYER', lane: 0 },
    { def: 'grunt',   owner: 'OPP',    lane: 0 },
  ]);
  eq(getLanePower(s, 0, 'PLAYER', MANIFEST), (3 + 3 + 0) * 2, 'Iron Man: (3+3+0)*2 = 12');
  eq(getLanePower(s, 0, 'OPP',    MANIFEST), 3, 'Iron Man does NOT affect opponent side');
}

// -- Shang-Chi sanity: getCardPower ignores lane mult -----------------------

{
  const s = buildState([
    { def: 'grunt',   owner: 'PLAYER', lane: 0 },
    { def: 'ironMan', owner: 'PLAYER', lane: 0 },
  ]);
  const grunt = s.lanes[0].cards.PLAYER[0];
  eq(getCardPower(s, grunt, MANIFEST), 3, 'per-card power ignores Iron Man lane mult (Shang-Chi check)');
}

// -- Wong multiplies OR for friendlies in his lane --------------------------

{
  const s = buildState([
    { def: 'wong',  owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'OPP',    lane: 0 },
  ]);
  const myGrunt  = s.lanes[0].cards.PLAYER[1];
  const oppGrunt = s.lanes[0].cards.OPP[0];
  eq(getOnRevealMultiplier(s, myGrunt,  MANIFEST), 2, 'Wong gives friendlies ×2 OR');
  eq(getOnRevealMultiplier(s, oppGrunt, MANIFEST), 1, 'Wong does NOT buff opponent OR');
}

// -- Cathedral location multiplies OR for BOTH sides ------------------------

{
  const s = buildState(
    [{ def: 'grunt', owner: 'PLAYER', lane: 1 }, { def: 'grunt', owner: 'OPP', lane: 1 }],
    { 1: { def: 'cathedral' } },
  );
  const p = s.lanes[1].cards.PLAYER[0];
  const o = s.lanes[1].cards.OPP[0];
  eq(getOnRevealMultiplier(s, p, MANIFEST), 2, 'Cathedral ×2 OR for PLAYER');
  eq(getOnRevealMultiplier(s, o, MANIFEST), 2, 'Cathedral ×2 OR for OPP');
}

// -- Science Lab doubles BOTH sides' lane power -----------------------------

{
  const s = buildState(
    [{ def: 'grunt', owner: 'PLAYER', lane: 2 }, { def: 'grunt', owner: 'OPP', lane: 2 }],
    { 2: { def: 'scienceLab' } },
  );
  eq(getLanePower(s, 2, 'PLAYER', MANIFEST), 6, 'Science Lab ×2 for PLAYER (3*2)');
  eq(getLanePower(s, 2, 'OPP',    MANIFEST), 6, 'Science Lab ×2 for OPP (3*2)');
}

// -- Jungle Trail: dynamic COUNT delta --------------------------------------

{
  // Player has 3 cards here → each gets +2 (count of other friendlies).
  // Opp has 1 card → +0.
  const s = buildState(
    [
      { def: 'grunt', owner: 'PLAYER', lane: 0 },
      { def: 'grunt', owner: 'PLAYER', lane: 0 },
      { def: 'grunt', owner: 'PLAYER', lane: 0 },
      { def: 'grunt', owner: 'OPP',    lane: 0 },
    ],
    { 0: { def: 'jungleTrail' } },
  );
  const p0 = s.lanes[0].cards.PLAYER[0];
  const o0 = s.lanes[0].cards.OPP[0];
  eq(getCardPower(s, p0, MANIFEST), 3 + 2, 'Jungle Trail: player card +2 (3 friendlies, -1 self)');
  eq(getCardPower(s, o0, MANIFEST), 3 + 0, 'Jungle Trail: lone opp card +0');
}

// -- Iron Man + Onslaught → ×4 (additive stacking) --------------------------

{
  const s = buildState([
    { def: 'grunt',     owner: 'PLAYER', lane: 0 },
    { def: 'grunt',     owner: 'PLAYER', lane: 0 },
    { def: 'ironMan',   owner: 'PLAYER', lane: 0 },
    { def: 'onslaught', owner: 'PLAYER', lane: 0 },
  ]);
  // Base per-card power at lane: 3 + 3 + 0 + 8 = 14. Iron Man factor 2 × agg 2 = 4. Total = 56.
  eq(getLanePower(s, 0, 'PLAYER', MANIFEST), 14 * 4, 'Iron Man + Onslaught ⇒ lane ×4 (spec §13)');
}

// -- Onslaught excludeSelf: Onslaught does NOT boost itself, OR chain -------

{
  // Two Onslaughts at same lane (via hypothetical Mystique). Each boosts
  // the OTHER but not itself. Onslaught's own BOOST_ONGOINGS is a boost
  // (not a boost target) so Rule 1 prevents mutual amplification too.
  // Iron Man with 2 Onslaughts → agg = 1 + 1 + 1 = 3 → ×6.
  const s = buildState([
    { def: 'grunt',     owner: 'PLAYER', lane: 0 },
    { def: 'ironMan',   owner: 'PLAYER', lane: 0 },
    { def: 'onslaught', owner: 'PLAYER', lane: 0 },
    { def: 'onslaught', owner: 'PLAYER', lane: 0 },
  ]);
  eq(getLanePower(s, 0, 'PLAYER', MANIFEST), (3 + 0 + 8 + 8) * 6, 'Iron Man + 2 Onslaughts ⇒ ×6');
}

// -- Citadel + Wong + Panther math (spec §13 row 3) -------------------------

{
  // Citadel boosts Wong's ON_REVEAL_MULTIPLIER: 2 × agg 2 = 4.
  // For a card at Citadel's lane with Wong present, OR mult = 4.
  const s = buildState(
    [
      { def: 'wong',  owner: 'PLAYER', lane: 0 },
      { def: 'grunt', owner: 'PLAYER', lane: 0 },
    ],
    { 0: { def: 'citadel' } },
  );
  const grunt = s.lanes[0].cards.PLAYER[1];
  eq(getOnRevealMultiplier(s, grunt, MANIFEST), 4, 'Citadel × Wong ⇒ OR multiplier = 4');
}

// -- Rule 2: Citadel alone does not boost itself ----------------------------

{
  // Empty lane with only Citadel. Its own BOOST_ONGOINGS shouldn't somehow
  // amplify. And since there are no card ongoings to boost, the world is
  // indistinguishable from an empty lane.
  const s = buildState([], { 1: { def: 'citadel' } });
  eq(getLanePower(s, 1, 'PLAYER', MANIFEST), 0, 'Citadel alone ⇒ lane power 0 (no self-boost)');
}

// -- Rule 1: Onslaught + Citadel stack additively (NOT multiplicatively) ---

{
  // Onslaught (+1 agg), Citadel (+1 agg) → Iron Man agg = 3 → ×6.
  // If they compounded, we'd see agg 4 → ×8.
  const s = buildState(
    [
      { def: 'grunt',     owner: 'PLAYER', lane: 0 },
      { def: 'ironMan',   owner: 'PLAYER', lane: 0 },
      { def: 'onslaught', owner: 'PLAYER', lane: 0 },
    ],
    { 0: { def: 'citadel' } },
  );
  eq(getLanePower(s, 0, 'PLAYER', MANIFEST), (3 + 0 + 8) * 6, 'Iron Man + Onslaught + Citadel ⇒ ×6 (Rule 1)');
}

// -- Cosmo disables ORs on BOTH sides of its lane ---------------------------

{
  const s = buildState([
    { def: 'cosmo', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'OPP',    lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 1 },
  ]);
  const hereP  = s.lanes[0].cards.PLAYER[1];
  const hereO  = s.lanes[0].cards.OPP[0];
  const other  = s.lanes[1].cards.PLAYER[0];
  truthy(isOnRevealDisabled(s, hereP, MANIFEST),  'Cosmo disables PLAYER OR at this lane');
  truthy(isOnRevealDisabled(s, hereO, MANIFEST),  'Cosmo disables OPP OR at this lane');
  truthy(!isOnRevealDisabled(s, other, MANIFEST), 'Cosmo does NOT reach other lanes');
}

// -- Priority: MORE_LANES wins over totals ----------------------------------

{
  // Player wins lanes 0 and 1 by a hair; loses 2 by a lot. Player should
  // still get priority because they hold 2 > 1 lanes.
  const s = buildState([
    { def: 'grunt', owner: 'PLAYER', lane: 0 },
    { def: 'grunt', owner: 'PLAYER', lane: 1 },
    { def: 'grunt', owner: 'OPP',    lane: 2 },
    { def: 'grunt', owner: 'OPP',    lane: 2 },
    { def: 'grunt', owner: 'OPP',    lane: 2 },
  ]);
  const pr = getPriority(s, MANIFEST);
  eq(pr.owner,  'PLAYER',     'priority: PLAYER wins on lane count');
  eq(pr.reason, 'MORE_LANES', 'priority reason: MORE_LANES');
}

// -- Priority: MORE_POWER tiebreak ------------------------------------------

{
  // 1 lane each, but player has more total power.
  const s = buildState([
    { def: 'sentinel', owner: 'PLAYER', lane: 0 },   // +1 self = 6
    { def: 'grunt',    owner: 'OPP',    lane: 2 },   // 3
  ]);
  const pr = getPriority(s, MANIFEST);
  eq(pr.owner,  'PLAYER',     'priority: PLAYER wins on total power');
  eq(pr.reason, 'MORE_POWER', 'priority reason: MORE_POWER');
}

// -- Priority: full tie → deterministic COIN_FLIP ---------------------------

{
  const s1 = buildState([], {}, { seed: 'tie-seed', turn: 1 });
  const s2 = buildState([], {}, { seed: 'tie-seed', turn: 1 });
  const pr1 = getPriority(s1, MANIFEST);
  const pr2 = getPriority(s2, MANIFEST);
  eq(pr1.owner,  pr2.owner,   'priority COIN_FLIP is deterministic per (seed, turn)');
  eq(pr1.reason, 'COIN_FLIP', 'priority reason: COIN_FLIP on full tie');
}

// -- Priority: different turn → potentially different flip ------------------

{
  const s1 = buildState([], {}, { seed: 'tie-seed', turn: 1 });
  const s2 = buildState([], {}, { seed: 'tie-seed', turn: 2 });
  const pr1 = getPriority(s1, MANIFEST);
  const pr2 = getPriority(s2, MANIFEST);
  // Both deterministic; we don't assert WHICH owner — just that the
  // fork tag meaningfully changes the RNG stream (may or may not differ).
  eq(pr1.reason, 'COIN_FLIP', 'priority T1: COIN_FLIP');
  eq(pr2.reason, 'COIN_FLIP', 'priority T2: COIN_FLIP');
  truthy(typeof pr1.owner === 'string' && typeof pr2.owner === 'string', 'both pick a concrete owner');
}

// -- SHURI_DOUBLED tag doubles per-card power -------------------------------

{
  const s = buildState([{
    def: 'grunt',
    owner: 'PLAYER',
    lane: 0,
    tags: [{ kind: 'SHURI_DOUBLED' }],
  }]);
  const id = firstCard(s, 'PLAYER', 0);
  eq(getCardPower(s, id, MANIFEST), 6, 'SHURI_DOUBLED ⇒ base × 2');
}

// -- Exit --------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll projection tests passed.');
}

import type { CardDef, LocationDef, Manifest } from './manifest/types';
import type { CardId, LaneId, Owner } from './types/ids';
import type { CardInstance, MatchState } from './types/state';
import type { MatchEvent } from './types/events';
import { apply } from './apply';
import { resolve, resolveTurn } from './resolve';
import { createRng } from './rng';

const pass = (label: string) => console.log(`PASS: ${label}`);
const fail = (label: string, extra?: unknown): never => {
  console.error(`FAIL: ${label}`);
  if (extra !== undefined) console.error(extra);
  process.exitCode = 1;
  throw new Error(label);
};
const expectEq = <T>(actual: T, expected: T, label: string) =>
  JSON.stringify(actual) === JSON.stringify(expected) ? pass(label) : fail(label, { actual, expected });
const expectTrue = (cond: boolean, label: string) => cond ? pass(label) : fail(label);

const basicCard = (defId: string, abilities: CardDef['abilities'] = {}): CardDef => ({
  defId,
  version: 1,
  name: defId,
  basePower: 2,
  cost: 1,
  cardType: 'character',
  abilities,
  cosmetic: { displayName: defId, flavorText: '', rulesText: '', art: { portrait: { path: '' } } },
});

const manifest = (locations: LocationDef[], cards: CardDef[]): Manifest => ({
  version: 1,
  protocolVersion: 1,
  constants: { energyCurve: [0, 1, 2, 3, 4, 5, 6], turnLimit: 6, handCap: 7, laneCapacity: 4, deckSize: 12, startingHandSize: 3, turnStartDraw: 1 },
  rulesets: { standard: {
    rulesetId: 'standard',
    deckConstruction: { defaultCopyLimit: 1 },
    laneRules: { initialLaneCount: 3, maximumActiveLaneCount: 3 },
    locationDeck: { minimumReserveCount: 0, copyLimit: 1 },
  } },
  cards: Object.fromEntries(cards.map(c => [c.defId, c])),
  locations: Object.fromEntries(locations.map(l => [l.defId, l])),
  disabled: { cards: [], locations: [] },
});

const loc = (defId: string, abilities: LocationDef['abilities']): LocationDef => ({
  defId,
  version: 1,
  name: defId,
  rarity: 1,
  abilities,
  cosmetic: { displayName: defId, description: defId, art: { map: { path: '' } } },
});

let idSeq = 0;
const card = (defId: string, owner: Owner, zone: CardInstance['zone'], lane: LaneId | null = null): CardInstance => ({
  id: `${defId}-${++idSeq}` as CardId,
  defId,
  version: 1,
  owner,
  lane,
  zone,
  revealed: zone === 'LANE',
  powerDelta: 0,
  costDelta: 0,
  powerLog: [],
  costLog: [],
  tags: [],
  textOverride: null,
  counters: {},
  spawnSource: { kind: 'DECK_CREATION' },
});

const stateWith = (cards: CardInstance[], location: LocationDef, turn = 1): MatchState => {
  const lane = (idx: LaneId) => ({
    idx: idx as LaneId,
    location: idx === 0 ? { id: 'loc-0' as any, defId: location.defId, lane: 0 as LaneId, tags: [] } : null,
    locationRevealed: idx === 0,
    cards: {
      P0: cards.filter(c => c.zone === 'LANE' && c.lane === idx && c.owner === 'P0').map(c => c.id),
      P1: cards.filter(c => c.zone === 'LANE' && c.lane === idx && c.owner === 'P1').map(c => c.id),
    },
  });
  const lanes: MatchState['lanes'] = [lane(0), lane(1), lane(2)];
  return {
    turn,
    maxEnergy: { P0: turn, P1: turn },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed: 'location-primitives',
    priority: 'P0',
    energy: { P0: 10, P1: 10 },
    deck: { P0: [], P1: [] },
    hand: {
      P0: cards.filter(c => c.zone === 'HAND' && c.owner === 'P0'),
      P1: cards.filter(c => c.zone === 'HAND' && c.owner === 'P1'),
    },
    cards: Object.fromEntries(cards.map(c => [c.id, c])),
    lanes,
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { P0: null, P1: null },
    result: null,
    energyLog: { P0: [], P1: [] },
    trackedVariables: {
      totalCardsDestroyed: 0,
      P0: {
        cardsYouDestroyed: 0, yourCardsDestroyed: 0, enemyCardsDestroyed: 0, cardsYouCreated: 0,
        cardsYouDiscarded: 0, cardsMoved: 0, cardsPlayedThisTurn: 0, cardsPlayedLastTurn: 0,
        energySpentLastTurn: 0, energyUnspentLastTurn: 0, energyUnspentNow: 10, totalCostReduced: 0,
        playedNoCardsLastTurn: false, spentAllEnergyLastTurn: false, hadUnspentEnergyLastTurn: false,
        spentNoEnergyLastTurn: false, reducedAnyCostThisGame: false,
      },
      P1: {
        cardsYouDestroyed: 0, yourCardsDestroyed: 0, enemyCardsDestroyed: 0, cardsYouCreated: 0,
        cardsYouDiscarded: 0, cardsMoved: 0, cardsPlayedThisTurn: 0, cardsPlayedLastTurn: 0,
        energySpentLastTurn: 0, energyUnspentLastTurn: 0, energyUnspentNow: 10, totalCostReduced: 0,
        playedNoCardsLastTurn: false, spentAllEnergyLastTurn: false, hadUnspentEnergyLastTurn: false,
        spentNoEnergyLastTurn: false, reducedAnyCostThisGame: false,
      },
    },
  };
};

const replay = (state: MatchState, events: readonly MatchEvent[], m: Manifest) =>
  events.reduce((s, e) => apply(s, e, m), state);

{
  const grunt = basicCard('grunt');
  const meat = loc('meat', {
    onCardPlayedHere: [{
      kind: 'CONDITIONAL',
      if: { kind: 'NUM_CMP', a: { kind: 'LOCATION_COUNTER', name: 'first' }, op: '==', b: { kind: 'LIT', n: 0 } },
      then: [
        { kind: 'DESTROY', target: { kind: 'EVENT_CARD' } },
        { kind: 'MODIFY_LOCATION_COUNTER', lane: { kind: 'SELF' }, name: 'first', delta: { kind: 'LIT', n: 1 } },
      ],
    }],
  });
  const c1 = card('grunt', 'P0', 'HAND');
  const c2 = card('grunt', 'P0', 'HAND');
  const m = manifest([meat], [grunt]);
  let s = stateWith([c1, c2], meat);
  s = replay(s, resolve(s, { type: 'STAGE_CARD', intentId: 'a', owner: 'P0', cardId: c1.id, lane: 0 }, createRng('a'), m), m);
  s = replay(s, resolve(s, { type: 'STAGE_CARD', intentId: 'b', owner: 'P0', cardId: c2.id, lane: 0 }, createRng('b'), m), m);
  const out = resolveTurn(s, m, createRng('meat'));
  expectEq(out.state.cards[c1.id]?.zone, 'DESTROYED', 'location onCardPlayedHere can destroy EVENT_CARD');
  expectEq(out.state.cards[c2.id]?.zone, 'LANE', 'location counter prevents second destroy');
}

{
  const spark = basicCard('spark', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const backdoor = loc('backdoor', {
    onCardPlayedHere: [{
      kind: 'CONDITIONAL',
      if: { kind: 'NUM_CMP', a: { kind: 'LOCATION_COUNTER', name: 'played-here', owner: 'EVENT_OWNER' }, op: '==', b: { kind: 'LIT', n: 0 } },
      then: [
        { kind: 'TRIGGER_ON_REVEAL', target: { kind: 'EVENT_CARD' } },
        { kind: 'MODIFY_LOCATION_COUNTER', lane: { kind: 'SELF' }, name: 'played-here', owner: 'EVENT_OWNER', delta: { kind: 'LIT', n: 1 } },
      ],
    }],
  });
  const c = card('spark', 'P0', 'HAND');
  const m = manifest([backdoor], [spark]);
  let s = stateWith([c], backdoor);
  s = replay(s, resolve(s, { type: 'STAGE_CARD', intentId: 'backdoor', owner: 'P0', cardId: c.id, lane: 0 }, createRng('backdoor-stage'), m), m);
  const out = resolveTurn(s, m, createRng('backdoor-turn'));
  expectEq(out.state.cards[c.id]?.powerDelta, 4, 'TRIGGER_ON_REVEAL re-fires On Reveal once without replaying location play trigger');
  expectEq(out.state.lanes[0].location?.counters?.['P0:played-here'], 1, 'location play counter increments once after retrigger');
}

{
  const grunt = basicCard('grunt');
  const beach = loc('beach', {
    ongoing: [{
      kind: 'BLOCK_PLAY',
      laneOf: { kind: 'SELF' },
      when: { kind: 'NUM_CMP', a: { kind: 'CURRENT_TURN' }, op: '>', b: { kind: 'LIT', n: 5 } },
      stack: 'SINGLE',
    }],
  });
  const c = card('grunt', 'P0', 'HAND');
  const m = manifest([beach], [grunt]);
  const s = stateWith([c], beach, 6);
  const events = resolve(s, { type: 'STAGE_CARD', intentId: 'blocked', owner: 'P0', cardId: c.id, lane: 0 }, createRng('block'), m);
  expectEq(events[0]?.type, 'INTENT_REJECTED', 'BLOCK_PLAY rejects staging when predicate is true');
}

{
  const revealer = basicCard('revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const bank = loc('bank', {
    ongoing: [{ kind: 'DELAY_REVEAL', target: { kind: 'SAME_LANE', of: { kind: 'SELF' } }, until: 'END_OF_GAME', stack: 'SINGLE' }],
  });
  const c = card('revealer', 'P0', 'HAND');
  const m = manifest([bank], [revealer]);
  let s = stateWith([c], bank, 5);
  s = replay(s, resolve(s, { type: 'STAGE_CARD', intentId: 'delay', owner: 'P0', cardId: c.id, lane: 0 }, createRng('delay'), m), m);
  const beforeEnd = resolveTurn(s, m, createRng('delay-turn-5'));
  expectEq(beforeEnd.state.cards[c.id]?.revealed, false, 'DELAY_REVEAL keeps card face-down before end game');
  const end = resolveTurn(beforeEnd.state, m, createRng('delay-turn-6'));
  expectEq(end.state.cards[c.id]?.revealed, true, 'DELAY_REVEAL force-reveals at end game');
  expectEq(end.state.cards[c.id]?.powerDelta, 2, 'end-game force reveal fires On Reveal');
}

console.log('\nAll location primitive tests passed.');

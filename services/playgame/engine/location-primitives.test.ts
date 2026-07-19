import { getCardState } from './projections/cardRuntime';
import type { CardDef, LocationCardDef, Manifest } from './manifest/types';
import type { CardId, LaneId, Owner } from './types/ids';
import type { InternalCardRecord, MatchState } from './types/state';
import type { MatchEvent } from './types/events';
import { apply } from './apply';
import { resolve, resolveTurn } from './resolve';
import { createRng } from './rng';
import {
  emptyTestMatchState,
  testLaneRegistry,
  testLaneState,
  withTestLocation,
} from './testkit/runtimeFixture';
import { locationCardAtLane } from './laneTopology';
import { getStoredCardPowerDelta } from './powerLedger';
import { getFinalTurn } from './projections/gameEnd';

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

const manifest = (locations: LocationCardDef[], cards: CardDef[]): Manifest => ({
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

const loc = (defId: string, abilities: LocationCardDef['abilities']): LocationCardDef => ({
  defId,
  version: 1,
  name: defId,
  rarity: 1,
  abilities,
  cosmetic: { displayName: defId, description: defId, art: { map: { path: '' } } },
});

let idSeq = 0;
const card = (defId: string, owner: Owner, zone: InternalCardRecord['zone'], lane: LaneId | null = null): InternalCardRecord => ({
  id: `${defId}-${++idSeq}` as CardId,
  defId,
  version: 1,
  owner,
  lane,
  zone,
  revealed: zone === 'LANE',
  revealTiming: null,
  powerLedger: [],
  costDelta: 0,
    costLog: [],
  tags: [],
  textOverride: null,
    textLog: [],
  counters: {},
  spawnSource: { kind: 'DECK_CREATION' },
});

const stateWith = (cards: InternalCardRecord[], location: LocationCardDef, turn = 1): MatchState => {
  const lane = (id: LaneId) => testLaneState(id, {
      P0: cards.filter(c => c.zone === 'LANE' && c.lane === id && c.owner === 'P0').map(c => c.id),
      P1: cards.filter(c => c.zone === 'LANE' && c.lane === id && c.owner === 'P1').map(c => c.id),
  });
  const lanes = [lane(0), lane(1), lane(2)];
  return withTestLocation(emptyTestMatchState({
    turn,
    maxEnergy: { P0: turn, P1: turn },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    phase: 'AWAITING_INTENT',
    seed: 'location-primitives',
    priority: 'P0',
    energy: { P0: 10, P1: 10 },
    deck: { P0: [], P1: [] },
    hand: {
      P0: cards.filter(c => c.zone === 'HAND' && c.owner === 'P0').map(c => c.id),
      P1: cards.filter(c => c.zone === 'HAND' && c.owner === 'P1').map(c => c.id),
    },
    cards: Object.fromEntries(cards.map(c => [c.id, c])),
    lanesById: testLaneRegistry(lanes),
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
  }), 0, location.defId, true, 'loc-0' as any);
};

const replay = (state: MatchState, events: readonly MatchEvent[], m: Manifest) =>
  events.reduce((s, e) => apply(s, e, m), state);
const resolveCurrentTurn = (state: MatchState, m: Manifest, seed: string) =>
  resolveTurn(
    apply(state, { type: 'TURN_RESOLUTION_STARTED', turn: state.turn }, m),
    m,
    createRng(seed),
  );

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
  const out = resolveCurrentTurn(s, m, 'meat');
  expectEq(getCardState(out.state, c1.id)!?.zone, 'DESTROYED', 'location onCardPlayedHere can destroy EVENT_CARD');
  expectEq(getCardState(out.state, c2.id)!?.zone, 'LANE', 'location counter prevents second destroy');
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
  const out = resolveCurrentTurn(s, m, 'backdoor-turn');
  expectEq(getStoredCardPowerDelta(out.state, c.id, m), 4, 'TRIGGER_ON_REVEAL re-fires On Reveal once without replaying location play trigger');
  expectEq(
    locationCardAtLane(out.state, 0)?.counters['P0:played-here'],
    1,
    'location play counter increments once after retrigger',
  );
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
  const revealer = basicCard('next-turn-revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const waitingRoom = loc('waiting-room', {
    onCardEnteredHere: [{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: {
        kind: 'TURN',
        turn: {
          kind: 'ADD',
          a: { kind: 'CURRENT_TURN' },
          b: { kind: 'LIT', n: 1 },
        },
      },
    }],
  });
  const c = card('next-turn-revealer', 'P0', 'HAND');
  const m = manifest([waitingRoom], [revealer]);
  let s = stateWith([c], waitingRoom, 1);
  s = replay(s, resolve(s, { type: 'STAGE_CARD', intentId: 'next-turn', owner: 'P0', cardId: c.id, lane: 0 }, createRng('next-turn'), m), m);
  expectEq(getCardState(s, c.id)!?.revealTiming, { kind: 'TURN', turn: 2 }, 'location can schedule a card for a real future turn');
  const afterOne = resolveCurrentTurn(s, m, 'next-turn-1');
  expectEq(getCardState(afterOne.state, c.id)!?.revealed, false, 'future-turn card remains hidden before its scheduled turn');
  const afterTwo = resolveCurrentTurn(afterOne.state, m, 'next-turn-2');
  expectEq(getCardState(afterTwo.state, c.id)!?.revealed, true, 'future-turn card reveals during its scheduled real turn');
}

{
  const limbo = loc('limbo', {
    ongoing: [{
      kind: 'EXTEND_GAME_TURNS',
      turns: { kind: 'LIT', n: 1 },
      stack: 'MAX',
    }],
  });
  const ruin = loc('ruin', {});
  const m = manifest([limbo, ruin], []);
  const extended = stateWith([], limbo, 6);
  expectEq(getFinalTurn(extended, m), 7, 'live Limbo-style location extends the final turn to 7');
  const turnSeven = resolveCurrentTurn(extended, m, 'limbo-active');
  expectEq(turnSeven.state.turn, 7, 'active extension starts a real turn 7');
  expectEq(turnSeven.state.result, null, 'active extension prevents the turn-6 match result');

  const replaced = withTestLocation(extended, 0, 'ruin', true, 'ruin-0' as any);
  expectEq(getFinalTurn(replaced, m), 6, 'replacing the extension restores the live final turn to 6');
  const ended = resolveCurrentTurn(replaced, m, 'limbo-replaced');
  expectTrue(ended.events.some((event) => event.type === 'MATCH_ENDED'), 'replaced extension lets the match end on turn 6');
}

{
  const revealer = basicCard('revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const bank = loc('bank', {
    onCardEnteredHere: [{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: { kind: 'END_OF_GAME' },
    }],
  });
  const c = card('revealer', 'P0', 'HAND');
  const m = manifest([bank], [revealer]);
  let s = stateWith([c], bank, 5);
  s = replay(s, resolve(s, { type: 'STAGE_CARD', intentId: 'delay', owner: 'P0', cardId: c.id, lane: 0 }, createRng('delay'), m), m);
  expectEq(getCardState(s, c.id)!?.revealTiming, { kind: 'END_OF_GAME' }, 'Cryobank stamps an explicit end-game reveal schedule');
  const beforeEnd = resolveCurrentTurn(s, m, 'delay-turn-5');
  expectEq(getCardState(beforeEnd.state, c.id)!?.revealed, false, 'end-game schedule keeps card face-down before end game');
  const end = resolveCurrentTurn(beforeEnd.state, m, 'delay-turn-6');
  expectEq(getCardState(end.state, c.id)!?.revealed, true, 'scheduled card reveals in the end-game window');
  expectEq(getCardState(end.state, c.id)!?.revealTiming, null, 'reveal clears the card schedule');
  expectEq(getStoredCardPowerDelta(end.state, c.id, m), 2, 'end-game reveal fires On Reveal');
}

{
  const revealer = basicCard('extended-revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const bank = loc('bank', {
    onCardEnteredHere: [{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: { kind: 'END_OF_GAME' },
    }],
  });
  const limbo = loc('limbo', {
    ongoing: [{
      kind: 'EXTEND_GAME_TURNS',
      turns: { kind: 'LIT', n: 1 },
      stack: 'MAX',
    }],
  });
  const c = card('extended-revealer', 'P0', 'HAND');
  const m = manifest([bank, limbo], [revealer]);
  let s = withTestLocation(stateWith([c], bank, 6), 1, 'limbo', true, 'limbo-1' as any);
  s = replay(s, resolve(s, { type: 'STAGE_CARD', intentId: 'extended-delay', owner: 'P0', cardId: c.id, lane: 0 }, createRng('extended-delay'), m), m);

  const afterSix = resolveCurrentTurn(s, m, 'extended-turn-6');
  expectEq(afterSix.state.turn, 7, 'active extension postpones the end-game window');
  expectEq(getCardState(afterSix.state, c.id)!?.revealed, false, 'Cryobank card stays hidden through extended turn 6');

  const afterSeven = resolveCurrentTurn(afterSix.state, m, 'extended-turn-7');
  expectEq(getCardState(afterSeven.state, c.id)!?.revealed, true, 'Cryobank card reveals when the extended game actually ends');
  expectTrue(afterSeven.events.some((event) => event.type === 'MATCH_ENDED'), 'extended game ends after real turn 7');
}

{
  const oneTurn = loc('one-turn', {
    ongoing: [{
      kind: 'EXTEND_GAME_TURNS',
      turns: { kind: 'LIT', n: 1 },
      stack: 'MAX',
    }],
  });
  const threeTurns = loc('three-turns', {
    ongoing: [{
      kind: 'EXTEND_GAME_TURNS',
      turns: { kind: 'LIT', n: 3 },
      stack: 'MAX',
    }],
  });
  const hiddenTenTurns = loc('hidden-ten-turns', {
    ongoing: [{
      kind: 'EXTEND_GAME_TURNS',
      turns: { kind: 'LIT', n: 10 },
      stack: 'MAX',
    }],
  });
  const m = manifest([oneTurn, threeTurns, hiddenTenTurns], []);
  let s = stateWith([], oneTurn, 6);
  s = withTestLocation(s, 1, 'three-turns', true, 'three-turns-1' as any);
  s = withTestLocation(s, 2, 'hidden-ten-turns', false, 'hidden-ten-turns-2' as any);
  expectEq(getFinalTurn(s, m), 9, 'multiple extensions use MAX instead of adding together');
}

{
  const backwards = loc('backwards-time', {
    ongoing: [{
      kind: 'EXTEND_GAME_TURNS',
      turns: { kind: 'LIT', n: -5 },
      stack: 'MAX',
    }],
  });
  const m = manifest([backwards], []);
  expectEq(getFinalTurn(stateWith([], backwards, 6), m), 6, 'negative turn extensions cannot shorten the match');
}

{
  const timeCard = basicCard('time-card', {
    ongoing: [{
      kind: 'EXTEND_GAME_TURNS',
      turns: { kind: 'LIT', n: 2 },
      stack: 'MAX',
    }],
  });
  const street = loc('street', {});
  const c = card('time-card', 'P0', 'LANE', 0);
  const m = manifest([street], [timeCard]);
  expectEq(getFinalTurn(stateWith([c], street, 6), m), 8, 'card-sourced turn extensions participate in the live final-turn query');
}

{
  const revealer = basicCard('mobile-revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const bank = loc('mobile-bank', {
    onCardEnteredHere: [{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: { kind: 'END_OF_GAME' },
    }],
  });
  const c = card('mobile-revealer', 'P0', 'HAND');
  const m = manifest([bank], [revealer]);
  let s = stateWith([c], bank, 5);
  s = replay(s, resolve(s, {
    type: 'STAGE_CARD',
    intentId: 'mobile-delay',
    owner: 'P0',
    cardId: c.id,
    lane: 0,
  }, createRng('mobile-delay'), m), m);
  s = apply(s, {
    type: 'CARD_MOVED',
    cardId: c.id,
    fromLane: 0,
    toLane: 1,
    cause: { sourceId: c.id, effectKind: 'SYSTEM', reason: 'BOUNDARY_MOVE' },
  }, m);
  const afterFive = resolveCurrentTurn(s, m, 'mobile-turn-5');
  const end = resolveCurrentTurn(afterFive.state, m, 'mobile-turn-6');
  expectEq(getCardState(end.state, c.id)!?.lane, 1, 'end-game schedule follows a card that moved out of Cryobank');
  expectEq(getCardState(end.state, c.id)!?.revealed, true, 'moved Cryobank card still reveals at actual end game');
}

{
  const revealer = basicCard('orphaned-revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const bank = loc('orphaned-bank', {
    onCardEnteredHere: [{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: { kind: 'END_OF_GAME' },
    }],
  });
  const ruin = loc('orphaned-ruin', {});
  const c = card('orphaned-revealer', 'P0', 'HAND');
  const m = manifest([bank, ruin], [revealer]);
  let s = stateWith([c], bank, 5);
  s = replay(s, resolve(s, {
    type: 'STAGE_CARD',
    intentId: 'orphaned-delay',
    owner: 'P0',
    cardId: c.id,
    lane: 0,
  }, createRng('orphaned-delay'), m), m);
  s = withTestLocation(s, 0, 'orphaned-ruin', true, 'orphaned-ruin-0' as any);
  const afterFive = resolveCurrentTurn(s, m, 'orphaned-turn-5');
  const end = resolveCurrentTurn(afterFive.state, m, 'orphaned-turn-6');
  expectEq(getCardState(end.state, c.id)!?.revealed, true, 'destroying Cryobank does not erase schedules already written to cards');
}

{
  const revealer = basicCard('last-moment-revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } }],
  });
  const bank = loc('last-moment-bank', {
    onCardEnteredHere: [{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: { kind: 'END_OF_GAME' },
    }],
  });
  const c = card('last-moment-revealer', 'P0', 'HAND');
  const m = manifest([bank], [revealer]);
  let s = stateWith([c], bank, 6);
  s = replay(s, resolve(s, {
    type: 'STAGE_CARD',
    intentId: 'last-moment',
    owner: 'P0',
    cardId: c.id,
    lane: 0,
  }, createRng('last-moment-stage'), m), m);
  const end = resolveCurrentTurn(s, m, 'last-moment-end');
  expectEq(getCardState(end.state, c.id)!?.revealed, true, 'card entering Cryobank on the final turn reveals in that same end-game window');
  expectEq(getStoredCardPowerDelta(end.state, c.id, m), 2, 'last-turn Cryobank reveal executes On Reveal before scoring');
  expectTrue(end.events.some((event) => event.type === 'MATCH_ENDED'), 'last-turn Cryobank boundary still ends the match');
}

{
  const revealer = basicCard('paired-revealer', {
    onReveal: [{ kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 1 } }],
  });
  const bank = loc('paired-bank', {
    onCardEnteredHere: [{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: { kind: 'END_OF_GAME' },
    }],
  });
  const p0 = card('paired-revealer', 'P0', 'HAND');
  const p1 = card('paired-revealer', 'P1', 'HAND');
  const m = manifest([bank], [revealer]);
  let s = stateWith([p0, p1], bank, 6);
  s = replay(s, resolve(s, {
    type: 'STAGE_CARD',
    intentId: 'paired-p0',
    owner: 'P0',
    cardId: p0.id,
    lane: 0,
  }, createRng('paired-p0'), m), m);
  s = replay(s, resolve(s, {
    type: 'STAGE_CARD',
    intentId: 'paired-p1',
    owner: 'P1',
    cardId: p1.id,
    lane: 0,
  }, createRng('paired-p1'), m), m);
  const end = resolveCurrentTurn(s, m, 'paired-end');
  expectEq(getCardState(end.state, p0.id)!?.revealed, true, 'end-game window reveals the first player scheduled card');
  expectEq(getCardState(end.state, p1.id)!?.revealed, true, 'end-game window reveals the second player scheduled card');
  expectEq(
    end.events.filter((event) => event.type === 'CARD_FLIPPED').length,
    2,
    'end-game window reveals every scheduled card exactly once',
  );
}

console.log('\nAll location primitive tests passed.');

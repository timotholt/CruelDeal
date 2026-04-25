/**
 * Authored content effect regression tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/content-effects.test.ts
 */

import { apply } from './apply';
import { revealPlayedCard } from './effects/evaluator';
import { createInitialMatchState } from './cli/initState';
import { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';
import { createRng } from './rng';
import type { MatchEvent } from './types/events';
import type { CardId, LocationId } from './types/ids';
import type { MatchState } from './types/state';

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

const run = (state: MatchState, event: MatchEvent): MatchState =>
  apply(state, event, BOOTSTRAP_MANIFEST);

// ---- The Meat Market -------------------------------------------------------

{
  let state = createInitialMatchState('content-meat-market', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'street-kid' }],
    P1: [],
  });
  state = {
    ...state,
    lanes: state.lanes.map((lane, idx) => idx === 0
      ? {
        ...lane,
        location: { id: 'loc-meat-market' as LocationId, defId: 'the-meat-market', lane: 0, tags: [] },
        locationRevealed: true,
      }
      : lane),
  };

  const kid = state.deck.P0.find((card) => card.defId === 'street-kid')!.id as CardId;
  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: kid, toHand: true });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-kid', cardId: kid, lane: 0, owner: 'P0', cost: 1 });

  const result = revealPlayedCard(state, kid, BOOTSTRAP_MANIFEST, createRng('content-meat-market'));

  truthy(result.events.some((event) => event.type === 'CARD_DESTROYED' && event.cardId === kid), 'The Meat Market destroys the first card played here');
  eq(result.state.cards[kid]?.zone, 'DESTROYED', 'The Meat Market victim zone is DESTROYED');
}

// ---- Meat Grinder ----------------------------------------------------------

{
  let state = createInitialMatchState('content-meat-grinder', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'meat-grinder' }],
    P1: [{ defId: 'drone-pup' }],
  });

  const grinder = state.deck.P0.find((card) => card.defId === 'meat-grinder')!.id as CardId;
  const pup = state.deck.P1.find((card) => card.defId === 'drone-pup')!.id as CardId;

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: grinder, toHand: true });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: pup, toHand: true });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-pup', cardId: pup, lane: 0, owner: 'P1', cost: 1 });
  state = run(state, { type: 'CARD_FLIPPED', cardId: pup });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-grinder', cardId: grinder, lane: 0, owner: 'P0', cost: 5 });

  const result = revealPlayedCard(state, grinder, BOOTSTRAP_MANIFEST, createRng('content-meat-grinder'));

  truthy(result.events.some((event) => event.type === 'CARD_DESTROYED' && event.cardId === pup), 'Meat Grinder destroys enemy 1-cost cards here');
  eq(result.state.cards[pup]?.zone, 'DESTROYED', 'Meat Grinder enemy victim zone is DESTROYED');
  eq(result.state.cards[grinder]?.powerDelta, 2, 'Meat Grinder gains +2 per destroyed 1-cost card');
}

// ---- Union Rep -------------------------------------------------------------

{
  let state = createInitialMatchState('content-union-rep', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'union-rep' }, { defId: 'street-kid' }, { defId: 'chop-doc' }],
    P1: [],
  });

  const unionRep = state.deck.P0.find((card) => card.defId === 'union-rep')!.id as CardId;
  const kid = state.deck.P0.find((card) => card.defId === 'street-kid')!.id as CardId;
  const chopDoc = state.deck.P0.find((card) => card.defId === 'chop-doc')!.id as CardId;

  for (const cardId of [unionRep, kid, chopDoc]) {
    state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId, toHand: true });
  }
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-union-rep', cardId: unionRep, lane: 0, owner: 'P0', cost: 2 });
  state = run(state, { type: 'CARD_FLIPPED', cardId: unionRep });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-kid', cardId: kid, lane: 0, owner: 'P0', cost: 1 });
  state = run(state, { type: 'CARD_FLIPPED', cardId: kid });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-chop-doc', cardId: chopDoc, lane: 0, owner: 'P0', cost: 2 });

  const result = revealPlayedCard(state, chopDoc, BOOTSTRAP_MANIFEST, createRng('content-union-rep'));

  truthy(!result.events.some((event) => event.type === 'CARD_DESTROYED'), 'Union Rep blocks friendly card-sourced destroy effects here');
  eq(result.state.cards[unionRep]?.zone, 'LANE', 'Union Rep remains in lane after blocked destroy');
  eq(result.state.cards[kid]?.zone, 'LANE', 'Friendly target remains in lane after blocked destroy');
  eq(result.state.cards[chopDoc]?.zone, 'LANE', 'Destroy source remains in lane after blocked destroy');
}

if (failures > 0) {
  process.exitCode = 1;
}

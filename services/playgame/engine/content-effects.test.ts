/**
 * Authored content effect regression tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/content-effects.test.ts
 */

import { apply } from './apply';
import { evalEffect, revealPlayedCard } from './effects/evaluator';
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
  let state = createInitialMatchState('content-grinder-crew-empty', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'grinder-crew' }],
    P1: [],
  });

  const grinder = state.deck.P0.find((card) => card.defId === 'grinder-crew')!.id as CardId;

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: grinder, toHand: true });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-grinder-crew', cardId: grinder, lane: 0, owner: 'P0', cost: 2 });

  const result = revealPlayedCard(state, grinder, BOOTSTRAP_MANIFEST, createRng('content-grinder-crew-empty'));

  truthy(!result.events.some((event) => event.type === 'CARD_DESTROYED'), 'Grinder Crew destroys nothing in an empty lane');
  eq(result.state.cards[grinder]?.powerDelta, 0, 'Grinder Crew gains no power when nothing is destroyed');
}

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

// ---- Destroyed-card destinations ------------------------------------------

{
  let state = createInitialMatchState('content-golden-parachute-destroyed', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'golden-parachute' }, { defId: 'acquisition-team' }],
    P1: [],
  });

  const parachute = state.deck.P0.find((card) => card.defId === 'golden-parachute')!.id as CardId;
  const acquisition = state.deck.P0.find((card) => card.defId === 'acquisition-team')!.id as CardId;

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: parachute, toHand: true });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: acquisition, toHand: true });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-parachute', cardId: parachute, lane: 0, owner: 'P0', cost: 1 });
  state = run(state, { type: 'CARD_FLIPPED', cardId: parachute });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-acquisition', cardId: acquisition, lane: 0, owner: 'P0', cost: 4 });

  const result = revealPlayedCard(state, acquisition, BOOTSTRAP_MANIFEST, createRng('content-golden-parachute-destroyed'));

  truthy(result.events.some((event) => event.type === 'CARD_DESTROYED' && event.cardId === parachute), 'Acquisition Team destroys Golden Parachute through normal destroy');
  truthy(result.events.some((event) => event.type === 'CARD_ADDED_TO_HAND' && event.defId === 'golden-parachute'), 'Golden Parachute creates a copy in hand after being destroyed');
  eq(result.state.cards[parachute]?.zone, 'DESTROYED', 'Original Golden Parachute remains in destroyed pile');
  truthy(result.state.hand.P0.some((card) => card.defId === 'golden-parachute'), 'Created Golden Parachute copy is in hand');
}

// ---- Junk Packet -----------------------------------------------------------

{
  let state = createInitialMatchState('content-junk-packet', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'street-kid' }],
    P1: [{ defId: 'junk-packet' }],
  });

  const junkPacket = state.deck.P1.find((card) => card.defId === 'junk-packet')!.id as CardId;
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: junkPacket, toHand: true });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-junk-packet', cardId: junkPacket, lane: 0, owner: 'P1', cost: 1 });

  const result = revealPlayedCard(state, junkPacket, BOOTSTRAP_MANIFEST, createRng('content-junk-packet'));

  truthy(result.events.some((event) => event.type === 'CARD_ADDED_TO_DECK' && event.owner === 'P0'), 'Junk Packet adds Junk to opponent deck');
  truthy(!result.events.some((event) => event.type === 'CARD_ADDED_TO_HAND'), 'Junk Packet does not add Junk directly to hand');
  truthy(result.state.deck.P0.some((card) => card.defId === 'junk-card'), 'Junk card is present in opponent deck');
}

// ---- The Pineapple Club ----------------------------------------------------

{
  let state = createInitialMatchState('content-pineapple-club', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'street-kid' }],
    P1: [{ defId: 'drone-pup' }],
  });
  state = {
    ...state,
    lanes: state.lanes.map((lane, idx) => idx === 0
      ? {
        ...lane,
        location: { id: 'loc-pineapple-club' as LocationId, defId: 'the-pineapple-club', lane: 0, tags: [] },
        locationRevealed: true,
      }
      : lane),
  };

  const kid = state.deck.P0.find((card) => card.defId === 'street-kid')!.id as CardId;
  const pup = state.deck.P1.find((card) => card.defId === 'drone-pup')!.id as CardId;
  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: kid, toHand: true });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: pup, toHand: true });

  const loc = state.lanes[0].location!;
  let s = state;
  const events: MatchEvent[] = [];
  const effects = BOOTSTRAP_MANIFEST.locations['the-pineapple-club']!.abilities.onReveal ?? [];
  for (let idx = 0; idx < effects.length; idx++) {
    const result = evalEffect(s, effects[idx], {
      state: s,
      manifest: BOOTSTRAP_MANIFEST,
      self: loc.id,
      selfKind: 'location',
      selfLane: 0,
      selfOwner: null,
      rng: createRng(`content-pineapple-club:${idx}`),
      source: { sourceId: loc.id, effectKind: 'LOCATION', exprIdx: idx },
      depth: 0,
    }, BOOTSTRAP_MANIFEST);
    events.push(...result.events);
    s = result.state;
  }

  eq(events.filter((event) => event.type === 'CARD_DISCARDED').length, 2, 'The Pineapple Club discards one card from each hand');
  eq(events.filter((event) => event.type === 'CARD_ADDED_TO_HAND').length, 2, 'The Pineapple Club adds one random card to each hand');
  eq(s.hand.P0.length, 1, 'P0 hand ends with one replacement card');
  eq(s.hand.P1.length, 1, 'P1 hand ends with one replacement card');
}

// ---- Black ICE -------------------------------------------------------------

{
  let state = createInitialMatchState('content-black-ice', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'black-ice' }],
    P1: [{ defId: 'redline-bruiser' }],
  });

  const blackIce = state.deck.P0.find((card) => card.defId === 'black-ice')!.id as CardId;
  const bruiser = state.deck.P1.find((card) => card.defId === 'redline-bruiser')!.id as CardId;

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: blackIce, toHand: true });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: bruiser, toHand: true });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-bruiser', cardId: bruiser, lane: 0, owner: 'P1', cost: 3 });
  state = run(state, { type: 'CARD_FLIPPED', cardId: bruiser });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-black-ice', cardId: blackIce, lane: 0, owner: 'P0', cost: 3 });

  const result = revealPlayedCard(state, blackIce, BOOTSTRAP_MANIFEST, createRng('content-black-ice'));

  truthy(result.events.some((event) => event.type === 'CARD_TEXT_OVERRIDDEN' && event.cardId === bruiser), 'Black ICE removes enemy Ongoing text here');
  eq(result.state.cards[bruiser]?.textOverride?.kind, 'BLANK_ONGOING', 'Black ICE marks target Ongoing text as blanked');
}

if (failures > 0) {
  process.exitCode = 1;
}

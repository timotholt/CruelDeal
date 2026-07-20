import {
  getCardRuntime,
  getCardsInZone,
  getCardState,
} from './projections/cardRuntime';
/**
 * Authored content effect regression tests.
 *
 * Run:
 *   npx tsx services/playgame/engine/content-effects.test.ts
 */

import { apply } from './apply';
import {
  executeCardRevealForTest,
  executeEffectForTest,
} from './testkit/rulesExecution';
import { createInitialMatchState } from './cli/initState';
import { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';
import { createRng } from './rng';
import type { MatchEvent } from './types/events';
import type { CardId, LocationCardInstanceId } from './types/ids';
import type { EffectRef } from './types/ability';
import type { MatchState } from './types/state';
import {
  orderedTestLocationDeck,
  withTestLocation,
} from './testkit/runtimeFixture';
import { locationCardAtLane } from './laneTopology';
import { getStoredCardPowerDelta } from './powerLedger';
import { getCardCost } from './projections/cost';
import { getCardTemplate } from './projections/cardTemplate';

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
const locationDeck = orderedTestLocationDeck(BOOTSTRAP_MANIFEST);
const drawCause = {
  sourceId: 'system:content-effects-test' as CardId,
  effectKind: 'SYSTEM',
  reason: 'TEST_DRAW',
} as const satisfies EffectRef;
const cardIdInDeck = (
  state: MatchState,
  owner: 'P0' | 'P1',
  defId: string,
): CardId => {
  const card = getCardsInZone(state, BOOTSTRAP_MANIFEST, 'DECK', owner)
    .find(candidate => candidate.defId === defId);
  if (!card) throw new Error(`missing ${owner} deck card ${defId}`);
  return card.id;
};

// ---- Bone Market -----------------------------------------------------------

{
  let state = createInitialMatchState('content-bone-market', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'bone-market' }, { defId: 'street-kid' }],
    P1: [],
  }, locationDeck);
  const boneMarket = cardIdInDeck(state, 'P0', 'bone-market');
  const victim = cardIdInDeck(state, 'P0', 'street-kid');
  for (const cardId of [victim, boneMarket]) {
    state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId, cause: drawCause });
    state = run(state, {
      type: 'CARD_STAGED',
      intentId: `play-${cardId}`,
      cardId,
      lane: 0,
      owner: 'P0',
      energyPaid: getCardCost(state, cardId, BOOTSTRAP_MANIFEST),
    });
  }

  const result = executeCardRevealForTest(
    state,
    boneMarket,
    BOOTSTRAP_MANIFEST,
    createRng('content-bone-market'),
  );
  const created = result.events.find(event =>
    event.type === 'CARD_CREATED' && event.destination.kind === 'HAND');
  truthy(
    created?.type === 'CARD_CREATED',
    'Bone Market creates a card in hand',
  );
  if (created?.type === 'CARD_CREATED') {
    const template = getCardTemplate(BOOTSTRAP_MANIFEST, created.defId)!;
    eq(
      getCardCost(result.state, created.cardId, BOOTSTRAP_MANIFEST),
      Math.max(0, template.baseCost - 1),
      'Bone Market reduces the created card cost by 1',
    );
    truthy(
      result.events.some(event =>
        event.type === 'CARD_COST_CHANGED'
        && event.cardId === created.cardId
        && event.delta === -1),
      'Bone Market emits a negative cost adjustment',
    );
  }
}

// ---- The Meat Market -------------------------------------------------------

{
  let state = createInitialMatchState('content-meat-market', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'street-kid' }],
    P1: [],
  }, locationDeck);
  state = withTestLocation(
    state,
    0,
    'the-meat-market',
    true,
    'loc-meat-market' as LocationCardInstanceId,
  );

  const kid = cardIdInDeck(state, 'P0', 'street-kid');
  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: kid, cause: drawCause });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-kid', cardId: kid, lane: 0, owner: 'P0', energyPaid: 1 });

  const result = executeCardRevealForTest(state, kid, BOOTSTRAP_MANIFEST, createRng('content-meat-market'));

  truthy(result.events.some((event) => event.type === 'CARD_DESTROYED' && event.cardId === kid), 'The Meat Market destroys the first card played here');
  eq(getCardState(result.state, kid)?.zone, 'DESTROYED', 'The Meat Market victim zone is DESTROYED');
}

// ---- Meat Grinder ----------------------------------------------------------

{
  let state = createInitialMatchState('content-grinder-crew-empty', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'grinder-crew' }],
    P1: [],
  }, locationDeck);

  const grinder = cardIdInDeck(state, 'P0', 'grinder-crew');

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: grinder, cause: drawCause });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-grinder-crew', cardId: grinder, lane: 0, owner: 'P0', energyPaid: 2 });

  const result = executeCardRevealForTest(state, grinder, BOOTSTRAP_MANIFEST, createRng('content-grinder-crew-empty'));

  truthy(!result.events.some((event) => event.type === 'CARD_DESTROYED'), 'Grinder Crew destroys nothing in an empty lane');
  eq(getStoredCardPowerDelta(result.state, grinder, BOOTSTRAP_MANIFEST), 0, 'Grinder Crew gains no power when nothing is destroyed');
}

{
  let state = createInitialMatchState('content-meat-grinder', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'meat-grinder' }],
    P1: [{ defId: 'drone-pup' }],
  }, locationDeck);

  const grinder = cardIdInDeck(state, 'P0', 'meat-grinder');
  const pup = cardIdInDeck(state, 'P1', 'drone-pup');

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: grinder, cause: drawCause });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: pup, cause: drawCause });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-pup', cardId: pup, lane: 0, owner: 'P1', energyPaid: 1 });
  state = run(state, { type: 'CARD_REVEALED', cardId: pup, cause: { sourceId: pup, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-grinder', cardId: grinder, lane: 0, owner: 'P0', energyPaid: 5 });

  const result = executeCardRevealForTest(state, grinder, BOOTSTRAP_MANIFEST, createRng('content-meat-grinder'));

  truthy(result.events.some((event) => event.type === 'CARD_DESTROYED' && event.cardId === pup), 'Meat Grinder destroys enemy 1-cost cards here');
  eq(getCardState(result.state, pup)?.zone, 'DESTROYED', 'Meat Grinder enemy victim zone is DESTROYED');
  eq(getStoredCardPowerDelta(result.state, grinder, BOOTSTRAP_MANIFEST), 2, 'Meat Grinder gains +2 per destroyed 1-cost card');
}

// ---- Union Rep -------------------------------------------------------------

{
  let state = createInitialMatchState('content-union-rep', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'union-rep' }, { defId: 'street-kid' }, { defId: 'chop-doc' }],
    P1: [],
  }, locationDeck);

  const unionRep = cardIdInDeck(state, 'P0', 'union-rep');
  const kid = cardIdInDeck(state, 'P0', 'street-kid');
  const chopDoc = cardIdInDeck(state, 'P0', 'chop-doc');

  for (const cardId of [unionRep, kid, chopDoc]) {
    state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId, cause: drawCause });
  }
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-union-rep', cardId: unionRep, lane: 0, owner: 'P0', energyPaid: 2 });
  state = run(state, { type: 'CARD_REVEALED', cardId: unionRep, cause: { sourceId: unionRep, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-kid', cardId: kid, lane: 0, owner: 'P0', energyPaid: 1 });
  state = run(state, { type: 'CARD_REVEALED', cardId: kid, cause: { sourceId: kid, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-chop-doc', cardId: chopDoc, lane: 0, owner: 'P0', energyPaid: 2 });

  const result = executeCardRevealForTest(state, chopDoc, BOOTSTRAP_MANIFEST, createRng('content-union-rep'));

  truthy(!result.events.some((event) => event.type === 'CARD_DESTROYED'), 'Union Rep blocks friendly card-sourced destroy effects here');
  eq(getCardState(result.state, unionRep)?.zone, 'LANE', 'Union Rep remains in lane after blocked destroy');
  eq(getCardState(result.state, kid)?.zone, 'LANE', 'Friendly target remains in lane after blocked destroy');
  eq(getCardState(result.state, chopDoc)?.zone, 'LANE', 'Destroy source remains in lane after blocked destroy');
}

// ---- Destroyed-card destinations ------------------------------------------

{
  let state = createInitialMatchState('content-golden-parachute-destroyed', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'golden-parachute' }, { defId: 'acquisition-team' }],
    P1: [],
  }, locationDeck);

  const parachute = cardIdInDeck(state, 'P0', 'golden-parachute');
  const acquisition = cardIdInDeck(state, 'P0', 'acquisition-team');

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: parachute, cause: drawCause });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: acquisition, cause: drawCause });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-parachute', cardId: parachute, lane: 0, owner: 'P0', energyPaid: 1 });
  state = run(state, { type: 'CARD_REVEALED', cardId: parachute, cause: { sourceId: parachute, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-acquisition', cardId: acquisition, lane: 0, owner: 'P0', energyPaid: 4 });

  const result = executeCardRevealForTest(state, acquisition, BOOTSTRAP_MANIFEST, createRng('content-golden-parachute-destroyed'));

  truthy(result.events.some((event) => event.type === 'CARD_DESTROYED' && event.cardId === parachute), 'Acquisition Team destroys Golden Parachute through normal destroy');
  truthy(result.events.some((event) => event.type === 'CARD_CREATED' && event.destination.kind === 'HAND' && event.defId === 'golden-parachute'), 'Golden Parachute creates a copy in hand after being destroyed');
  eq(getCardState(result.state, parachute)?.zone, 'DESTROYED', 'Original Golden Parachute remains in destroyed pile');
  truthy(
    getCardsInZone(result.state, BOOTSTRAP_MANIFEST, 'HAND', 'P0')
      .some(card => card.defId === 'golden-parachute'),
    'Created Golden Parachute copy is in hand',
  );

  const recipient = getCardRuntime(
    result.state,
    acquisition,
    BOOTSTRAP_MANIFEST,
  );
  truthy(
    (recipient?.text.abilities.onDestroyed?.length ?? 0) > 0,
    'Acquisition Team keeps the destroyed donor text as an immutable snapshot',
  );
  eq(
    recipient?.textHistory.length,
    1,
    'Acquisition Team records one framed text replacement',
  );
  truthy(
    recipient?.textHistory[0]?.frame !== undefined
      && recipient.textHistory[0].cause.reason.length > 0,
    'Acquisition Team text history records frame and mutation reason',
  );

  const copiedTrigger = executeEffectForTest(
    result.state,
    { kind: 'DESTROY', target: { kind: 'SELF' } },
    {
      state: result.state,
      manifest: BOOTSTRAP_MANIFEST,
      self: acquisition,
      selfKind: 'card',
      selfLane: 0,
      selfOwner: 'P0',
      rng: createRng('content-acquisition-copied-trigger'),
      source: {
        sourceId: acquisition,
        effectKind: 'SYSTEM',
        reason: 'VERIFY_COPIED_DESTROY_TRIGGER',
      },
      depth: 0,
    },
    BOOTSTRAP_MANIFEST,
  );
  truthy(
    copiedTrigger.events.some(event =>
      event.type === 'CARD_CREATED'
      && event.destination.kind === 'HAND'
      && event.defId === 'golden-parachute'),
    'Acquisition Team executes copied text after the donor no longer exists in play',
  );
}

// ---- Junk Packet -----------------------------------------------------------

{
  let state = createInitialMatchState('content-junk-packet', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'street-kid' }],
    P1: [{ defId: 'junk-packet' }],
  }, locationDeck);

  const junkPacket = cardIdInDeck(state, 'P1', 'junk-packet');
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: junkPacket, cause: drawCause });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-junk-packet', cardId: junkPacket, lane: 0, owner: 'P1', energyPaid: 1 });

  const result = executeCardRevealForTest(state, junkPacket, BOOTSTRAP_MANIFEST, createRng('content-junk-packet'));

  truthy(result.events.some((event) => event.type === 'CARD_CREATED' && event.destination.kind === 'DECK' && event.owner === 'P0'), 'Junk Packet adds Junk to opponent deck');
  truthy(!result.events.some((event) => event.type === 'CARD_CREATED' && event.destination.kind === 'HAND'), 'Junk Packet does not add Junk directly to hand');
  truthy(
    getCardsInZone(result.state, BOOTSTRAP_MANIFEST, 'DECK', 'P0')
      .some(card => card.defId === 'junk-card'),
    'Junk card is present in opponent deck',
  );
}

// ---- The Pineapple Club ----------------------------------------------------

{
  let state = createInitialMatchState('content-pineapple-club', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'street-kid' }],
    P1: [{ defId: 'drone-pup' }],
  }, locationDeck);
  state = withTestLocation(
    state,
    0,
    'the-pineapple-club',
    true,
    'loc-pineapple-club' as LocationCardInstanceId,
  );

  const kid = cardIdInDeck(state, 'P0', 'street-kid');
  const pup = cardIdInDeck(state, 'P1', 'drone-pup');
  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: kid, cause: drawCause });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: pup, cause: drawCause });

  const loc = locationCardAtLane(state, 0)!;
  let s = state;
  const events: MatchEvent[] = [];
  const effects = BOOTSTRAP_MANIFEST.locations['the-pineapple-club']!.abilities.onReveal ?? [];
  for (let idx = 0; idx < effects.length; idx++) {
    const result = executeEffectForTest(s, effects[idx], {
      state: s,
      manifest: BOOTSTRAP_MANIFEST,
      self: loc.id,
      selfKind: 'location',
      selfLane: 0,
      selfOwner: null,
      rng: createRng(`content-pineapple-club:${idx}`),
      source: { sourceId: loc.id, effectKind: 'LOCATION', reason: 'TEST', exprIdx: idx },
      depth: 0,
    }, BOOTSTRAP_MANIFEST);
    events.push(...result.events);
    s = result.state;
  }

  eq(events.filter((event) => event.type === 'CARD_DISCARDED').length, 2, 'The Pineapple Club discards one card from each hand');
  eq(events.filter((event) => event.type === 'CARD_CREATED' && event.destination.kind === 'HAND').length, 2, 'The Pineapple Club adds one random card to each hand');
  eq(s.hand.P0.length, 1, 'P0 hand ends with one replacement card');
  eq(s.hand.P1.length, 1, 'P1 hand ends with one replacement card');
}

// ---- Black ICE -------------------------------------------------------------

{
  let state = createInitialMatchState('content-black-ice', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'black-ice' }],
    P1: [{ defId: 'redline-bruiser' }],
  }, locationDeck);

  const blackIce = cardIdInDeck(state, 'P0', 'black-ice');
  const bruiser = cardIdInDeck(state, 'P1', 'redline-bruiser');

  state = run(state, { type: 'CARD_DRAWN', owner: 'P0', cardId: blackIce, cause: drawCause });
  state = run(state, { type: 'CARD_DRAWN', owner: 'P1', cardId: bruiser, cause: drawCause });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-bruiser', cardId: bruiser, lane: 0, owner: 'P1', energyPaid: 3 });
  state = run(state, { type: 'CARD_REVEALED', cardId: bruiser, cause: { sourceId: bruiser, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } });
  state = run(state, { type: 'CARD_STAGED', intentId: 'play-black-ice', cardId: blackIce, lane: 0, owner: 'P0', energyPaid: 3 });

  const result = executeCardRevealForTest(state, blackIce, BOOTSTRAP_MANIFEST, createRng('content-black-ice'));

  truthy(result.events.some((event) => event.type === 'CARD_TEXT_OVERRIDDEN' && event.cardId === bruiser), 'Black ICE removes enemy Ongoing text here');
  eq(getCardState(result.state, bruiser)?.textOverride?.kind, 'BLANKED_TEXT', 'Black ICE marks target Ongoing text as blanked');
}

if (failures > 0) {
  process.exitCode = 1;
}

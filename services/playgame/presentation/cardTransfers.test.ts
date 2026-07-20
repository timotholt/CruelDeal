/**
 * Card transfer normalizer tests.
 *
 * Run:
 *   npx vitest run services/playgame/presentation/cardTransfers.test.ts
 */

import { apply } from '../engine/apply';
import { expect, test } from 'vitest';
import { createInitialMatchState } from '../engine/cli/initState';
import { orderedTestLocationDeck } from '../engine/testkit/runtimeFixture';
import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { MatchEvent } from '../engine/types/events';
import type { CardId, LaneId } from '../engine/types/ids';
import type { EffectRef } from '../engine/types/ability';
import { getCardRuntime } from '../engine/projections';
import {
  assertTransferCoverage,
  deriveCardTransfers,
  resolveCardTransferFace,
} from './cardTransfers';

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

const source: EffectRef = { sourceId: 'sys' as CardId, effectKind: 'SYSTEM', reason: 'TEST' };
const event = <T extends MatchEvent>(e: T): T => e;

const stateWithHandCard = () => {
  let s = createInitialMatchState(
    'transfer-seed',
    BOOTSTRAP_MANIFEST,
    {},
    orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
  );
  const cardId = s.deck.P0[0];
  const draw = event({
    type: 'CARD_DRAWN',
    owner: 'P0',
    cardId,
    cause: source,
  });
  s = apply(s, draw, BOOTSTRAP_MANIFEST);
  return { state: s, cardId };
};

{
  const s0 = createInitialMatchState(
    'transfer-draw',
    BOOTSTRAP_MANIFEST,
    {},
    orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
  );
  const cardId = s0.deck.P0[0];
  const e = event({
    type: 'CARD_DRAWN',
    owner: 'P0',
    cardId,
    cause: source,
  });
  const s1 = apply(s0, e, BOOTSTRAP_MANIFEST);
  const transfers = deriveCardTransfers(s0, e, s1);
  assertTransferCoverage(s0, e, s1, transfers);
  eq({
    from: transfers[0]?.from.kind,
    to: transfers[0]?.to.kind,
    route: transfers[0]?.style.route,
  }, {
    from: 'DECK',
    to: 'HAND',
    route: 'anchor-to-visible',
  }, 'CARD_DRAWN normalizes deck -> hand');
}

{
  const { state: s0, cardId } = stateWithHandCard();
  const e = event({ type: 'CARD_STAGED', intentId: 'stage', cardId, lane: 1 as LaneId, owner: 'P0', energyPaid: 1, cause: source });
  const s1 = apply(s0, e, BOOTSTRAP_MANIFEST);
  const transfers = deriveCardTransfers(s0, e, s1);
  assertTransferCoverage(s0, e, s1, transfers);
  eq({
    from: transfers[0]?.from.kind,
    to: transfers[0]?.to.kind,
    route: transfers[0]?.style.route,
    face: transfers[0]?.face,
  }, {
    from: 'HAND',
    to: 'LANE',
    route: 'visible-to-visible',
    face: 'faceDown',
  }, 'CARD_STAGED normalizes hand -> lane');
}

{
  const { state: handState, cardId } = stateWithHandCard();
  const staged = apply(handState, event({ type: 'CARD_STAGED', intentId: 'stage', cardId, lane: 0 as LaneId, owner: 'P0', energyPaid: 1, cause: source }), BOOTSTRAP_MANIFEST);
  const revealed = apply(staged, event({ type: 'CARD_REVEALED', cardId, cause: { sourceId: cardId, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } }), BOOTSTRAP_MANIFEST);
  const e = event({ type: 'CARD_ZONE_CHANGED', cardId, destination: { kind: 'HAND' }, cause: source });
  const s1 = apply(revealed, e, BOOTSTRAP_MANIFEST);
  const transfers = deriveCardTransfers(revealed, e, s1);
  assertTransferCoverage(revealed, e, s1, transfers);
  eq({
    beforeRevealed: getCardRuntime(revealed, cardId, BOOTSTRAP_MANIFEST)?.revealed,
    afterRevealed: getCardRuntime(s1, cardId, BOOTSTRAP_MANIFEST)?.revealed,
    from: transfers[0]?.from.kind,
    to: transfers[0]?.to.kind,
    route: transfers[0]?.style.route,
    face: transfers[0]?.face,
  }, {
    beforeRevealed: true,
    afterRevealed: true,
    from: 'LANE',
    to: 'HAND',
    route: 'visible-to-visible',
    face: 'ownerVisible',
  }, 'Leon-style lane -> hand preserves engine reveal state and owns an explicit face policy');
}

{
  const { state: handState, cardId } = stateWithHandCard();
  const staged = apply(handState, event({ type: 'CARD_STAGED', intentId: 'stage', cardId, lane: 0 as LaneId, owner: 'P0', energyPaid: 1, cause: source }), BOOTSTRAP_MANIFEST);
  const destroyed = apply(staged, event({ type: 'CARD_DESTROYED', cardId, cause: source }), BOOTSTRAP_MANIFEST);
  const e = event({ type: 'CARD_RETURNED_TO_LANE', cardId, lane: 2 as LaneId, revealed: true, cause: source });
  const s1 = apply(destroyed, e, BOOTSTRAP_MANIFEST);
  const transfers = deriveCardTransfers(destroyed, e, s1);
  assertTransferCoverage(destroyed, e, s1, transfers);
  eq({
    from: transfers[0]?.from.kind,
    to: transfers[0]?.to.kind,
    route: transfers[0]?.style.route,
    face: transfers[0]?.face,
  }, {
    from: 'DESTROYED',
    to: 'LANE',
    route: 'anchor-to-visible',
    face: 'faceUp',
  }, 'CARD_RETURNED_TO_LANE normalizes destroyed -> lane');
}

{
  const s0 = createInitialMatchState(
    'transfer-add',
    BOOTSTRAP_MANIFEST,
    {},
    orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
  );
  const e = event({
    type: 'CARD_CREATED',
    owner: 'P1',
    cardId: 'spawned' as CardId,
    defId: 'drone',
    spawnSource: { kind: 'SYSTEM' },
    destination: { kind: 'LANE', lane: 2 as LaneId, revealed: false },
    cause: source,
  });
  const s1 = apply(s0, e, BOOTSTRAP_MANIFEST);
  const transfers = deriveCardTransfers(s0, e, s1);
  assertTransferCoverage(s0, e, s1, transfers);
  eq({
    from: transfers[0]?.from.kind,
    to: transfers[0]?.to.kind,
    route: transfers[0]?.style.route,
  }, {
    from: 'GENERATED',
    to: 'LANE',
    route: 'anchor-to-visible',
  }, 'CARD_CREATED normalizes generated -> lane');
}

if (failures > 0) {
  process.exitCode = 1;
}

test('card transfer mappings satisfy their legacy assertion matrix', () => {
  expect(failures).toBe(0);
});

test('owner-visible hand transfers resolve from the viewer seat, not DOM state', () => {
  expect(resolveCardTransferFace('ownerVisible', 'P0', 'P0')).toBe('faceUp');
  expect(resolveCardTransferFace('ownerVisible', 'P0', 'P1')).toBe('faceDown');
});

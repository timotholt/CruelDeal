import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { BOOTSTRAP_MANIFEST } from '../../engine/manifest/bootstrap';
import {
  validateSeatCommittedTransactionWire,
  validateSeatMatchSnapshotWire,
} from '../../protocol';
import { MatchSession } from '../matchSession';
import {
  applySeatCommittedTransaction,
  projectSnapshotForSeat,
  projectTransactionForSeat,
} from '../projection';

function sessionFixture(seed = 'seat-projection-fixture'): MatchSession {
  return MatchSession.fromBootstrap(
    buildDebugMatchBootstrap(DEBUG_DECKS[0], DEBUG_DECKS[1], seed),
  );
}

describe('seat-safe JSON projection', () => {
  it('serializes a compact snapshot without authority-only or hidden state', () => {
    const session = sessionFixture();
    const state = session.runtime.state();
    const snapshot = projectSnapshotForSeat(
      session.bootstrap.matchId,
      session.runtime.revision(),
      state,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const otherSeatSnapshot = projectSnapshotForSeat(
      session.bootstrap.matchId,
      session.runtime.revision(),
      state,
      'P1',
      BOOTSTRAP_MANIFEST,
    );
    const json = JSON.stringify(snapshot);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(snapshot);
    expect(validateSeatMatchSnapshotWire(parsed).ok).toBe(true);
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain('"drawPile"');
    expect(json).not.toContain('"pendingEffects"');
    expect(json).not.toContain('"trackedVariables"');
    expect(json).not.toContain('"powerLedger"');
    expect(json).not.toContain('"costLog"');
    expect(json).not.toContain('"sourceDeckEntry"');

    const ownHand = new Set(snapshot.state.hands.P0);
    const opponentHand = new Set(snapshot.state.hands.P1);
    expect(snapshot.state.cards
      .filter(card => ownHand.has(card.token))
      .every(card => card.defId !== undefined)).toBe(true);
    expect(snapshot.state.cards
      .filter(card => opponentHand.has(card.token))
      .every(card => card.defId === undefined)).toBe(true);
    expect(snapshot.state.hands.P0[0]).not.toBe(state.hand.P0[0]);
    expect(snapshot.state.hands.P0[0]).not.toBe(otherSeatSnapshot.state.hands.P0[0]);
    expect(json.length).toBeLessThan(JSON.stringify(state).length / 2);
  });

  it('filters authority bookkeeping and secret order from animation events', () => {
    const session = sessionFixture('seat-event-fixture');
    const { setup, opening } = session.runtime.initialization();
    const setupPacket = projectTransactionForSeat(
      setup.transaction,
      setup.transitions,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const openingPacket = projectTransactionForSeat(
      opening.transaction,
      opening.transitions,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const setupJson = JSON.stringify(setupPacket);
    const openingJson = JSON.stringify(openingPacket);

    expect(validateSeatCommittedTransactionWire(setupPacket).ok).toBe(true);
    expect(validateSeatCommittedTransactionWire(openingPacket).ok).toBe(true);
    expect(setupPacket.events.find(
      frame => frame.event.type === 'LOCATION_DECK_INITIALIZED',
    )?.event.data).toEqual({
      count: session.bootstrap.decks.LOCATIONS.entries.length,
    });
    expect([...setupPacket.events, ...openingPacket.events]
      .some(frame => frame.event.type === 'GAMEPLAY_RNG_ADVANCED')).toBe(false);
    expect(setupJson).not.toContain('"locations"');
    expect(openingJson).not.toContain('"newOrder"');
    expect(openingJson).not.toContain('"cause"');
    expect(openingJson).not.toContain('"rng"');
  });

  it('reconnects from a snapshot plus a projected transaction suffix', () => {
    const session = sessionFixture('seat-resync-fixture');
    const genesis = projectSnapshotForSeat(
      session.bootstrap.matchId,
      0,
      session.runtime.genesis(),
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const { setup, opening } = session.runtime.initialization();
    const setupPacket = projectTransactionForSeat(
      setup.transaction,
      setup.transitions,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const openingPacket = projectTransactionForSeat(
      opening.transaction,
      opening.transitions,
      'P0',
      BOOTSTRAP_MANIFEST,
    );

    const current = applySeatCommittedTransaction(
      applySeatCommittedTransaction(genesis, setupPacket),
      openingPacket,
    );
    const fresh = projectSnapshotForSeat(
      session.bootstrap.matchId,
      session.runtime.revision(),
      session.runtime.state(),
      'P0',
      BOOTSTRAP_MANIFEST,
    );

    expect(current).toEqual(fresh);
  });
});

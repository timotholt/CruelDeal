import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { BOOTSTRAP_MANIFEST } from '../../engine/manifest/bootstrap';
import type { CanonicalFrameTransition } from '../../engine/transactionTimeline';
import type { MatchEvent } from '../../engine/types/events';
import { mkPendingEffectId } from '../../engine/types/ids';
import { asFrame } from '../../engine/types/timeline';
import {
  PLAYER_WIRE_PROTOCOL_VERSION,
  validatePlayerWireMessage,
  validateSeatPresentationBlockWire,
  validateSeatMatchSnapshotWire,
} from '../../protocol';
import { MatchSession } from '../matchSession';
import type { CommittedTransactionRecord } from '../contracts';
import {
  applySeatPresentationBlock,
  projectPresentationBlockForSeat,
  projectSnapshotForSeat,
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
      session.runtime.publicRevision(),
      session.runtime.planRevision('P0'),
      state,
      'P0',
      BOOTSTRAP_MANIFEST,
      session.runtime.interactionStatus('P0'),
    );
    const otherSeatSnapshot = projectSnapshotForSeat(
      session.bootstrap.matchId,
      session.runtime.publicRevision(),
      session.runtime.planRevision('P1'),
      state,
      'P1',
      BOOTSTRAP_MANIFEST,
      session.runtime.interactionStatus('P1'),
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
    const setupPacket = projectPresentationBlockForSeat(
      setup,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const openingPacket = projectPresentationBlockForSeat(
      opening,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const setupJson = JSON.stringify(setupPacket);
    const openingJson = JSON.stringify(openingPacket);

    expect(validateSeatPresentationBlockWire(setupPacket).ok).toBe(true);
    expect(validateSeatPresentationBlockWire(openingPacket).ok).toBe(true);
    expect(setupPacket.frames.find(
      frame => frame.event?.type === 'LOCATION_DECK_INITIALIZED',
    )?.event?.data).toEqual({
      count: session.bootstrap.decks.LOCATIONS.entries.length,
    });
    expect([...setupPacket.frames, ...openingPacket.frames]
      .some(frame => frame.event?.type === 'GAMEPLAY_RNG_ADVANCED')).toBe(false);
    expect(setupJson).not.toContain('"locations"');
    expect(openingJson).not.toContain('"newOrder"');
    expect(openingJson).not.toContain('"cause"');
    expect(openingJson).not.toContain('"rng"');
  });

  it('encodes a seat commit as one atomic ordered message with a post-state', () => {
    const session = sessionFixture('seat-atomic-message-fixture');
    const opening = session.runtime.initialization().opening;
    const packet = projectPresentationBlockForSeat(
      opening,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const message = {
      protocolVersion: PLAYER_WIRE_PROTOCOL_VERSION,
      kind: 'SEAT_PRESENTATION_BLOCK',
      payload: packet,
    };

    expect(validatePlayerWireMessage(message).ok).toBe(true);
    expect(Object.keys(packet).sort()).toEqual([
      'basePublicRevision',
      'firstFrame',
      'frames',
      'lastFrame',
      'matchId',
      'postState',
      'postStateHash',
      'preState',
      'publicRevision',
      'transactionId',
      'version',
      'viewerSeat',
    ]);
    expect(packet.frames.length).toBeGreaterThan(1);
    expect(packet.frames.map(frame => frame.frame)).toEqual(
      [...packet.frames].map(frame => frame.frame).sort((left, right) => left - right),
    );
    expect(JSON.stringify(packet)).not.toMatch(/"before"|"finalState"/);

    const withoutPostState = Object.fromEntries(
      Object.entries(packet).filter(([key]) => key !== 'postState'),
    );
    expect(validatePlayerWireMessage({
      ...message,
      payload: withoutPostState,
    }).ok).toBe(false);
    expect(validatePlayerWireMessage({
      ...message,
      payload: packet.frames[0],
    }).ok).toBe(false);
  });

  it('filters stable pending-effect identity events without projecting their payloads', () => {
    const session = sessionFixture('seat-pending-effect-fixture');
    const before = session.runtime.state();
    const pendingEffectId = mkPendingEffectId('pending:projection:1');
    const cause = {
      sourceId: before.hand.P0[0],
      effectKind: 'ON_REVEAL' as const,
      reason: 'TEST_PENDING_PROJECTION',
    };
    const events: readonly MatchEvent[] = [
      {
        type: 'PENDING_EFFECT_SCHEDULED',
        effect: {
          id: pendingEffectId,
          kind: 'SCHEDULED',
          when: 'START_OF_NEXT_TURN',
          sourceId: before.hand.P0[0],
          sourceOwner: 'P0',
          sourceLane: null,
          fireTurn: before.turn + 1,
          effect: { kind: 'SEQUENCE', items: [] },
          scheduledBy: cause,
        },
        cause,
      },
      {
        type: 'PENDING_EFFECT_CONSUMED',
        pendingEffectId,
        cause: {
          sourceId: before.hand.P0[0],
          effectKind: 'SYSTEM',
          reason: 'PENDING_EFFECT_FIRED',
        },
      },
    ];
    const scope = { turn: before.turn, phase: 'ACTION' as const };
    const firstFrame = asFrame(before.timeline.frame + 1);
    const secondFrame = asFrame(firstFrame + 1);
    const afterScheduled = {
      ...before,
      timeline: { frame: firstFrame, scope },
    };
    const afterConsumed = {
      ...afterScheduled,
      timeline: { frame: secondFrame, scope },
    };
    const frames = events.map((event, index) => ({
      frame: index === 0 ? firstFrame : secondFrame,
      scope,
      event,
      effect: null,
    }));
    const transitions: readonly CanonicalFrameTransition[] = [
      {
        index: 0,
        transactionId: 'pending-projection-tx',
        canonicalFrame: frames[0]!,
        frame: firstFrame,
        scope,
        event: events[0]!,
        effect: null,
        before,
        after: afterScheduled,
      },
      {
        index: 1,
        transactionId: 'pending-projection-tx',
        canonicalFrame: frames[1]!,
        frame: secondFrame,
        scope,
        event: events[1]!,
        effect: null,
        before: afterScheduled,
        after: afterConsumed,
      },
    ];
    const transaction: CommittedTransactionRecord = {
      transactionId: 'pending-projection-tx',
      matchId: session.bootstrap.matchId,
      baseRevision: session.runtime.publicRevision(),
      revision: session.runtime.publicRevision() + 1,
      intent: {
        matchId: session.bootstrap.matchId,
        seat: 'SYSTEM',
        intentId: 'pending-projection',
      },
      frames,
      rngDrawsBefore: before.rng.draws,
      rngDrawsAfter: before.rng.draws,
    };

    const projected = projectPresentationBlockForSeat(
      {
        transaction,
        transitions,
        finalState: afterConsumed,
      },
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    expect(projected.frames).toEqual([]);
    expect(JSON.stringify(projected)).not.toContain(pendingEffectId);
    expect(validateSeatPresentationBlockWire(projected).ok).toBe(true);
  });

  it('reconnects from a snapshot plus a projected transaction suffix', () => {
    const session = sessionFixture('seat-resync-fixture');
    const genesis = projectSnapshotForSeat(
      session.bootstrap.matchId,
      0,
      0,
      session.runtime.genesis(),
      'P0',
      BOOTSTRAP_MANIFEST,
      'PLANNING',
    );
    const { setup, opening } = session.runtime.initialization();
    const setupPacket = projectPresentationBlockForSeat(
      setup,
      'P0',
      BOOTSTRAP_MANIFEST,
    );
    const openingPacket = projectPresentationBlockForSeat(
      opening,
      'P0',
      BOOTSTRAP_MANIFEST,
    );

    const current = applySeatPresentationBlock(
      applySeatPresentationBlock(genesis, setupPacket),
      openingPacket,
    );
    const fresh = projectSnapshotForSeat(
      session.bootstrap.matchId,
      session.runtime.publicRevision(),
      session.runtime.planRevision('P0'),
      session.runtime.state(),
      'P0',
      BOOTSTRAP_MANIFEST,
      session.runtime.interactionStatus('P0'),
    );

    expect(current).toEqual(fresh);
  });
});

import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { BOOTSTRAP_MANIFEST } from '../../engine/manifest/bootstrap';
import { getCardCost } from '../../engine/projections/cost';
import { MatchSession, MatchSessionSetupError } from '../matchSession';
import {
  reconcileRuntimeRecord,
  renderRuntimeReplay,
} from '../replayExport';

function candidate(seed = 'phase1-match-session') {
  return buildDebugMatchBootstrap(DEBUG_DECKS[0], DEBUG_DECKS[1], seed);
}

describe('MatchSession', () => {
  it('validates and retains the frozen bootstrap, ruleset, and sole runtime owner', () => {
    const input = candidate();
    const session = MatchSession.fromBootstrap(input);

    expect(session.bootstrap).not.toBe(input);
    expect(Object.isFrozen(session.bootstrap)).toBe(true);
    expect(session.manifest).toBe(BOOTSTRAP_MANIFEST);
    expect(session.ruleset).toBe(BOOTSTRAP_MANIFEST.rulesets.standard);
    expect(session.runtime.transactions()).toHaveLength(2);
    expect(session.runtime.transactions().map(transaction => transaction.intent.intentId))
      .toEqual([
        `setup:${session.bootstrap.seed}`,
        `opening:${session.bootstrap.seed}`,
      ]);
    expect(session.exportReplay().bootstrap).toBe(session.bootstrap);
  });

  it('rejects invalid setup before constructing a runtime', () => {
    const input = candidate();
    const invalid = {
      ...input,
      decks: {
        ...input.decks,
        P0: { ...input.decks.P0, entries: input.decks.P0.entries.slice(1) },
      },
    };

    expect(() => MatchSession.fromBootstrap(invalid)).toThrow(MatchSessionSetupError);
    try {
      MatchSession.fromBootstrap(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(MatchSessionSetupError);
      expect((error as MatchSessionSetupError).issues.map((issue) => issue.code))
        .toContain('INVALID_DECK_SIZE');
    }
  });

  it('renders replay read-only from bootstrap, genesis, and committed records', async () => {
    const session = MatchSession.fromBootstrap(candidate('phase1-runtime-render'));
    await session.runtime.submitIntent({
      matchId: session.bootstrap.matchId,
      seat: session.bootstrap.viewerSeat,
      intentId: 'render-end-turn',
      expectedRevision: session.runtime.revision(),
      intent: { type: 'END_TURN' },
    });
    const exported = session.exportReplay();
    const snapshot = structuredClone(exported);

    const rendered = renderRuntimeReplay(exported, session.manifest);

    expect(rendered.initialState).toBe(exported.genesis);
    expect(rendered.finalState).toEqual(session.runtime.state());
    expect(rendered.steps).toHaveLength(
      1 + exported.transactions.reduce(
        (count, transaction) => count + transaction.framedEvents.length,
        0,
      ),
    );
    expect(exported).toEqual(snapshot);
  });

  it('reconciles the entire DEBUG match and reports the first drift path', () => {
    const session = MatchSession.fromBootstrap(candidate('debug-reconciliation'));
    const reconciliation = session.runtime.reconcile();

    expect(reconciliation).toMatchObject({
      ok: true,
      expectedFingerprint: reconciliation.replayedFingerprint,
      transactionCount: 2,
    });

    const divergentExpected = structuredClone(session.runtime.state());
    (divergentExpected.energy as { P0: number }).P0 = 7;
    const drift = reconcileRuntimeRecord(
      session.runtime.exportReplay(),
      session.bootstrap.matchId,
      session.manifest,
      divergentExpected,
    );

    expect(drift.ok).toBe(false);
    expect(drift.expectedFingerprint).not.toBe(drift.replayedFingerprint);
    expect(drift.mismatchPath).toBe('/energy/P0');
  });

  it('captures full no-history evidence after each DEBUG card play', async () => {
    const session = MatchSession.fromBootstrap(candidate('debug-checkpoints'));
    const state = session.runtime.state();
    const cardId = state.hand.P0.find(
      id => getCardCost(state, id, session.manifest) <= state.energy.P0,
    );
    expect(cardId).toBeDefined();

    await session.runtime.submitIntent({
      matchId: session.bootstrap.matchId,
      seat: 'P0',
      intentId: 'checkpoint-stage',
      expectedRevision: session.runtime.revision(),
      intent: { type: 'STAGE_CARD', cardId: cardId!, lane: 0 },
    });
    await session.runtime.submitIntent({
      matchId: session.bootstrap.matchId,
      seat: 'P0',
      intentId: 'checkpoint-end-turn',
      expectedRevision: session.runtime.revision(),
      intent: { type: 'END_TURN' },
    });

    const checkpoints = session.runtime.debugCheckpoints();
    expect(checkpoints.length).toBeGreaterThan(0);
    expect(checkpoints.every(checkpoint => !checkpoint.stateJson.includes('"log"')))
      .toBe(true);
    expect(session.runtime.reconcile()).toMatchObject({
      ok: true,
      checkpointCount: checkpoints.length,
    });
  });
});

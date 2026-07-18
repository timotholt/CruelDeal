import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { BOOTSTRAP_MANIFEST } from '../../engine/manifest/bootstrap';
import { MatchSession, MatchSessionSetupError } from '../matchSession';
import { renderRuntimeReplay } from '../replayExport';

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
    expect(session.runtime.transactions()).toHaveLength(1);
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
    expect(rendered.frames).toHaveLength(
      1 + exported.transactions.reduce((count, transaction) => count + transaction.events.length, 0),
    );
    expect(exported).toEqual(snapshot);
  });
});

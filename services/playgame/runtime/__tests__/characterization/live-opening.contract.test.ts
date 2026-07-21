import { describe, expect, test } from 'vitest';
import { buildDebugMatchBootstrap } from '../../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../../debug/debugDecks';
import { MatchSession } from '../../matchSession';
import { LocalMatchSessionAdapter } from '../../localMatchSessionAdapter';

describe('current live opening contract', () => {
  test('projects the symmetric opening as one committed presentation block', () => {
    const session = MatchSession.fromBootstrap(buildDebugMatchBootstrap(
      DEBUG_DECKS[0],
      DEBUG_DECKS[7],
      'atomic-opening-contract',
    ));
    const initialization = new LocalMatchSessionAdapter(session).initialization();
    const opening = initialization.opening;

    expect(opening.frames.length).toBeGreaterThan(0);
    expect(new Set(opening.frames.map(frame => frame.transactionId)))
      .toEqual(new Set([opening.transactionId]));
    expect(opening.revision).toBe(opening.baseRevision + 1);
    expect(opening.finalState.hands.P0).toHaveLength(4);
    expect(opening.finalState.hands.P1).toHaveLength(4);

    const drawnOwners = opening.frames.flatMap(frame => (
      frame.event?.type === 'CARD_DRAWN'
        ? [frame.event.data.owner]
        : []
    ));
    expect(drawnOwners).toContain('P0');
    expect(drawnOwners).toContain('P1');
  });
});

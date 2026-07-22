import { describe, expect, test } from 'vitest';
import { buildDebugMatchBootstrap } from '../../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../../debug/debugDecks';
import { MATCH_AUTHORITY_TEST_DRIVERS } from '../../../testing/authorityRegistry';

describe('current live opening contract', () => {
  for (const driver of MATCH_AUTHORITY_TEST_DRIVERS) {
  test(`${driver.id} projects the symmetric opening as one committed presentation block`, async () => {
    const client = await driver.createClient(buildDebugMatchBootstrap(
      DEBUG_DECKS[0],
      DEBUG_DECKS[7],
      'atomic-opening-contract',
    ));
    const initialization = client.initialization();
    const opening = initialization.opening;

    expect(opening.frames.length).toBeGreaterThan(0);
    expect(opening.transactionId).toContain(':tx:');
    expect(opening.publicRevision).toBe(opening.basePublicRevision + 1);
    expect(opening.postState.hands.P0).toHaveLength(4);
    expect(opening.postState.hands.P1).toHaveLength(4);

    const drawnOwners = opening.frames.flatMap(frame => (
      frame.event?.type === 'CARD_DRAWN'
        ? [frame.event.data.owner]
        : []
    ));
    expect(drawnOwners).toContain('P0');
    expect(drawnOwners).toContain('P1');
    client.dispose();
  });
  }
});

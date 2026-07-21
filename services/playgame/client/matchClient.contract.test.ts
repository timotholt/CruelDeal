import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../debug/debugDecks';
import type {
  SeatCardToken,
  SeatTransactionTimeline,
} from '../runtime/projection';
import type { MatchAuthorityTestDriver } from '../testing/authorityTestDriver';
import { MATCH_AUTHORITY_TEST_DRIVERS } from '../testing/authorityRegistry';

function bootstrap(driver: MatchAuthorityTestDriver, seed: string) {
  return buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    `match-client-${driver.id}-${seed}`,
  );
}

function firstAffordableCard(
  timeline: SeatTransactionTimeline,
): SeatCardToken {
  const state = timeline.finalState;
  const token = state.hands.P0.find((candidate) => {
    const card = state.cards.find(entry => entry.token === candidate);
    return card?.cost !== undefined && card.cost <= state.energy.P0;
  });
  if (!token) throw new Error('authority fixture has no affordable card');
  return token;
}

function runMatchClientContract(driver: MatchAuthorityTestDriver): void {
  describe(`${driver.id} MatchClient contract`, () => {
    it('projects one symmetric, secret-safe opening block', async () => {
      const client = await driver.createClient(bootstrap(driver, 'opening'));
      const initialization = client.initialization();

      expect(initialization.opening.frames.length).toBeGreaterThan(0);
      expect(initialization.opening.finalState.hands.P0).toHaveLength(4);
      expect(initialization.opening.finalState.hands.P1).toHaveLength(4);
      expect(JSON.stringify(client.bootstrap)).not.toContain('"seed"');
      expect(initialization.setup).not.toHaveProperty('rng');
      expect(initialization.opening.frames.every(
        frame => !('framedEvent' in frame),
      )).toBe(true);

      client.dispose();
    });

    it('supports private stage, unstage, and undo using opaque tokens', async () => {
      const client = await driver.createClient(
        bootstrap(driver, 'private-plan'),
      );
      const token = firstAffordableCard(client.initialization().opening);

      await expect(client.stageCard(token, 0)).resolves.toMatchObject({
        status: 'accepted',
        commit: 'PRIVATE',
      });
      expect(client.snapshot().state.stagedCards).toContain(token);
      await expect(client.unstageCard(token)).resolves.toMatchObject({
        status: 'accepted',
        commit: 'PRIVATE',
      });
      expect(client.snapshot().state.hands.P0).toContain(token);
      await client.stageCard(token, 0);
      await expect(client.undoLastStagedCard()).resolves.toMatchObject({
        status: 'accepted',
        commit: 'PRIVATE',
      });
      expect(client.snapshot().state.stagedCards).not.toContain(token);

      client.dispose();
    });

    it('publishes a committed turn as one complete projected block', async () => {
      const client = await driver.createClient(bootstrap(driver, 'atomic'));
      const initialization = client.initialization();
      const publications: SeatTransactionTimeline[] = [];
      const unsubscribe = client.subscribeCommittedTransactions(
        timeline => publications.push(timeline),
      );

      expect(initialization.setup).not.toHaveProperty('rng');
      expect(initialization.opening.frames.length).toBeGreaterThan(0);
      expect(client).not.toHaveProperty('subscribeFrame');
      expect(client).not.toHaveProperty('subscribeFrames');

      await expect(client.endTurn()).resolves.toMatchObject({
        status: 'accepted',
      });

      expect(publications).toHaveLength(1);
      expect(publications[0]!.frames.length).toBeGreaterThan(1);
      expect(publications[0]!.finalState.turn).toBe(2);
      expect(client.snapshot().state).toEqual(publications[0]!.finalState);

      unsubscribe();
      client.dispose();
    });

    it('exposes display content without canonical gameplay policy', async () => {
      const client = await driver.createClient(bootstrap(driver, 'content'));
      expect(Object.keys(client.content.cards).length).toBeGreaterThan(0);
      expect(Object.keys(client.content.locations).length).toBeGreaterThan(0);
      expect(Object.values(client.content.cards).every(
        card => !('abilities' in card),
      )).toBe(true);
      expect(client.content).not.toHaveProperty('rulesets');
      expect(client.content).not.toHaveProperty('disabled');

      client.dispose();
    });

    it('does not grant the normal player client a replay capability', async () => {
      const client = await driver.createClient(bootstrap(driver, 'no-debug'));
      expect(client.debug).toBeNull();
      client.dispose();
    });

    it('exposes the same explicitly authorized developer capability', async () => {
      const client = await driver.createClient(
        bootstrap(driver, 'debug'),
        { developerAccess: true },
      );
      expect(client.debug?.replay().steps.length).toBeGreaterThan(0);
      client.dispose();
    });
  });
}

describe('registered authority matrix', () => {
  it('includes an in-process and a serialized boundary', () => {
    expect(MATCH_AUTHORITY_TEST_DRIVERS.map(driver => driver.boundary))
      .toEqual(expect.arrayContaining(['IN_PROCESS', 'SERIALIZED_LOOPBACK']));
  });
});

for (const driver of MATCH_AUTHORITY_TEST_DRIVERS) {
  runMatchClientContract(driver);
}

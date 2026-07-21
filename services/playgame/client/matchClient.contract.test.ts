import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../debug/debugDecks';
import { LocalMatchSessionAdapter } from '../runtime/localMatchSessionAdapter';
import { MatchSession } from '../runtime/matchSession';
import type { SeatTransactionTimeline } from '../runtime/projection';
import type { MatchClient } from './matchClient';

type MatchClientFactory = (seed: string) => MatchClient;

const localClient: MatchClientFactory = seed => new LocalMatchSessionAdapter(
  MatchSession.fromBootstrap(buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  )),
);

function runMatchClientContract(
  label: string,
  createClient: MatchClientFactory,
): void {
  describe(`${label} MatchClient contract`, () => {
    it('publishes a committed turn as one complete projected block', async () => {
      const client = createClient(`match-client-${label}-atomic`);
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

    it('exposes display content without canonical gameplay policy', () => {
      const client = createClient(`match-client-${label}-content`);
      expect(Object.keys(client.content.cards).length).toBeGreaterThan(0);
      expect(Object.keys(client.content.locations).length).toBeGreaterThan(0);
      expect(Object.values(client.content.cards).every(
        card => !('abilities' in card),
      )).toBe(true);
      expect(client.content).not.toHaveProperty('rulesets');
      expect(client.content).not.toHaveProperty('disabled');

      client.dispose();
    });
  });
}

runMatchClientContract('local', localClient);

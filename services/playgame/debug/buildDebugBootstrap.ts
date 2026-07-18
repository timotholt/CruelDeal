import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { MatchBootstrap } from '../runtime/contracts';
import { computeDeckContentHash } from '../runtime/bootstrapValidation';
import type { DebugDeck } from './debugDecks';

export function buildDebugMatchBootstrap(
  playerDeck: Pick<DebugDeck, 'id' | 'name' | 'cards'>,
  opponentDeck: Pick<DebugDeck, 'id' | 'name' | 'cards'>,
  seed: string,
): MatchBootstrap {
  return {
    matchId: `debug-match-${seed}`,
    mode: 'DEBUG',
    seed,
    rulesetId: 'standard',
    manifestVersion: BOOTSTRAP_MANIFEST.version,
    viewerSeat: 'P0',
    participants: {
      P0: {
        participantId: 'debug-you',
        controller: 'LOCAL_HUMAN',
        displayName: 'YOU',
      },
      P1: {
        participantId: 'debug-opponent',
        controller: 'LOCAL_AI',
        displayName: 'OPPONENT',
      },
    },
    decks: {
      P0: {
        deckId: `debug:${playerDeck.id}`,
        revision: 1,
        name: playerDeck.name,
        entries: playerDeck.cards,
        contentHash: computeDeckContentHash(playerDeck.cards),
      },
      P1: {
        deckId: `debug:${opponentDeck.id}`,
        revision: 1,
        name: opponentDeck.name,
        entries: opponentDeck.cards,
        contentHash: computeDeckContentHash(opponentDeck.cards),
      },
    },
  };
}

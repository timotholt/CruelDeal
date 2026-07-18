import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { MatchBootstrap } from '../runtime/contracts';
import { computeDeckContentHash } from '../runtime/bootstrapValidation';
import { defaultLocationDeckFactory } from '../runtime/locationDeckFactory';
import type { DebugDeck } from './debugDecks';

export function buildDebugMatchBootstrap(
  playerDeck: Pick<DebugDeck, 'id' | 'name' | 'cards'>,
  opponentDeck: Pick<DebugDeck, 'id' | 'name' | 'cards'>,
  seed: string,
): MatchBootstrap {
  const ruleset = BOOTSTRAP_MANIFEST.rulesets.standard;
  if (!ruleset) throw new Error('Debug bootstrap requires the standard ruleset');
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
        kind: 'PLAYER',
        deckId: `debug:${playerDeck.id}`,
        revision: 1,
        name: playerDeck.name,
        entries: playerDeck.cards,
        contentHash: computeDeckContentHash(playerDeck.cards),
      },
      P1: {
        kind: 'PLAYER',
        deckId: `debug:${opponentDeck.id}`,
        revision: 1,
        name: opponentDeck.name,
        entries: opponentDeck.cards,
        contentHash: computeDeckContentHash(opponentDeck.cards),
      },
      LOCATIONS: defaultLocationDeckFactory.build({
        manifest: BOOTSTRAP_MANIFEST,
        ruleset,
        seed,
      }),
    },
  };
}

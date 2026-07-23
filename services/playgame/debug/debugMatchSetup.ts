import { createRng } from '../engine/rng';
import type { DebugDeck } from './debugDecks';

export const DEFAULT_DEBUG_MATCH_SEED = 'debug-match';

let fallbackFreshSeedCounter = 0;

export function normalizeDebugMatchSeed(seed: string | null | undefined): string {
  const normalized = seed?.trim();
  return normalized && normalized.length > 0
    ? normalized
    : DEFAULT_DEBUG_MATCH_SEED;
}

function defaultFreshDebugSeedToken(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }
  fallbackFreshSeedCounter += 1;
  return `session-${fallbackFreshSeedCounter.toString(36)}`;
}

export function createFreshDebugMatchSeed(
  nextToken: () => string = defaultFreshDebugSeedToken,
): string {
  const token = nextToken().trim();
  return token.length > 0
    ? `${DEFAULT_DEBUG_MATCH_SEED}:${token}`
    : `${DEFAULT_DEBUG_MATCH_SEED}:fresh`;
}

export function pickDebugOpponent(
  decks: readonly DebugDeck[],
  playerDeckId: string,
  seed: string,
  draw: number,
): DebugDeck {
  if (!Number.isSafeInteger(draw) || draw < 0) {
    throw new Error(`Debug opponent draw must be a non-negative safe integer; received ${draw}`);
  }

  const candidates = decks.filter(deck => deck.id !== playerDeckId);
  if (candidates.length === 0) {
    throw new Error('Debug opponent selection requires a deck distinct from the player deck');
  }

  return createRng(normalizeDebugMatchSeed(seed))
    .scope(`debug-opponent:${playerDeckId}:draw:${draw}`)
    .pick(candidates);
}

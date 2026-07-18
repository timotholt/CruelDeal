/**
 * MatchIntent — the input alphabet of `resolve()`. See spec §3.3.
 *
 * Every intent carries an `intentId` (UUID v4, generated client-side) used
 * for server-side dedup and optimistic-reconciliation in Tier 3. In single-
 * player matches it's still required; it just never leaves the machine.
 */

import type { CardId, LaneId, Owner } from './ids';

export type MatchIntent =
  | { type: 'STAGE_CARD'; intentId: string; owner: Owner; cardId: CardId; lane: LaneId }
  | { type: 'UNSTAGE_CARD'; intentId: string; owner: Owner; cardId: CardId }
  | { type: 'UNDO_TURN'; intentId: string; owner: Owner }
  | { type: 'END_TURN'; intentId: string; owner: Owner }
  | { type: 'CONCEDE'; intentId: string; owner: Owner };

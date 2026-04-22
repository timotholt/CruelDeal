/**
 * MatchEvent — the reducer's input alphabet. See spec §3.2.
 *
 * Events are factual statements in the imperative past tense: "this happened."
 * Never conditional, never speculative. The reducer applies them blindly;
 * validation happens in `resolve()` upstream.
 *
 * The presentation layer (adapters/vfx-choreography.ts in a future step)
 * subscribes to this event stream and maps each to a CSS class / animation.
 */

import type { CardId, LaneIdx, LocationId, Owner } from './ids';
import type { CardTag, LaneTag, PendingEffect } from './state';
import type { EffectRef, TextOverride } from './ability';

export type EnergyReason =
  | 'TURN_START'
  | 'CARD_PLAYED'
  | 'CARD_UNSTAGED'
  | 'EFFECT';

export type PriorityReason =
  | 'MORE_LANES'
  | 'MORE_POWER'
  | 'COIN_FLIP'
  | 'RETAINED';

export type MatchEvent =
  // --- Staging / play ---
  | { type: 'CARD_STAGED'; intentId: string; cardId: CardId; lane: LaneIdx; owner: Owner; cost: number }
  | { type: 'CARD_UNSTAGED'; intentId: string; cardId: CardId }
  | { type: 'ENERGY_CHANGED'; owner: Owner; delta: number; reason: EnergyReason }

  // --- Reveal + OR windows ---
  | { type: 'CARD_FLIPPED'; cardId: CardId }
  | { type: 'OR_WINDOW_OPEN'; cardId: CardId; multiplier: number }
  | { type: 'OR_WINDOW_CLOSE'; cardId: CardId }

  // --- Card mutations ---
  | { type: 'CARD_POWER_CHANGED'; cardId: CardId; delta: number; cause: EffectRef }
  | { type: 'CARD_DESTROYED'; cardId: CardId; cause: EffectRef }
  | { type: 'CARD_MOVED'; cardId: CardId; fromLane: LaneIdx; toLane: LaneIdx; cause: EffectRef }
  | { type: 'CARD_TAG_ADDED'; cardId: CardId; tag: CardTag }
  | { type: 'CARD_TAG_REMOVED'; cardId: CardId; tag: CardTag['kind'] }
  | { type: 'CARD_TEXT_OVERRIDDEN'; cardId: CardId; override: TextOverride }
  | { type: 'CARD_COUNTER_CHANGED'; cardId: CardId; name: string; delta: number }

  // --- Deck / hand ---
  | { type: 'CARD_DRAWN'; owner: Owner; cardId: CardId; toHand: true }
  | { type: 'CARD_ADDED_TO_DECK'; owner: Owner; cardId: CardId }
  | { type: 'CARD_ADDED_TO_LANE'; owner: Owner; cardId: CardId; lane: LaneIdx }
  | { type: 'DECK_SHUFFLED'; owner: Owner; newOrder: readonly CardId[] }

  // --- Pending effects ---
  | { type: 'PENDING_EFFECT_ADDED'; effect: PendingEffect }
  | { type: 'PENDING_EFFECT_REMOVED'; effect: PendingEffect }

  // --- Location ---
  | { type: 'LOCATION_REVEALED'; lane: LaneIdx; locationId: LocationId }
  | { type: 'LOCATION_REPLACED'; lane: LaneIdx; oldId: LocationId; newId: LocationId; cause: EffectRef }
  | { type: 'LOCATION_TAG_ADDED'; lane: LaneIdx; tag: LaneTag }
  | { type: 'LOCATION_TAG_REMOVED'; lane: LaneIdx; tag: LaneTag['kind'] }

  // --- Turn flow ---
  | { type: 'TURN_STARTED'; turn: number; priority: Owner; priorityReason: PriorityReason }
  | { type: 'TURN_ENDED'; turn: number }
  | { type: 'MATCH_ENDED'; result: { winner: Owner | 'DRAW'; lanesWon: Record<Owner, number>; totalPower: Record<Owner, number> } }

  // --- Diagnostics (not authoritative, ignored by apply for state shape) ---
  | { type: 'RECURSION_LIMIT_HIT'; cardId: CardId; depth: number }
  | { type: 'INTENT_REJECTED'; intentId: string; reason: string };

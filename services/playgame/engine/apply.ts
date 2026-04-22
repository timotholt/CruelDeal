/**
 * apply(state, event, manifest) → state
 *
 * Pure reducer. Every MatchEvent variant is handled exactly once. See
 * spec §4. Events are imperative past tense; the reducer applies them
 * blindly. Validation (energy available, lane not full, etc.) lives in
 * resolve() — by the time an event reaches apply, the decision has
 * already been made upstream.
 *
 * Implementation note: we use explicit immutable spreads rather than
 * Immer to avoid a new runtime dep. Tedious but transparent, and makes
 * the determinism guarantees trivially auditable (no proxy magic).
 * Helpers at the bottom keep case bodies compact.
 */

import type { MatchEvent } from './types/events';
import type {
  CardInstance,
  CardTag,
  LaneState,
  LocationInstance,
  MatchLogEntry,
  MatchState,
  PendingEffect,
  SpawnSource,
} from './types/state';
import type { CardId, LaneIdx, Owner } from './types/ids';
import type { Manifest } from './manifest/types';

export function apply(state: MatchState, event: MatchEvent, _manifest: Manifest): MatchState {
  const next = applyBody(state, event);
  // Every event is appended to the log, regardless of whether the body
  // also mutated state. Diagnostic events (RECURSION_LIMIT_HIT,
  // INTENT_REJECTED) only contribute to the log.
  return appendLog(next, event);
}

function applyBody(state: MatchState, event: MatchEvent): MatchState {
  switch (event.type) {
    // ---- Staging / play ---------------------------------------------------

    case 'CARD_STAGED': {
      // Move card from HAND -> LANE (face-up to owner, not yet revealed).
      const s1 = removeFromHand(state, event.owner, event.cardId);
      const s2 = patchCard(s1, event.cardId, {
        zone: 'LANE',
        lane: event.lane,
        revealed: false,
      });
      const s3 = addToLane(s2, event.owner, event.lane, event.cardId);
      return {
        ...s3,
        stagingOrder: [...s3.stagingOrder, event.cardId],
        lastPlayedBy: { ...s3.lastPlayedBy, [event.owner]: event.cardId },
      };
    }

    case 'CARD_UNSTAGED': {
      const card = state.cards[event.cardId];
      if (!card || card.lane === null) return state;
      const s1 = removeFromLane(state, card.owner, card.lane, event.cardId);
      const s2 = patchCard(s1, event.cardId, {
        zone: 'HAND',
        lane: null,
        revealed: false,
      });
      const s3 = addToHand(s2, card.owner, event.cardId);
      return {
        ...s3,
        stagingOrder: s3.stagingOrder.filter(id => id !== event.cardId),
      };
    }

    case 'ENERGY_CHANGED':
      return {
        ...state,
        energy: { ...state.energy, [event.owner]: state.energy[event.owner] + event.delta },
      };

    // ---- Reveal + OR windows ---------------------------------------------

    case 'CARD_FLIPPED':
      return patchCard(state, event.cardId, { revealed: true });

    case 'OR_WINDOW_OPEN':
    case 'OR_WINDOW_CLOSE':
      // Observational — purely for the presentation layer. No state mut.
      return state;

    // ---- Card mutations ---------------------------------------------------

    case 'CARD_POWER_CHANGED': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      return patchCard(state, event.cardId, {
        powerDelta: card.powerDelta + event.delta,
      });
    }

    case 'CARD_DESTROYED': {
      // Board → DESTROYED pile. Distinguished from CARD_DISCARDED so
      // Hela / Knull can target this specifically.
      const card = state.cards[event.cardId];
      if (!card) return state;
      let s: MatchState = state;
      if (card.lane !== null) {
        s = removeFromLane(s, card.owner, card.lane, event.cardId);
      }
      s = patchCard(s, event.cardId, {
        zone: 'DESTROYED',
        lane: null,
        tags: addTagUnique(card.tags, { kind: 'DESTROYED_THIS_TURN' }),
      });
      return {
        ...s,
        stagingOrder: s.stagingOrder.filter(id => id !== event.cardId),
      };
    }

    case 'CARD_DISCARDED': {
      // Hand → DISCARD pile. Morbius / Apocalypse subscribe to this.
      const card = state.cards[event.cardId];
      if (!card) return state;
      const s1 = removeFromHand(state, card.owner, event.cardId);
      return patchCard(s1, event.cardId, { zone: 'DISCARD', lane: null });
    }

    case 'CARD_BANISHED': {
      // Anywhere → BANISHED (permanent exile, no effect can see it again).
      const card = state.cards[event.cardId];
      if (!card) return state;
      let s: MatchState = state;
      if (card.lane !== null) {
        s = removeFromLane(s, card.owner, card.lane, event.cardId);
      }
      s = removeFromHand(s, card.owner, event.cardId);
      s = {
        ...s,
        deck: { ...s.deck, [card.owner]: s.deck[card.owner].filter(c => c.id !== event.cardId) },
      };
      return patchCard(s, event.cardId, { zone: 'BANISHED', lane: null });
    }

    case 'CARD_MOVED': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      const s1 = removeFromLane(state, card.owner, event.fromLane, event.cardId);
      const s2 = addToLane(s1, card.owner, event.toLane, event.cardId);
      return patchCard(s2, event.cardId, {
        lane: event.toLane,
        tags: addTagUnique(card.tags, { kind: 'MOVED_THIS_TURN' }),
      });
    }

    case 'CARD_TAG_ADDED': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      return patchCard(state, event.cardId, {
        tags: addTagUnique(card.tags, event.tag),
      });
    }

    case 'CARD_TAG_REMOVED': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      return patchCard(state, event.cardId, {
        tags: card.tags.filter(t => t.kind !== event.tag),
      });
    }

    case 'CARD_TEXT_OVERRIDDEN':
      return patchCard(state, event.cardId, { textOverride: event.override });

    case 'CARD_COUNTER_CHANGED': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      const prev = card.counters[event.name] ?? 0;
      return patchCard(state, event.cardId, {
        counters: { ...card.counters, [event.name]: prev + event.delta },
      });
    }

    // ---- Deck / hand ------------------------------------------------------

    case 'CARD_DRAWN': {
      const deck = state.deck[event.owner];
      const drawn = deck.find(c => c.id === event.cardId);
      if (!drawn) return state;
      const s1 = {
        ...state,
        deck: { ...state.deck, [event.owner]: deck.filter(c => c.id !== event.cardId) },
      };
      const s2 = patchCard(s1, event.cardId, { zone: 'HAND' });
      return addToHand(s2, event.owner, event.cardId);
    }

    case 'CARD_ADDED_TO_DECK': {
      // May be creating a brand-new card or repositioning an existing one.
      const existing = state.cards[event.cardId];
      const s1 = existing
        ? patchCard(state, event.cardId, {
            zone: 'DECK',
            lane: null,
            spawnSource: event.spawnSource,
          })
        : state;
      const instance = s1.cards[event.cardId];
      if (!instance) return state; // caller must have minted the instance first
      return {
        ...s1,
        deck: { ...s1.deck, [event.owner]: [...s1.deck[event.owner], instance] },
      };
    }

    case 'CARD_ADDED_TO_HAND': {
      // Mint-to-hand: Agent 13, Collector, "add a card to your hand" effects.
      // This creates a fresh CardInstance with the supplied defId and
      // spawnSource. If an instance already exists at that id, update it.
      const minted = mintOrUpdate(state, event.cardId, event.defId, event.owner, event.spawnSource, 'HAND');
      return addToHand(minted, event.owner, event.cardId);
    }

    case 'CARD_ADDED_TO_LANE': {
      // Mint-to-lane: Brood, Jubilee spawn, Bar Sinister. Creates a fresh
      // CardInstance directly in a lane.
      const minted = mintOrUpdate(state, event.cardId, event.defId, event.owner, event.spawnSource, 'LANE', event.lane);
      return addToLane(minted, event.owner, event.lane, event.cardId);
    }

    case 'DECK_SHUFFLED': {
      const pool = state.deck[event.owner];
      const byId = new Map(pool.map(c => [c.id, c] as const));
      const reordered: CardInstance[] = [];
      for (const id of event.newOrder) {
        const c = byId.get(id);
        if (c) reordered.push(c);
      }
      return { ...state, deck: { ...state.deck, [event.owner]: reordered } };
    }

    // ---- Pending effects --------------------------------------------------

    case 'PENDING_EFFECT_ADDED':
      return { ...state, pendingEffects: [...state.pendingEffects, event.effect] };

    case 'PENDING_EFFECT_REMOVED':
      return {
        ...state,
        pendingEffects: state.pendingEffects.filter(e => !pendingEffectEq(e, event.effect)),
      };

    // ---- Location ---------------------------------------------------------

    case 'LOCATION_REVEALED': {
      const lane = state.lanes[event.lane];
      if (!lane.location || lane.location.id !== event.locationId) return state;
      return patchLane(state, event.lane, { locationRevealed: true });
    }

    case 'LOCATION_REPLACED': {
      const newLoc: LocationInstance = {
        id: event.newId,
        defId: '',              // Phase 6 fills defId when it emits this event
        lane: event.lane,
        tags: [],
      };
      return patchLane(state, event.lane, { location: newLoc, locationRevealed: false });
    }

    case 'LOCATION_TAG_ADDED': {
      const lane = state.lanes[event.lane];
      if (!lane.location) return state;
      const exists = lane.location.tags.some(t => t.kind === event.tag.kind);
      if (exists) return state;
      return patchLane(state, event.lane, {
        location: { ...lane.location, tags: [...lane.location.tags, event.tag] },
      });
    }

    case 'LOCATION_TAG_REMOVED': {
      const lane = state.lanes[event.lane];
      if (!lane.location) return state;
      return patchLane(state, event.lane, {
        location: {
          ...lane.location,
          tags: lane.location.tags.filter(t => t.kind !== event.tag),
        },
      });
    }

    // ---- Turn flow --------------------------------------------------------

    case 'TURN_STARTED':
      // Priority is stored in state; reason is log-only. Phase enters
      // AWAITING_INTENT so players can stage again.
      return {
        ...state,
        turn: event.turn,
        priority: event.priority,
        phase: 'AWAITING_INTENT',
      };

    case 'TURN_ENDED': {
      // End-of-turn housekeeping: DESTROYED_THIS_TURN / MOVED_THIS_TURN tags
      // are transient — clear them so they don't leak into next turn's
      // projections. Also clear stagingOrder.
      const cards: Record<string, CardInstance> = {};
      for (const [id, c] of Object.entries(state.cards)) {
        cards[id] = {
          ...c,
          tags: c.tags.filter(t =>
            t.kind !== 'DESTROYED_THIS_TURN' && t.kind !== 'MOVED_THIS_TURN',
          ),
        };
      }
      return {
        ...state,
        cards,
        stagingOrder: [],
        phase: 'BETWEEN_TURNS',
      };
    }

    case 'MATCH_ENDED':
      return {
        ...state,
        phase: 'ENDED',
        result: {
          winner: event.result.winner,
          lanesWon: { ...event.result.lanesWon } as Record<Owner, number>,
          totalPower: { ...event.result.totalPower } as Record<Owner, number>,
        },
      };

    // ---- Diagnostics ------------------------------------------------------

    case 'RECURSION_LIMIT_HIT':
    case 'INTENT_REJECTED':
      // Log-only; no state mutation beyond the log entry added in apply().
      return state;
  }
}

// ---- Structural helpers ----------------------------------------------------

/** Create a new CardInstance if none exists at `id`, or update the
 *  existing one's zone/lane/owner/spawnSource. Used by the mint-style
 *  ADDED_TO_HAND / ADDED_TO_LANE events. */
function mintOrUpdate(
  state: MatchState,
  id: CardId,
  defId: string,
  owner: Owner,
  spawnSource: SpawnSource,
  zone: 'HAND' | 'LANE',
  lane: LaneIdx | null = null,
): MatchState {
  const existing = state.cards[id];
  if (existing) {
    return patchCard(state, id, { defId, owner, zone, lane, spawnSource });
  }
  const fresh: CardInstance = {
    id,
    defId,
    version: 1,
    owner,
    lane,
    zone,
    revealed: zone === 'LANE' ? false : false,
    powerDelta: 0,
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource,
  };
  return { ...state, cards: { ...state.cards, [id]: fresh } };
}

function patchCard(state: MatchState, id: CardId, patch: Partial<CardInstance>): MatchState {
  const prev = state.cards[id];
  if (!prev) return state;
  return {
    ...state,
    cards: { ...state.cards, [id]: { ...prev, ...patch } },
  };
}

function patchLane(state: MatchState, idx: LaneIdx, patch: Partial<LaneState>): MatchState {
  const prev = state.lanes[idx];
  const next: LaneState = { ...prev, ...patch };
  const lanes: [LaneState, LaneState, LaneState] = [
    idx === 0 ? next : state.lanes[0],
    idx === 1 ? next : state.lanes[1],
    idx === 2 ? next : state.lanes[2],
  ];
  return { ...state, lanes };
}

function addToLane(state: MatchState, owner: Owner, lane: LaneIdx, cardId: CardId): MatchState {
  const prev = state.lanes[lane];
  if (prev.cards[owner].includes(cardId)) return state;
  return patchLane(state, lane, {
    cards: { ...prev.cards, [owner]: [...prev.cards[owner], cardId] },
  });
}

function removeFromLane(state: MatchState, owner: Owner, lane: LaneIdx, cardId: CardId): MatchState {
  const prev = state.lanes[lane];
  return patchLane(state, lane, {
    cards: {
      ...prev.cards,
      [owner]: prev.cards[owner].filter(id => id !== cardId),
    },
  });
}

function addToHand(state: MatchState, owner: Owner, cardId: CardId): MatchState {
  const card = state.cards[cardId];
  if (!card) return state;
  if (state.hand[owner].some(c => c.id === cardId)) return state;
  return { ...state, hand: { ...state.hand, [owner]: [...state.hand[owner], card] } };
}

function removeFromHand(state: MatchState, owner: Owner, cardId: CardId): MatchState {
  return {
    ...state,
    hand: { ...state.hand, [owner]: state.hand[owner].filter(c => c.id !== cardId) },
  };
}

function addTagUnique(tags: readonly CardTag[], t: CardTag): readonly CardTag[] {
  if (tags.some(existing => existing.kind === t.kind)) return tags;
  return [...tags, t];
}

function pendingEffectEq(a: PendingEffect, b: PendingEffect): boolean {
  // Simple structural compare; pending effects have small primitive payloads.
  return JSON.stringify(a) === JSON.stringify(b);
}

function appendLog(state: MatchState, event: MatchEvent): MatchState {
  const entry: MatchLogEntry = { seq: state.log.length, event };
  return { ...state, log: [...state.log, entry] };
}

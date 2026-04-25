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
  CostLogEntry,
  EnergyLogEntry,
  LaneState,
  LocationInstance,
  MatchLogEntry,
  MatchState,
  PendingEffect,
  PlayerTrackedVars,
  PowerLogEntry,
  SpawnSource,
  TrackedVariables,
} from './types/state';
import type { CardId, LaneIdx, Owner } from './types/ids';
import type { Manifest } from './manifest/types';

export function apply(state: MatchState, event: MatchEvent, _manifest: Manifest): MatchState {
  const next = applyBody(state, event, _manifest);
  // Every event is appended to the log, regardless of whether the body
  // also mutated state. Diagnostic events (RECURSION_LIMIT_HIT,
  // INTENT_REJECTED) only contribute to the log.
  const next2 = applyTrackedVars(next, state, event);
  return appendLog(next2, event);
}

function applyBody(state: MatchState, event: MatchEvent, manifest: Manifest): MatchState {
  switch (event.type) {
    // ---- Staging / play ---------------------------------------------------

    case 'CARD_STAGED': {
      // Move card from HAND -> LANE (face-up to owner, not yet revealed).
      const s1 = removeFromHand(state, event.owner, event.cardId);
      const card1 = s1.cards[event.cardId];
      const s2 = patchCard(s1, event.cardId, {
        zone: 'LANE',
        lane: event.lane,
        revealed: false,
        tags: card1 ? addTagUnique(card1.tags, { kind: 'PLAYED_THIS_TURN' }) : [],
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

    case 'ENERGY_CHANGED': {
      const after = state.energy[event.owner] + event.delta;
      const eEntry: EnergyLogEntry = {
        turn: state.turn,
        delta: event.delta,
        after,
        reason: event.reason,
        ...(event.cause ? { cause: event.cause } : {}),
      };
      return {
        ...state,
        energy: { ...state.energy, [event.owner]: after },
        energyLog: {
          ...state.energyLog,
          [event.owner]: [...state.energyLog[event.owner], eEntry],
        },
      };
    }

    case 'MAX_ENERGY_CHANGED':
      return {
        ...state,
        maxEnergy: { ...state.maxEnergy, [event.owner]: state.maxEnergy[event.owner] + event.delta },
      };

    case 'NEXT_TURN_ENERGY_BONUS_CHANGED':
      return {
        ...state,
        nextTurnEnergyBonus: {
          ...state.nextTurnEnergyBonus,
          [event.owner]: state.nextTurnEnergyBonus[event.owner] + event.delta,
        },
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
      const newDelta = card.powerDelta + event.delta;
      const pEntry: PowerLogEntry = {
        turn: state.turn,
        delta: event.delta,
        runningDelta: newDelta,
        cause: event.cause,
      };
      return patchCard(state, event.cardId, {
        powerDelta: newDelta,
        powerLog: [...card.powerLog, pEntry],
      });
    }

    case 'CARD_COST_CHANGED': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      const newDelta = card.costDelta + event.delta;
      const cEntry: CostLogEntry = {
        turn: state.turn,
        delta: event.delta,
        runningDelta: newDelta,
        cause: event.cause,
      };
      return patchCard(state, event.cardId, {
        costDelta: newDelta,
        costLog: [...card.costLog, cEntry],
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
      const tagsWithMove = addTagUnique(card.tags, { kind: 'MOVED_THIS_TURN' });
      const tagsWithEver = addTagUnique(tagsWithMove, { kind: 'EVER_MOVED' });
      return patchCard(s2, event.cardId, {
        lane: event.toLane,
        tags: tagsWithEver,
      });
    }

    case 'CARD_RETURNED_TO_LANE': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      if (state.lanes[event.lane].cards[card.owner].length >= manifest.constants.laneCapacity) return state;
      let s: MatchState = state;
      if (card.lane !== null) {
        s = removeFromLane(s, card.owner, card.lane, event.cardId);
      }
      s = removeFromHand(s, card.owner, event.cardId);
      s = {
        ...s,
        deck: { ...s.deck, [card.owner]: s.deck[card.owner].filter(c => c.id !== event.cardId) },
      };
      const s2 = patchCard(s, event.cardId, {
        zone: 'LANE',
        lane: event.lane,
        revealed: event.revealed,
      });
      return addToLane(s2, card.owner, event.lane, event.cardId);
    }

    case 'CARD_TRANSFORMED': {
      const card = state.cards[event.cardId];
      if (!card) return state;
      return patchCard(state, event.cardId, {
        defId: event.newDefId,
        ...(event.resetStats ? {
          powerDelta: 0,
          costDelta: 0,
          powerLog: [],
          costLog: [],
          counters: {},
          tags: [],
          textOverride: null,
        } : {}),
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
      // CardInstance directly in a lane. Effect-spawned cards are face-up
      // immediately (revealed: true); On Reveal effects do NOT fire —
      // use SPAWN_AND_REVEAL for that.
      const minted = mintOrUpdate(state, event.cardId, event.defId, event.owner, event.spawnSource, 'LANE', event.lane);
      const revealed = patchCard(minted, event.cardId, { revealed: true });
      return addToLane(revealed, event.owner, event.lane, event.cardId);
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

    case 'LOCATION_DESTROYED': {
      // Lane becomes locationless. Card slots stay intact; only the
      // location (and therefore its ongoing auras / lane tags) is gone.
      const lane = state.lanes[event.lane];
      if (!lane.location || lane.location.id !== event.locationId) return state;
      return patchLane(state, event.lane, { location: null, locationRevealed: false });
    }

    case 'LOCATION_SHIFTED': {
      // Move the location instance from `fromLane` to `toLane`. If the
      // target lane already has a location we overwrite it — callers that
      // want REPLACED semantics should emit LOCATION_REPLACED + _DESTROYED
      // instead, this event models a pure move.
      const fromLane = state.lanes[event.fromLane];
      if (!fromLane.location || fromLane.location.id !== event.locationId) return state;
      const loc = fromLane.location;
      const relocated: LocationInstance = { ...loc, lane: event.toLane };
      const s1 = patchLane(state, event.fromLane, {
        location: null,
        locationRevealed: false,
      });
      return patchLane(s1, event.toLane, {
        location: relocated,
        locationRevealed: fromLane.locationRevealed,
      });
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

    case 'LOCATION_COUNTER_CHANGED': {
      const lane = state.lanes[event.lane];
      if (!lane.location) return state;
      const key = event.owner ? `${event.owner}:${event.name}` : event.name;
      const prev = lane.location.counters?.[key] ?? 0;
      return patchLane(state, event.lane, {
        location: {
          ...lane.location,
          counters: {
            ...(lane.location.counters ?? {}),
            [key]: prev + event.delta,
          },
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
            t.kind !== 'DESTROYED_THIS_TURN' &&
            t.kind !== 'MOVED_THIS_TURN' &&
            t.kind !== 'PLAYED_THIS_TURN',
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
    costDelta: 0,
    powerLog: [],
    costLog: [],
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

// ---- trackedVariables maintenance ------------------------------------------

/** Resolve source card owner from an EffectRef (null if source is a location or unknown). */
function sourceOwnerOf(state: MatchState, cause: { sourceId: CardId | string }): Owner | null {
  const src = state.cards[cause.sourceId as CardId];
  return src ? src.owner : null;
}

function patchOwnerVars(
  tv: TrackedVariables,
  owner: Owner,
  patch: Partial<PlayerTrackedVars>,
): TrackedVariables {
  const prev = tv[owner];
  return { ...tv, [owner]: { ...prev, ...patch } };
}

function recomputeFlags(vars: PlayerTrackedVars): PlayerTrackedVars {
  return {
    ...vars,
    playedNoCardsLastTurn: vars.cardsPlayedLastTurn === 0,
    spentAllEnergyLastTurn: vars.energyUnspentLastTurn === 0 && vars.energySpentLastTurn > 0,
    hadUnspentEnergyLastTurn: vars.energyUnspentLastTurn > 0,
    spentNoEnergyLastTurn: vars.energySpentLastTurn === 0,
    reducedAnyCostThisGame: vars.totalCostReduced > 0,
  };
}

/**
 * After applyBody runs, update trackedVariables on the new state.
 * `prev` is the pre-event state (needed to read energyLog before ENERGY_CHANGED
 * appended, or to check prior zone for creates, etc.).
 */
function applyTrackedVars(next: MatchState, _prev: MatchState, event: MatchEvent): MatchState {
  let tv = next.trackedVariables;

  switch (event.type) {

    case 'CARD_STAGED': {
      // Card was played; increment cardsPlayedThisTurn for owner.
      const owner = event.owner;
      const prev = tv[owner];
      tv = patchOwnerVars(tv, owner, { cardsPlayedThisTurn: prev.cardsPlayedThisTurn + 1 });
      break;
    }

    case 'CARD_DESTROYED': {
      const card = next.cards[event.cardId];
      if (!card) break;
      const victimOwner = card.owner;
      const actorOwner = sourceOwnerOf(next, event.cause);

      // Victim's side: yourCardsDestroyed++
      const vPrev = tv[victimOwner];
      tv = patchOwnerVars(tv, victimOwner, { yourCardsDestroyed: vPrev.yourCardsDestroyed + 1 });

      // Actor's side: cardsYouDestroyed++ (if actor is a different owner or same, both increment)
      if (actorOwner !== null) {
        const aPrev = tv[actorOwner];
        tv = patchOwnerVars(tv, actorOwner, { cardsYouDestroyed: aPrev.cardsYouDestroyed + 1 });
      }

      // Opponent of victim: enemyCardsDestroyed++
      const oppOfVictim: Owner = victimOwner === 'P0' ? 'P1' : 'P0';
      const oPrev = tv[oppOfVictim];
      tv = patchOwnerVars(tv, oppOfVictim, { enemyCardsDestroyed: oPrev.enemyCardsDestroyed + 1 });

      // Global counter
      tv = { ...tv, totalCardsDestroyed: tv.totalCardsDestroyed + 1 };
      break;
    }

    case 'CARD_DISCARDED': {
      const card = next.cards[event.cardId];
      if (!card) break;
      const owner = card.owner;
      const prev = tv[owner];
      tv = patchOwnerVars(tv, owner, { cardsYouDiscarded: prev.cardsYouDiscarded + 1 });
      break;
    }

    case 'CARD_MOVED': {
      const card = next.cards[event.cardId];
      if (!card) break;
      const owner = card.owner;
      const prev = tv[owner];
      tv = patchOwnerVars(tv, owner, { cardsMoved: prev.cardsMoved + 1 });
      break;
    }

    case 'CARD_ADDED_TO_HAND':
    case 'CARD_ADDED_TO_LANE': {
      // cardsYouCreated if spawnSource is not DECK_CREATION or SYSTEM.
      if (
        event.spawnSource.kind !== 'DECK_CREATION' &&
        event.spawnSource.kind !== 'SYSTEM'
      ) {
        const owner = event.owner;
        const prev = tv[owner];
        tv = patchOwnerVars(tv, owner, { cardsYouCreated: prev.cardsYouCreated + 1 });
      }
      break;
    }

    case 'ENERGY_CHANGED': {
      // Keep energyUnspentNow in sync with live energy pool.
      const owner = event.owner;
      const newEnergy = next.energy[owner];
      tv = patchOwnerVars(tv, owner, { energyUnspentNow: newEnergy });
      break;
    }

    case 'CARD_COST_CHANGED': {
      // Track cumulative cost reduction (negative deltas only).
      if (event.delta >= 0) break;
      const card = next.cards[event.cardId];
      if (!card) break;
      // The actor reducing cost is the source of the effect (cause.sourceId → owner).
      const actorOwner = sourceOwnerOf(next, event.cause);
      if (actorOwner === null) break;
      const prev = tv[actorOwner];
      const reduction = Math.abs(event.delta);
      tv = patchOwnerVars(tv, actorOwner, { totalCostReduced: prev.totalCostReduced + reduction });
      break;
    }

    case 'TURN_ENDED': {
      // Snapshot end-of-turn stats for both owners.
      const owners: Owner[] = ['P0', 'P1'];
      for (const owner of owners) {
        const cur = tv[owner];
        const unspent = next.energy[owner];

        // Sum negative CARD_PLAYED energy deltas for this turn.
        const spent = next.energyLog[owner]
          .filter(e => e.turn === next.turn && e.reason === 'CARD_PLAYED' && e.delta < 0)
          .reduce((sum, e) => sum - e.delta, 0);

        const updated: PlayerTrackedVars = recomputeFlags({
          ...cur,
          cardsPlayedLastTurn: cur.cardsPlayedThisTurn,
          cardsPlayedThisTurn: 0,
          energySpentLastTurn: spent,
          energyUnspentLastTurn: unspent,
          // energyUnspentNow will be updated when ENERGY_CHANGED fires on next TURN_STARTED refill
        });
        tv = { ...tv, [owner]: updated };
      }
      break;
    }

    default:
      break;
  }

  if (tv === next.trackedVariables) return next;
  return { ...next, trackedVariables: tv };
}

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
import { getCardTemplate } from './projections/cardTemplate';
import type {
  InternalCardRecord,
  CardTag,
  CostLogEntry,
  EnergyLogEntry,
  LaneState,
  InternalLocationRecord,
  MatchState,
  PendingEffect,
  PlayerTrackedVars,
  PowerLedgerEntry,
  SpawnSource,
  TrackedVariables,
} from './types/state';
import {
  EMPTY_CARD_LIFECYCLE,
} from './types/state';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from './types/ids';
import type { Manifest } from './manifest/types';
import { currentFrame, frameSingleEvent } from './timeline';
import { nextFrame, type FramedEvent } from './types/timeline';
import {
  cardRecordsInternal,
  createCardStoreInternal,
  readCardInternal,
  writeCardRecordsInternal,
} from './internal/cardStore';
import {
  locationRecordsInternal,
  readLocationInternal,
  writeLocationRecordsInternal,
} from './internal/locationStore';
import { advanceGameplayRng } from './rng';

export function apply(
  state: MatchState,
  event: MatchEvent,
  _manifest: Manifest,
): MatchState {
  return applyFramed(state, frameSingleEvent(state, event), _manifest);
}

/**
 * Canonical reducer entry point. A supplied frame must be the immediate
 * successor of the state's current frame; gaps, duplicates, and rewinds fail.
 */
export function applyFramed(
  state: MatchState,
  framed: FramedEvent,
  _manifest: Manifest,
): MatchState {
  const expected = nextFrame(currentFrame(state));
  if (framed.frame !== expected) {
    throw new Error(`applyFramed: expected frame ${expected}, received ${framed.frame}`);
  }
  // The reducer is the final write boundary, including for replay and tests
  // that construct events directly. Snapshot caller-owned payloads before
  // either state or the runtime-owned event timeline can retain them.
  const canonicalFramed = structuredClone(framed);
  requireEventProvenance(canonicalFramed.event);
  const next = applyBody(
    state,
    canonicalFramed.event,
    canonicalFramed.frame,
    _manifest,
  );
  // Every event advances the state's current timeline coordinate, regardless
  // of whether the body also mutated mechanics. Runtime transaction records
  // retain the canonical event itself.
  const next2 = applyTrackedVars(next, state, canonicalFramed.event);
  return {
    ...next2,
    timeline: {
      frame: canonicalFramed.frame,
      scope: canonicalFramed.scope,
    },
  };
}

function requireEventProvenance(event: MatchEvent): void {
  if (!('cause' in event) || event.cause === undefined) return;
  if (String(event.cause.sourceId).trim().length === 0) {
    throw new Error(`${event.type} cause sourceId must be non-empty`);
  }
  if (event.cause.reason.trim().length === 0) {
    throw new Error(`${event.type} cause reason must be non-empty`);
  }
}

function applyBody(
  state: MatchState,
  event: MatchEvent,
  eventFrame: FramedEvent['frame'],
  manifest: Manifest,
): MatchState {
  return applyEventBody(state, event, eventFrame, manifest);
}

function applyEventBody(
  state: MatchState,
  event: MatchEvent,
  eventFrame: FramedEvent['frame'],
  manifest: Manifest,
): MatchState {
  switch (event.type) {
    // ---- Authority bookkeeping -------------------------------------------

    case 'GAMEPLAY_RNG_ADVANCED': {
      if (!Number.isSafeInteger(event.draws) || event.draws <= 0) {
        throw new Error('GAMEPLAY_RNG_ADVANCED draws must be a positive safe integer');
      }
      return { ...state, rng: advanceGameplayRng(state.rng, event.draws) };
    }

    // ---- Staging / play ---------------------------------------------------

    case 'CARD_STAGED': {
      // Move card from HAND -> LANE (face-up to owner, not yet revealed).
      const s1 = removeFromHand(state, event.owner, event.cardId);
      const card1 = readCardInternal(s1, event.cardId);
      const s2 = patchCard(s1, event.cardId, {
        zone: 'LANE',
        lane: event.lane,
        revealed: false,
        revealTiming: { kind: 'TURN', turn: state.turn },
        lifecycle: card1
          ? {
              ...card1.lifecycle,
              framePlayed: eventFrame,
              turnPlayed: state.turn,
              lanePlayed: event.lane,
            }
          : EMPTY_CARD_LIFECYCLE,
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
      const card = readCardInternal(state, event.cardId);
      if (!card || card.lane === null) return state;
      const s1 = removeFromLane(state, card.owner, card.lane, event.cardId);
      const s2 = patchCard(s1, event.cardId, {
        zone: 'HAND',
        lane: null,
        revealed: false,
        revealTiming: null,
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

    case 'CARD_REVEAL_SCHEDULED':
      return patchCard(state, event.cardId, { revealTiming: event.timing });

    case 'CARD_FLIPPED': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      return patchCard(state, event.cardId, {
        revealed: true,
        revealTiming: null,
      });
    }

    case 'OR_WINDOW_OPEN':
    case 'OR_WINDOW_CLOSE':
      // Observational — purely for the presentation layer. No state mut.
      return state;

    // ---- Card mutations ---------------------------------------------------

    case 'CARD_POWER_CHANGED': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      const def = getCardTemplate(manifest, card.defId);
      if (!def || def.domain === 'spell') return state;
      const entry: PowerLedgerEntry = {
        id: `${event.cardId}:power:${eventFrame}`,
        frame: eventFrame,
        turn: state.turn,
        mutation: event.mutation,
        cause: event.cause,
      };
      return patchCard(state, event.cardId, {
        powerLedger: [...card.powerLedger, entry],
      });
    }

    case 'CARD_COST_CHANGED': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      const newDelta = card.costDelta + event.delta;
      const cEntry: CostLogEntry = {
        frame: eventFrame,
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
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      let s: MatchState = state;
      if (card.lane !== null) {
        s = removeFromLane(s, card.owner, card.lane, event.cardId);
      }
      s = patchCard(s, event.cardId, {
        zone: 'DESTROYED',
        lane: null,
        revealTiming: null,
        lifecycle: {
          ...card.lifecycle,
          turnDestroyed: state.turn,
        },
        tags: addTagUnique(card.tags, { kind: 'DESTROYED_THIS_TURN' }),
      });
      return {
        ...s,
        stagingOrder: s.stagingOrder.filter(id => id !== event.cardId),
      };
    }

    case 'CARD_DISCARDED': {
      // Hand → DISCARD pile. Morbius / Apocalypse subscribe to this.
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      const s1 = removeFromHand(state, card.owner, event.cardId);
      return patchCard(s1, event.cardId, { zone: 'DISCARD', lane: null, revealTiming: null });
    }

    case 'CARD_BANISHED': {
      // Anywhere → BANISHED (permanent exile, no effect can see it again).
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      let s: MatchState = state;
      if (card.lane !== null) {
        s = removeFromLane(s, card.owner, card.lane, event.cardId);
      }
      s = removeFromHand(s, card.owner, event.cardId);
      s = {
        ...s,
        deck: { ...s.deck, [card.owner]: s.deck[card.owner].filter(id => id !== event.cardId) },
      };
      return patchCard(s, event.cardId, { zone: 'BANISHED', lane: null, revealTiming: null });
    }

    case 'CARD_MOVED': {
      const card = readCardInternal(state, event.cardId);
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
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      if (state.lanesById[event.lane].cards[card.owner].length >= manifest.constants.laneCapacity) return state;
      let s: MatchState = state;
      if (card.lane !== null) {
        s = removeFromLane(s, card.owner, card.lane, event.cardId);
      }
      s = removeFromHand(s, card.owner, event.cardId);
      s = {
        ...s,
        deck: { ...s.deck, [card.owner]: s.deck[card.owner].filter(id => id !== event.cardId) },
      };
      const s2 = patchCard(s, event.cardId, {
        zone: 'LANE',
        lane: event.lane,
        revealed: event.revealed,
        revealTiming: event.revealed ? null : { kind: 'TURN', turn: state.turn },
      });
      return addToLane(s2, card.owner, event.lane, event.cardId);
    }

    case 'CARD_TRANSFORMED': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      return patchCard(state, event.cardId, {
        defId: event.newDefId,
        variantId: undefined,
        ...(event.resetStats ? {
          costDelta: 0,
          costLog: [],
          counters: {},
          tags: [],
          textOverride: null,
          textLog: [],
        } : {}),
      });
    }

    case 'CARD_TAG_ADDED': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      return patchCard(state, event.cardId, {
        tags: addTagUnique(card.tags, event.tag),
      });
    }

    case 'CARD_TAG_REMOVED': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      return patchCard(state, event.cardId, {
        tags: card.tags.filter(t => t.kind !== event.tag),
      });
    }

    case 'CARD_TEXT_OVERRIDDEN': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      return patchCard(state, event.cardId, {
        textOverride: event.override,
        textLog: [
          ...card.textLog,
          {
            frame: eventFrame,
            turn: state.turn,
            override: event.override,
            cause: event.cause,
          },
        ],
      });
    }

    case 'CARD_COUNTER_CHANGED': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      const prev = card.counters[event.name] ?? 0;
      return patchCard(state, event.cardId, {
        counters: { ...card.counters, [event.name]: prev + event.delta },
      });
    }

    // ---- Deck / hand ------------------------------------------------------

    case 'CARD_DRAWN': {
      const deck = state.deck[event.owner];
      if (!deck.includes(event.cardId)) return state;
      const s1 = {
        ...state,
        deck: { ...state.deck, [event.owner]: deck.filter(id => id !== event.cardId) },
      };
      const s2 = patchCard(s1, event.cardId, { zone: 'HAND', revealTiming: null });
      return addToHand(s2, event.owner, event.cardId);
    }

    case 'CARD_ADDED_TO_DECK': {
      // May be creating a brand-new card or repositioning an existing one.
      const existing = readCardInternal(state, event.cardId);
      const s1 = existing
        ? patchCard(state, event.cardId, {
            zone: 'DECK',
            lane: null,
            revealTiming: null,
            spawnSource: event.spawnSource,
          })
        : event.defId
          ? mintOrUpdate(state, event.cardId, event.defId, event.owner, event.spawnSource, 'DECK')
          : state;
      if (!readCardInternal(s1, event.cardId)) return state;
      return {
        ...s1,
        deck: {
          ...s1.deck,
          [event.owner]: event.position === 'TOP'
            ? [event.cardId, ...s1.deck[event.owner].filter(id => id !== event.cardId)]
            : [...s1.deck[event.owner].filter(id => id !== event.cardId), event.cardId],
        },
      };
    }

    case 'CARD_ADDED_TO_HAND': {
      // Mint-to-hand: Agent 13, Collector, "add a card to your hand" effects.
      // This creates a fresh InternalCardRecord with the supplied defId and
      // spawnSource. If an instance already exists at that id, update it.
      const minted = mintOrUpdate(state, event.cardId, event.defId, event.owner, event.spawnSource, 'HAND');
      return addToHand(minted, event.owner, event.cardId);
    }

    case 'CARD_ADDED_TO_LANE': {
      // Mint-to-lane: Brood, Jubilee spawn, Bar Sinister. Creates a fresh
      // InternalCardRecord directly in a lane. Effect-spawned cards are face-up
      // immediately (revealed: true); On Reveal effects do NOT fire —
      // use SPAWN_AND_REVEAL for that.
      const minted = mintOrUpdate(state, event.cardId, event.defId, event.owner, event.spawnSource, 'LANE', event.lane);
      const revealed = patchCard(minted, event.cardId, { revealed: true, revealTiming: null });
      return addToLane(revealed, event.owner, event.lane, event.cardId);
    }

    case 'CARD_MOVED_TO_ZONE': {
      const card = readCardInternal(state, event.cardId);
      if (!card) return state;
      let s = removeFromAllCardZones(state, card.owner, event.cardId);

      switch (event.destination.kind) {
        case 'HAND':
          if (s.hand[card.owner].length >= manifest.constants.handCap) return state;
          s = patchCard(s, event.cardId, { zone: 'HAND', lane: null, revealTiming: null });
          return addToHand(s, card.owner, event.cardId);
        case 'DECK':
          s = patchCard(s, event.cardId, { zone: 'DECK', lane: null, revealTiming: null });
          return {
            ...s,
            deck: {
              ...s.deck,
              [card.owner]: event.destination.position === 'TOP'
                ? [event.cardId, ...s.deck[card.owner]]
                : [...s.deck[card.owner], event.cardId],
            },
          };
        case 'LANE':
          if (s.lanesById[event.destination.lane].cards[card.owner].length >= manifest.constants.laneCapacity) return state;
          s = patchCard(s, event.cardId, {
            zone: 'LANE',
            lane: event.destination.lane,
            revealed: event.destination.revealed ?? card.revealed,
            revealTiming: (event.destination.revealed ?? card.revealed)
              ? null
              : { kind: 'TURN', turn: state.turn },
          });
          return addToLane(s, card.owner, event.destination.lane, event.cardId);
      }
      return s;
    }

    case 'DECK_SHUFFLED': {
      const pool = state.deck[event.owner];
      const poolIds = new Set(pool);
      const reordered: CardId[] = [];
      for (const id of event.newOrder) {
        if (poolIds.has(id)) reordered.push(id);
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

    case 'LOCATION_DECK_INITIALIZED': {
      if (
        Object.keys(locationRecordsInternal(state)).length > 0
        || state.locationDeck.drawPile.length > 0
      ) {
        return state;
      }
      const locationCards: Record<LocationCardInstanceId, InternalLocationRecord> = {};
      const drawPile: LocationCardInstanceId[] = [];
      for (const location of event.locations) {
        locationCards[location.id] = {
          id: location.id,
          defId: location.defId,
          sourceDeckEntry: location.sourceDeckEntry,
          zone: 'DECK',
          laneId: null,
          pendingLaneId: null,
          face: 'FACE_DOWN',
          identityKnownTo: [],
          revealCount: 0,
          tags: [],
          counters: {},
        };
        drawPile.push(location.id);
      }
      return writeLocationRecordsInternal({
        ...state,
        locationDeck: {
          drawPile,
          staging: [],
          discardPile: [],
          destroyed: [],
          banished: [],
        },
      }, locationCards);
    }

    case 'LOCATION_CARD_CREATED': {
      if (readLocationInternal(state, event.locationId)) return state;
      const lane = state.lanesById[event.pendingLane];
      if (!lane || laneStatus(lane) !== 'CREATING') return state;
      const location: InternalLocationRecord = {
        id: event.locationId,
        defId: event.defId,
        sourceDeckEntry: -1,
        zone: 'STAGING',
        laneId: null,
        pendingLaneId: event.pendingLane,
        face: 'FACE_DOWN',
        identityKnownTo: [],
        revealCount: 0,
        tags: [],
        counters: {},
      };
      return writeLocationRecordsInternal({
        ...state,
        locationDeck: {
          ...state.locationDeck,
          staging: [...state.locationDeck.staging, location.id],
        },
      }, {
        ...locationRecordsInternal(state),
        [location.id]: location,
      });
    }

    case 'LOCATION_CARD_DRAWN': {
      const location = readLocationInternal(state, event.locationId);
      const lane = state.lanesById[event.pendingLane];
      if (
        !location
        || location.zone !== 'DECK'
        || !lane
        || laneStatus(lane) !== 'CREATING'
      ) {
        return state;
      }
      return patchLocationCard({
        ...state,
        locationDeck: {
          ...state.locationDeck,
          drawPile: state.locationDeck.drawPile.filter(id => id !== location.id),
          staging: [...state.locationDeck.staging, location.id],
        },
      }, location.id, {
        zone: 'STAGING',
        pendingLaneId: event.pendingLane,
      });
    }

    case 'LOCATION_CARD_PLAYED': {
      const location = readLocationInternal(state, event.locationId);
      const lane = state.lanesById[event.lane];
      if (
        !location
        || location.zone !== 'STAGING'
        || location.pendingLaneId !== event.lane
        || !lane
        || laneStatus(lane) !== 'CREATING'
        || lane.locationSlot.locationCardId !== null
      ) {
        return state;
      }
      return patchLocationCard({
        ...state,
        locationDeck: {
          ...state.locationDeck,
          staging: state.locationDeck.staging.filter(id => id !== location.id),
        },
        lanesById: {
          ...state.lanesById,
          [lane.id]: {
            ...lane,
            locationSlot: {
              ...lane.locationSlot,
              locationCardId: location.id,
            },
          },
        },
      }, location.id, {
        zone: 'LANE',
        laneId: event.lane,
        pendingLaneId: null,
        face: 'FACE_DOWN',
        identityKnownTo: [],
        revealCount: 0,
      });
    }

    case 'LOCATION_SLOT_REVEAL_SCHEDULED': {
      const lane = state.lanesById[event.lane];
      if (!lane || lane.locationSlot.locationCardId === null) return state;
      return patchLane(state, event.lane, {
        locationSlot: {
          ...lane.locationSlot,
          revealAtTurn: event.revealAtTurn,
        },
      });
    }

    case 'LOCATION_REVEALED': {
      const location = locationAtLane(state, event.lane);
      if (
        !location
        || location.id !== event.locationId
        || location.face !== 'FACE_DOWN'
      ) {
        return state;
      }
      const revealed = patchLocationCard(state, location.id, {
        face: 'FACE_UP',
        identityKnownTo: ['P0', 'P1'],
        revealCount: location.revealCount + 1,
      });
      const lane = revealed.lanesById[event.lane];
      return patchLane(revealed, event.lane, {
        locationSlot: {
          ...lane.locationSlot,
          revealAtTurn: null,
        },
      });
    }

    case 'LOCATION_TURNED_FACE_DOWN': {
      const location = locationAtLane(state, event.lane);
      if (
        !location
        || location.id !== event.locationId
        || location.face !== 'FACE_UP'
      ) {
        return state;
      }
      return patchLocationCard(state, location.id, {
        face: 'FACE_DOWN',
      });
    }

    case 'LOCATION_SHOWN_TO_SEATS': {
      const location = locationAtLane(state, event.lane);
      if (!location || location.id !== event.locationId) return state;
      return patchLocationCard(state, location.id, {
        identityKnownTo: [
          ...new Set([...location.identityKnownTo, ...event.seats]),
        ],
      });
    }

    case 'LOCATION_REPLACED': {
      const lane = state.lanesById[event.lane];
      const oldLocation = locationAtLane(state, event.lane);
      if (!lane || !oldLocation || oldLocation.id !== event.oldId) return state;
      const revealed = event.revealPolicy === 'REVEAL_IMMEDIATELY';
      const revealAtTurn = event.revealPolicy === 'KEEP_SLOT_SCHEDULE'
        ? lane.locationSlot.revealAtTurn
        : event.revealPolicy === 'SCHEDULE_AT_TURN'
          ? event.revealAtTurn ?? null
          : null;
      const newLoc: InternalLocationRecord = {
        id: event.newId,
        defId: event.newDefId,
        sourceDeckEntry: -1,
        zone: 'LANE',
        laneId: event.lane,
        pendingLaneId: null,
        face: revealed ? 'FACE_UP' : 'FACE_DOWN',
        identityKnownTo: revealed ? ['P0', 'P1'] : [],
        revealCount: revealed ? 1 : 0,
        tags: [],
        counters: {},
      };
      const withoutOld = moveLocationToZone(state, oldLocation.id, event.oldDestination);
      return writeLocationRecordsInternal({
        ...withoutOld,
        lanesById: {
          ...withoutOld.lanesById,
          [event.lane]: {
            ...lane,
            locationSlot: {
              ...lane.locationSlot,
              locationCardId: newLoc.id,
              revealAtTurn,
            },
          },
        },
      }, {
        ...locationRecordsInternal(withoutOld),
        [newLoc.id]: newLoc,
      });
    }

    case 'LOCATIONS_SWAPPED': {
      const leftLane = state.lanesById[event.left.fromLane];
      const rightLane = state.lanesById[event.right.fromLane];
      const leftLocation = locationAtLane(state, event.left.fromLane);
      const rightLocation = locationAtLane(state, event.right.fromLane);
      if (
        !leftLane
        || !rightLane
        || !leftLocation
        || !rightLocation
        || leftLocation.id !== event.left.locationId
        || rightLocation.id !== event.right.locationId
        || event.left.toLane !== event.right.fromLane
        || event.right.toLane !== event.left.fromLane
      ) {
        return state;
      }
      return writeLocationRecordsInternal({
        ...state,
        lanesById: {
          ...state.lanesById,
          [leftLane.id]: {
            ...leftLane,
            locationSlot: {
              ...leftLane.locationSlot,
              locationCardId: rightLocation.id,
            },
          },
          [rightLane.id]: {
            ...rightLane,
            locationSlot: {
              ...rightLane.locationSlot,
              locationCardId: leftLocation.id,
            },
          },
        },
      }, {
        ...locationRecordsInternal(state),
        [leftLocation.id]: { ...leftLocation, laneId: rightLane.id },
        [rightLocation.id]: { ...rightLocation, laneId: leftLane.id },
      });
    }

    case 'LOCATION_MOVED': {
      const fromLane = state.lanesById[event.fromLane];
      const toLane = state.lanesById[event.toLane];
      const location = locationAtLane(state, event.fromLane);
      if (
        !fromLane
        || !toLane
        || !location
        || location.id !== event.locationId
        || toLane.locationSlot.locationCardId !== null
      ) {
        return state;
      }
      return patchLocationCard({
        ...state,
        lanesById: {
          ...state.lanesById,
          [fromLane.id]: {
            ...fromLane,
            locationSlot: {
              ...fromLane.locationSlot,
              locationCardId: null,
            },
          },
          [toLane.id]: {
            ...toLane,
            locationSlot: {
              ...toLane.locationSlot,
              locationCardId: location.id,
            },
          },
        },
      }, location.id, { laneId: toLane.id });
    }

    case 'LOCATION_REMOVED_FROM_LANE': {
      const lane = state.lanesById[event.lane];
      const location = locationAtLane(state, event.lane);
      if (!lane || !location || location.id !== event.locationId) return state;
      const removed = moveLocationToZone(
        state,
        location.id,
        event.destination,
      );
      return patchLane(removed, event.lane, {
        locationSlot: {
          ...lane.locationSlot,
          locationCardId: null,
        },
      });
    }

    case 'LOCATION_RETURNED_TO_DECK': {
      const location = readLocationInternal(state, event.locationId);
      if (!location || location.zone !== event.from) return state;
      const withoutId = (ids: readonly LocationCardInstanceId[]) =>
        ids.filter(id => id !== location.id);
      const drawPile = event.placement === 'TOP'
        ? [location.id, ...withoutId(state.locationDeck.drawPile)]
        : [...withoutId(state.locationDeck.drawPile), location.id];
      return patchLocationCard({
        ...state,
        locationDeck: {
          drawPile,
          staging: withoutId(state.locationDeck.staging),
          discardPile: withoutId(state.locationDeck.discardPile),
          destroyed: withoutId(state.locationDeck.destroyed),
          banished: withoutId(state.locationDeck.banished),
        },
      }, location.id, {
        zone: 'DECK',
        laneId: null,
        pendingLaneId: null,
        face: 'FACE_DOWN',
      });
    }

    case 'LOCATION_TAG_ADDED': {
      const location = locationAtLane(state, event.lane);
      if (!location) return state;
      const exists = location.tags.some(t => t.kind === event.tag.kind);
      if (exists) return state;
      return patchLocationCard(state, location.id, {
        tags: [...location.tags, event.tag],
      });
    }

    case 'LOCATION_TAG_REMOVED': {
      const location = locationAtLane(state, event.lane);
      if (!location) return state;
      return patchLocationCard(state, location.id, {
        tags: location.tags.filter(t => t.kind !== event.tag),
      });
    }

    case 'LOCATION_COUNTER_CHANGED': {
      const location = locationAtLane(state, event.lane);
      if (!location) return state;
      const key = event.owner ? `${event.owner}:${event.name}` : event.name;
      const prev = location.counters[key] ?? 0;
      return patchLocationCard(state, location.id, {
        counters: {
          ...location.counters,
          [key]: prev + event.delta,
        },
      });
    }

    // ---- Lane lifecycle --------------------------------------------------

    case 'LANE_DESTRUCTION_STARTED': {
      const lane = state.lanesById[event.lane];
      if (!lane || laneStatus(lane) !== 'ACTIVE') return state;
      return patchLane(state, event.lane, { status: 'DESTROYING' });
    }

    case 'LANE_DESTROYED': {
      const lane = state.lanesById[event.lane];
      if (
        !lane
        || laneStatus(lane) !== 'DESTROYING'
        || lane.locationSlot.locationCardId !== null
      ) {
        return state;
      }
      const activeLaneOrder = activeLaneIds(state).filter(id => id !== event.lane);
      return {
        ...patchLane(state, event.lane, {
          status: 'DESTROYED',
          locationSlot: {
            ...lane.locationSlot,
            locationCardId: null,
            revealAtTurn: null,
          },
          cards: { P0: [], P1: [] },
          destroyedAt: eventFrame,
        }),
        activeLaneOrder,
        pendingEffects: state.pendingEffects.filter(effect =>
          !('lane' in effect && effect.lane === event.lane)
          && !('sourceLane' in effect && effect.sourceLane === event.lane),
        ),
      };
    }

    case 'LANE_CREATION_STARTED': {
      if (state.lanesById[event.lane]) return state;
      const lane: LaneState = {
        id: event.lane,
        status: 'CREATING',
        locationSlot: {
          laneId: event.lane,
          locationCardId: null,
          revealAtTurn: null,
        },
        cards: { P0: [], P1: [] },
        createdAt: eventFrame,
      };
      return {
        ...state,
        lanesById: { ...state.lanesById, [event.lane]: lane },
        nextLaneId: event.lane + 1,
      };
    }

    case 'LANE_CREATED': {
      const lane = state.lanesById[event.lane];
      if (
        !lane
        || laneStatus(lane) !== 'CREATING'
        || lane.locationSlot.locationCardId === null
      ) {
        return state;
      }
      const active = activeLaneIds(state);
      const insertion = Math.min(Math.max(0, event.position), active.length);
      const activeLaneOrder = [
        ...active.slice(0, insertion),
        event.lane,
        ...active.slice(insertion),
      ];
      return {
        ...state,
        lanesById: {
          ...state.lanesById,
          [event.lane]: {
            ...lane,
            status: 'ACTIVE',
          },
        },
        activeLaneOrder,
      };
    }

    // ---- Turn flow --------------------------------------------------------

    case 'MATCH_SETUP_COMPLETED': {
      if (
        state.phase !== 'SETUP'
        || state.activeLaneOrder.length !== 3
        || state.activeLaneOrder.some((laneId) => {
          const lane = state.lanesById[laneId];
          const locationId = lane?.locationSlot.locationCardId;
          const location = locationId ? readLocationInternal(state, locationId) : null;
          return lane?.status !== 'ACTIVE'
            || !location
            || location.zone !== 'LANE'
            || location.face !== 'FACE_DOWN';
        })
      ) {
        return state;
      }
      return { ...state, phase: 'AWAITING_INTENT' };
    }

    case 'TURN_RESOLUTION_STARTED':
      if (event.turn !== state.turn) return state;
      return {
        ...state,
        phase: 'RESOLVING',
      };

    case 'TURN_STARTED':
      // Priority is stored in state; reason is event-history-only. Phase enters
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
      const cards: Record<string, InternalCardRecord> = {};
      for (const [id, c] of Object.entries(cardRecordsInternal(state))) {
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
        cardStore: createCardStoreInternal(cards),
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
      // Diagnostic-only; no mechanical mutation beyond timeline advancement.
      return state;
  }
}

// ---- Structural helpers ----------------------------------------------------

/** Create a new InternalCardRecord if none exists at `id`, or update the
 *  existing one's zone/lane/owner/spawnSource. Used by the mint-style
 *  ADDED_TO_HAND / ADDED_TO_LANE events. */
function mintOrUpdate(
  state: MatchState,
  id: CardId,
  defId: string,
  owner: Owner,
  spawnSource: SpawnSource,
  zone: 'HAND' | 'LANE' | 'DECK',
  lane: LaneId | null = null,
): MatchState {
  const existing = readCardInternal(state, id);
  if (existing) {
    return patchCard(state, id, {
      defId,
      owner,
      zone,
      lane,
      revealTiming: null,
      spawnSource,
    });
  }
  const fresh: InternalCardRecord = {
    id,
    defId,
    version: 1,
    owner,
    lane,
    zone,
    revealed: zone === 'LANE' ? false : false,
    revealTiming: null,
    lifecycle: { ...EMPTY_CARD_LIFECYCLE },
    powerLedger: [],
    costDelta: 0,
    costLog: [],
    tags: [],
    textOverride: null,
    textLog: [],
    counters: {},
    spawnSource,
  };
  return writeCardRecordsInternal(state, {
    ...cardRecordsInternal(state),
    [id]: fresh,
  });
}

function patchCard(state: MatchState, id: CardId, patch: Partial<InternalCardRecord>): MatchState {
  const prev = readCardInternal(state, id);
  if (!prev) return state;
  return writeCardRecordsInternal(state, {
    ...cardRecordsInternal(state),
    [id]: { ...prev, ...patch },
  });
}

function patchLane(state: MatchState, laneId: LaneId, patch: Partial<LaneState>): MatchState {
  const prev = state.lanesById[laneId];
  if (!prev) return state;
  const next: LaneState = { ...prev, ...patch };
  return {
    ...state,
    lanesById: { ...state.lanesById, [laneId]: next },
  };
}

function addToLane(state: MatchState, owner: Owner, lane: LaneId, cardId: CardId): MatchState {
  const prev = state.lanesById[lane];
  if (!prev) return state;
  if (prev.cards[owner].includes(cardId)) return state;
  return patchLane(state, lane, {
    cards: { ...prev.cards, [owner]: [...prev.cards[owner], cardId] },
  });
}

function removeFromLane(state: MatchState, owner: Owner, lane: LaneId, cardId: CardId): MatchState {
  const prev = state.lanesById[lane];
  if (!prev) return state;
  return patchLane(state, lane, {
    cards: {
      ...prev.cards,
      [owner]: prev.cards[owner].filter(id => id !== cardId),
    },
  });
}

function addToHand(state: MatchState, owner: Owner, cardId: CardId): MatchState {
  if (!readCardInternal(state, cardId)) return state;
  if (state.hand[owner].includes(cardId)) return state;
  return { ...state, hand: { ...state.hand, [owner]: [...state.hand[owner], cardId] } };
}

function removeFromHand(state: MatchState, owner: Owner, cardId: CardId): MatchState {
  return {
    ...state,
    hand: { ...state.hand, [owner]: state.hand[owner].filter(id => id !== cardId) },
  };
}

function removeFromAllCardZones(state: MatchState, owner: Owner, cardId: CardId): MatchState {
  let s = state;
  for (const laneId of Object.keys(s.lanesById).map(Number) as LaneId[]) {
    s = removeFromLane(s, owner, laneId, cardId);
  }
  s = removeFromHand(s, owner, cardId);
  return {
    ...s,
    deck: { ...s.deck, [owner]: s.deck[owner].filter(id => id !== cardId) },
    stagingOrder: s.stagingOrder.filter(id => id !== cardId),
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

function laneStatus(lane: LaneState): NonNullable<LaneState['status']> {
  return lane.status;
}

function activeLaneIds(state: MatchState): readonly LaneId[] {
  return state.activeLaneOrder;
}

function locationAtLane(
  state: MatchState,
  laneId: LaneId,
): InternalLocationRecord | null {
  const id = state.lanesById[laneId]?.locationSlot.locationCardId;
  return id ? readLocationInternal(state, id) ?? null : null;
}

function patchLocationCard(
  state: MatchState,
  id: LocationCardInstanceId,
  patch: Partial<InternalLocationRecord>,
): MatchState {
  const previous = readLocationInternal(state, id);
  if (!previous) return state;
  return writeLocationRecordsInternal(state, {
    ...locationRecordsInternal(state),
    [id]: { ...previous, ...patch },
  });
}

function moveLocationToZone(
  state: MatchState,
  id: LocationCardInstanceId,
  destination: 'DISCARD' | 'DESTROYED' | 'BANISHED',
): MatchState {
  const location = readLocationInternal(state, id);
  if (!location) return state;
  const withoutId = (ids: readonly LocationCardInstanceId[]) =>
    ids.filter(candidate => candidate !== id);
  const locationDeck = {
    drawPile: withoutId(state.locationDeck.drawPile),
    staging: withoutId(state.locationDeck.staging),
    discardPile: withoutId(state.locationDeck.discardPile),
    destroyed: withoutId(state.locationDeck.destroyed),
    banished: withoutId(state.locationDeck.banished),
  };
  const target = destination === 'DISCARD'
    ? 'discardPile'
    : destination === 'DESTROYED'
      ? 'destroyed'
      : 'banished';
  return patchLocationCard({
    ...state,
    locationDeck: {
      ...locationDeck,
      [target]: [...locationDeck[target], id],
    },
  }, id, {
    zone: destination,
    laneId: null,
    pendingLaneId: null,
  });
}

// ---- trackedVariables maintenance ------------------------------------------

/** Resolve source card owner from an EffectRef (null if source is a location or unknown). */
function sourceOwnerOf(state: MatchState, cause: { sourceId: CardId | string }): Owner | null {
  const src = readCardInternal(state, cause.sourceId as CardId);
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
      const card = readCardInternal(next, event.cardId);
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
      const card = readCardInternal(next, event.cardId);
      if (!card) break;
      const owner = card.owner;
      const prev = tv[owner];
      tv = patchOwnerVars(tv, owner, { cardsYouDiscarded: prev.cardsYouDiscarded + 1 });
      break;
    }

    case 'CARD_MOVED': {
      const card = readCardInternal(next, event.cardId);
      if (!card) break;
      const owner = card.owner;
      const prev = tv[owner];
      tv = patchOwnerVars(tv, owner, { cardsMoved: prev.cardsMoved + 1 });
      break;
    }

    case 'CARD_ADDED_TO_DECK':
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
      const card = readCardInternal(next, event.cardId);
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

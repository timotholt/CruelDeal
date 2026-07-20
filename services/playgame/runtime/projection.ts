import type { Manifest } from '../engine/manifest/types';
import { cyrb128 } from '../engine/rng';
import { getCardCost, getCardPower } from '../engine/projections';
import { getAllCardStates } from '../engine/projections/cardRuntime';
import {
  getLocationState,
  redactLocationsForSeat,
} from '../engine/projections/locationRuntime';
import type { EventTransition } from '../engine/transactionTimeline';
import type { MatchEvent } from '../engine/types/events';
import type {
  CardZone,
  LocationCardFace,
  MatchPhase,
  MatchResult,
  MatchState,
} from '../engine/types/state';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
  Seat,
} from '../engine/types/ids';
import type { Frame, TemporalScope } from '../engine/types/timeline';
import type {
  CommittedTransactionRecord,
  MatchRevision,
} from './contracts';

export type SeatCardToken = string;
export type SeatLocationToken = string;

export interface SeatVisibleCard {
  readonly token: SeatCardToken;
  readonly owner: Owner;
  readonly zone: Exclude<CardZone, 'DECK' | 'BANISHED'>;
  readonly lane: LaneId | null;
  readonly revealed: boolean;
  /** Absent while this card's identity is hidden from the viewer. */
  readonly defId?: string;
  readonly variantId?: string;
  /** Effective values are absent with hidden identity. */
  readonly cost?: number;
  readonly power?: number;
  readonly tags?: readonly string[];
  readonly counters?: Readonly<Record<string, number>>;
}

export interface SeatVisibleLocation {
  readonly token: SeatLocationToken;
  readonly face: LocationCardFace;
  readonly revealAtTurn: number | null;
  /** Absent while this location's identity is hidden from the viewer. */
  readonly defId?: string;
}

export interface SeatVisibleLane {
  readonly id: LaneId;
  readonly status: MatchState['lanesById'][LaneId]['status'];
  readonly location: SeatVisibleLocation | null;
  readonly cards: Readonly<Record<Owner, readonly SeatCardToken[]>>;
}

/**
 * Small JSON-safe state sent across a player boundary.
 *
 * This is deliberately not MatchState. It excludes gameplay RNG state,
 * hidden deck identities/order, pending-effect internals, mutation ledgers,
 * tracked-variable caches, and authoritative replay history.
 */
export interface SeatVisibleMatchState {
  readonly turn: number;
  readonly phase: MatchPhase;
  readonly priority: Owner;
  readonly energy: Readonly<Record<Owner, number>>;
  readonly maxEnergy: Readonly<Record<Owner, number>>;
  readonly nextTurnEnergyBonus: Readonly<Record<Owner, number>>;
  readonly deckCounts: Readonly<Record<Owner, number>>;
  readonly locationDeckCount: number;
  readonly hands: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly cards: readonly SeatVisibleCard[];
  readonly lanes: readonly SeatVisibleLane[];
  readonly stagedCards: readonly SeatCardToken[];
  readonly discard: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly destroyed: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly banishedCounts: Readonly<Record<Owner, number>>;
  readonly result: MatchResult | null;
}

export interface SeatMatchSnapshot {
  readonly version: 1;
  readonly matchId: string;
  readonly revision: MatchRevision;
  readonly frame: Frame;
  readonly viewerSeat: Seat;
  readonly state: SeatVisibleMatchState;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface SeatAnimationEvent {
  readonly type: MatchEvent['type'];
  readonly data: Readonly<Record<string, JsonValue>>;
}

export interface SeatFramedAnimationEvent {
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: SeatAnimationEvent;
}

export interface SeatCommittedTransaction {
  readonly version: 1;
  readonly transactionId: string;
  readonly matchId: string;
  readonly baseRevision: MatchRevision;
  readonly revision: MatchRevision;
  readonly frame: Frame;
  readonly viewerSeat: Seat;
  readonly events: readonly SeatFramedAnimationEvent[];
  /** Authoritative correction point after the event animation batch. */
  readonly postState: SeatVisibleMatchState;
}

export interface SeatResyncRequest {
  readonly version: 1;
  readonly matchId: string;
  readonly viewerSeat: Seat;
  readonly knownRevision: MatchRevision;
  readonly knownFrame: Frame;
}

export interface SeatResyncResponse {
  readonly version: 1;
  readonly snapshot: SeatMatchSnapshot;
  readonly transactions: readonly SeatCommittedTransaction[];
}

function opaqueToken(
  state: MatchState,
  viewerSeat: Seat,
  kind: 'card' | 'location',
  id: string,
): string {
  const [high, low] = cyrb128(
    `seat-token-v1|${state.rng.seed}|${viewerSeat}|${kind}|${id}`,
  );
  return `${kind === 'card' ? 'c' : 'l'}_${high.toString(16).padStart(8, '0')}`
    + low.toString(16).padStart(8, '0');
}

function cardToken(
  state: MatchState,
  viewerSeat: Seat,
  cardId: string,
): SeatCardToken {
  return opaqueToken(state, viewerSeat, 'card', cardId);
}

function locationToken(
  state: MatchState,
  viewerSeat: Seat,
  locationId: string,
): SeatLocationToken {
  return opaqueToken(state, viewerSeat, 'location', locationId);
}

function cardIdentityVisible(
  state: MatchState,
  cardId: string,
  viewerSeat: Seat,
): boolean {
  const card = getAllCardStates(state)
    .find(candidate => candidate.id === cardId as CardId);
  return card !== undefined && (card.owner === viewerSeat || card.revealed);
}

function locationIdentityVisible(
  state: MatchState,
  locationId: string,
  viewerSeat: Seat,
): boolean {
  const location = getLocationState(
    state,
    locationId as LocationCardInstanceId,
  );
  return location !== null && (
    location.face === 'FACE_UP'
    || location.identityKnownTo.includes(viewerSeat)
  );
}

function zoneTokens(
  state: MatchState,
  viewerSeat: Seat,
  owner: Owner,
  zone: 'DISCARD' | 'DESTROYED',
): readonly SeatCardToken[] {
  return getAllCardStates(state)
    .filter(card => card.owner === owner && card.zone === zone)
    .map(card => cardToken(state, viewerSeat, card.id));
}

export function projectMatchStateForSeat(
  state: MatchState,
  viewerSeat: Seat,
  manifest: Manifest,
): SeatVisibleMatchState {
  const cards = getAllCardStates(state)
    .filter(card => card.zone !== 'DECK' && card.zone !== 'BANISHED')
    .map((card): SeatVisibleCard => {
      const visible = card.owner === viewerSeat || card.revealed;
      const base: SeatVisibleCard = {
        token: cardToken(state, viewerSeat, card.id),
        owner: card.owner,
        zone: card.zone as SeatVisibleCard['zone'],
        lane: card.lane,
        revealed: card.revealed,
      };
      if (!visible) return base;
      return {
        ...base,
        defId: card.defId,
        ...(card.variantId === undefined ? {} : { variantId: card.variantId }),
        cost: getCardCost(state, card.id, manifest),
        power: getCardPower(state, card.id, manifest),
        ...(card.tags.length === 0 ? {} : {
          tags: card.tags.map(tag => tag.kind),
        }),
        ...(Object.keys(card.counters).length === 0 ? {} : {
          counters: { ...card.counters },
        }),
      };
    });

  const lanes = state.activeLaneOrder.map((laneId): SeatVisibleLane => {
    const lane = state.lanesById[laneId];
    const locationId = lane.locationSlot.locationCardId;
    const location = locationId === null ? null : getLocationState(state, locationId);
    const identityVisible = location !== null && (
      location.face === 'FACE_UP'
      || location.identityKnownTo.includes(viewerSeat)
    );
    return {
      id: lane.id,
      status: lane.status,
      location: location === null ? null : {
        token: locationToken(state, viewerSeat, location.id),
        face: location.face,
        revealAtTurn: lane.locationSlot.revealAtTurn,
        ...(identityVisible ? { defId: location.defId } : {}),
      },
      cards: {
        P0: lane.cards.P0.map(id => cardToken(state, viewerSeat, id)),
        P1: lane.cards.P1.map(id => cardToken(state, viewerSeat, id)),
      },
    };
  });

  const banishedCounts = (owner: Owner): number => getAllCardStates(state)
    .filter(card => card.owner === owner && card.zone === 'BANISHED')
    .length;

  return {
    turn: state.turn,
    phase: state.phase,
    priority: state.priority,
    energy: { ...state.energy },
    maxEnergy: { ...state.maxEnergy },
    nextTurnEnergyBonus: { ...state.nextTurnEnergyBonus },
    deckCounts: { P0: state.deck.P0.length, P1: state.deck.P1.length },
    locationDeckCount: state.locationDeck.drawPile.length,
    hands: {
      P0: state.hand.P0.map(id => cardToken(state, viewerSeat, id)),
      P1: state.hand.P1.map(id => cardToken(state, viewerSeat, id)),
    },
    cards,
    lanes,
    stagedCards: state.stagedPlays.map(
      staged => cardToken(state, viewerSeat, staged.cardId),
    ),
    discard: {
      P0: zoneTokens(state, viewerSeat, 'P0', 'DISCARD'),
      P1: zoneTokens(state, viewerSeat, 'P1', 'DISCARD'),
    },
    destroyed: {
      P0: zoneTokens(state, viewerSeat, 'P0', 'DESTROYED'),
      P1: zoneTokens(state, viewerSeat, 'P1', 'DESTROYED'),
    },
    banishedCounts: {
      P0: banishedCounts('P0'),
      P1: banishedCounts('P1'),
    },
    result: state.result === null ? null : {
      winner: state.result.winner,
      lanesWon: { ...state.result.lanesWon },
      totalPower: { ...state.result.totalPower },
    },
  };
}

export function projectSnapshotForSeat(
  matchId: string,
  revision: MatchRevision,
  state: MatchState,
  viewerSeat: Seat,
  manifest: Manifest,
): SeatMatchSnapshot {
  return {
    version: 1,
    matchId,
    revision,
    frame: state.timeline.frame,
    viewerSeat,
    state: projectMatchStateForSeat(state, viewerSeat, manifest),
  };
}

function cardEventVisible(
  transition: EventTransition,
  cardId: string,
  viewerSeat: Seat,
): boolean {
  return cardIdentityVisible(transition.before, cardId, viewerSeat)
    || cardIdentityVisible(transition.after, cardId, viewerSeat);
}

function projectAnimationEvent(
  transition: EventTransition,
  viewerSeat: Seat,
): SeatAnimationEvent | null {
  const event = transition.event;
  const card = (id: string): SeatCardToken => cardToken(
    transition.after,
    viewerSeat,
    id,
  );
  const location = (id: string): SeatLocationToken => locationToken(
    transition.after,
    viewerSeat,
    id,
  );
  switch (event.type) {
    case 'GAMEPLAY_RNG_ADVANCED':
    case 'PENDING_EFFECT_SCHEDULED':
    case 'PENDING_EFFECT_CONSUMED':
    case 'OR_WINDOW_OPEN':
    case 'OR_WINDOW_CLOSE':
    case 'RECURSION_LIMIT_HIT':
    case 'INTENT_REJECTED':
      return null;

    case 'MATCH_SETUP_COMPLETED':
      return { type: event.type, data: {} };
    case 'TURN_RESOLUTION_STARTED':
    case 'TURN_ENDED':
      return { type: event.type, data: { turn: event.turn } };
    case 'TURN_STARTED':
      return {
        type: event.type,
        data: {
          turn: event.turn,
          priority: event.priority,
          priorityReason: event.priorityReason,
        },
      };
    case 'MATCH_ENDED':
      return { type: event.type, data: { result: event.result } };

    case 'ENERGY_CHANGED':
      return {
        type: event.type,
        data: { owner: event.owner, delta: event.delta, reason: event.reason },
      };
    case 'MAX_ENERGY_CHANGED':
      return {
        type: event.type,
        data: { owner: event.owner, delta: event.delta, reason: event.reason },
      };
    case 'NEXT_TURN_ENERGY_BONUS_CHANGED':
      return {
        type: event.type,
        data: { owner: event.owner, delta: event.delta },
      };

    case 'CARD_STAGED':
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          lane: event.lane,
          owner: event.owner,
        },
      };
    case 'CARD_DRAWN':
      return {
        type: event.type,
        data: { owner: event.owner, card: card(event.cardId) },
      };
    case 'DECK_SHUFFLED':
      return { type: event.type, data: { owner: event.owner } };
    case 'CARD_CREATED': {
      const visible = event.owner === viewerSeat
        || cardEventVisible(transition, event.cardId, viewerSeat);
      return {
        type: event.type,
        data: {
          owner: event.owner,
          ...(event.destination.kind !== 'DECK' || event.owner === viewerSeat
            ? { card: card(event.cardId) }
            : {}),
          destination: event.destination,
          ...(visible ? { defId: event.defId } : {}),
        },
      };
    }

    case 'CARD_REVEALED': {
      const cardState = getAllCardStates(transition.after)
        .find(candidate => candidate.id === event.cardId);
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          ...(cardState ? { defId: cardState.defId } : {}),
        },
      };
    }
    case 'CARD_PLAY_COMPLETED':
      return {
        type: event.type,
        data: {
          owner: event.owner,
          lane: event.lane,
          card: card(event.cardId),
        },
      };
    case 'CARD_REVEAL_SCHEDULED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), timing: event.timing } }
        : null;
    case 'CARD_POWER_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), mutation: event.mutation } }
        : null;
    case 'CARD_COST_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), delta: event.delta } }
        : null;
    case 'CARD_DESTROYED':
    case 'CARD_BANISHED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId) } }
        : null;
    case 'CARD_DISCARDED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? {
            type: event.type,
            data: { card: card(event.cardId), reason: event.reason },
          }
        : null;
    case 'CARD_MOVED':
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          fromLane: event.fromLane,
          toLane: event.toLane,
        },
      };
    case 'CARD_RETURNED_TO_LANE':
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          lane: event.lane,
          revealed: event.revealed,
        },
      };
    case 'CARD_TRANSFORMED': {
      const visible = cardEventVisible(transition, event.cardId, viewerSeat);
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          ...(visible
            ? {
                defId: event.newDefId,
                metadataPolicy: event.metadataPolicy,
              }
            : {}),
        },
      };
    }
    case 'CARD_TAG_ADDED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), tag: event.tag.kind } }
        : null;
    case 'CARD_TAG_REMOVED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), tag: event.tag } }
        : null;
    case 'CARD_TEXT_OVERRIDDEN':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId) } }
        : null;
    case 'CARD_COUNTER_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? {
            type: event.type,
            data: { card: card(event.cardId), name: event.name, delta: event.delta },
          }
        : null;
    case 'CARD_ZONE_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? {
            type: event.type,
            data: { card: card(event.cardId), destination: event.destination },
          }
        : null;

    case 'LOCATION_DECK_INITIALIZED':
      return {
        type: event.type,
        data: { count: event.locations.length },
      };
    case 'LOCATION_CARD_CREATED':
    case 'LOCATION_CARD_DRAWN':
      return null;
    case 'LOCATION_CARD_PLAYED': {
      const visible = locationIdentityVisible(
        transition.after,
        event.locationId,
        viewerSeat,
      );
      const locationState = getLocationState(transition.after, event.locationId);
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          lane: event.lane,
          ...(visible && locationState ? { defId: locationState.defId } : {}),
        },
      };
    }
    case 'LOCATION_SLOT_REVEAL_SCHEDULED':
      return {
        type: event.type,
        data: { lane: event.lane, revealAtTurn: event.revealAtTurn },
      };
    case 'LOCATION_REVEALED': {
      const locationState = getLocationState(transition.after, event.locationId);
      return {
        type: event.type,
        data: {
          lane: event.lane,
          location: location(event.locationId),
          ...(locationState ? { defId: locationState.defId } : {}),
        },
      };
    }
    case 'LOCATION_TURNED_FACE_DOWN':
      return {
        type: event.type,
        data: { lane: event.lane, location: location(event.locationId) },
      };
    case 'LOCATION_SHOWN_TO_SEATS':
      if (!event.seats.includes(viewerSeat)) return null;
      return {
        type: event.type,
        data: {
          lane: event.lane,
          location: location(event.locationId),
          defId: getLocationState(transition.after, event.locationId)?.defId ?? '',
        },
      };
    case 'LOCATION_REPLACED': {
      const visible = locationIdentityVisible(
        transition.after,
        event.newId,
        viewerSeat,
      );
      return {
        type: event.type,
        data: {
          lane: event.lane,
          oldLocation: location(event.oldId),
          newLocation: location(event.newId),
          ...(visible ? { defId: event.newDefId } : {}),
          oldDestination: event.oldDestination,
          revealPolicy: event.revealPolicy,
          ...(event.revealAtTurn === undefined ? {} : {
            revealAtTurn: event.revealAtTurn,
          }),
        },
      };
    }
    case 'LOCATIONS_SWAPPED':
      return {
        type: event.type,
        data: {
          left: {
            location: location(event.left.locationId),
            fromLane: event.left.fromLane,
            toLane: event.left.toLane,
          },
          right: {
            location: location(event.right.locationId),
            fromLane: event.right.fromLane,
            toLane: event.right.toLane,
          },
        },
      };
    case 'LOCATION_MOVED':
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          fromLane: event.fromLane,
          toLane: event.toLane,
        },
      };
    case 'LOCATION_REMOVED_FROM_LANE':
      return {
        type: event.type,
        data: {
          lane: event.lane,
          location: location(event.locationId),
          destination: event.destination,
        },
      };
    case 'LOCATION_RETURNED_TO_DECK':
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          from: event.from,
          placement: event.placement,
        },
      };
    case 'LOCATION_TAG_ADDED':
      return {
        type: event.type,
        data: { location: location(event.locationId), tag: event.tag.kind },
      };
    case 'LOCATION_TAG_REMOVED':
      return {
        type: event.type,
        data: { location: location(event.locationId), tag: event.tag },
      };
    case 'LOCATION_COUNTER_CHANGED':
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          name: event.name,
          owner: event.owner,
          delta: event.delta,
        },
      };

    case 'LANE_DESTRUCTION_STARTED':
    case 'LANE_DESTROYED':
      return {
        type: event.type,
        data: { lane: event.lane, position: event.priorPosition },
      };
    case 'LANE_CREATION_STARTED':
    case 'LANE_CREATED':
      return {
        type: event.type,
        data: { lane: event.lane, position: event.position },
      };
  }
}

export function projectTransactionForSeat(
  transaction: CommittedTransactionRecord,
  transitions: readonly EventTransition[],
  viewerSeat: Seat,
  manifest: Manifest,
): SeatCommittedTransaction {
  if (
    transitions.length !== transaction.framedEvents.length
    || transitions.some(transition => transition.transactionId !== transaction.transactionId)
  ) {
    throw new Error(
      `projectTransactionForSeat: transitions do not match ${transaction.transactionId}`,
    );
  }
  const finalState = transitions.at(-1)?.after;
  if (!finalState) {
    throw new Error('projectTransactionForSeat: a committed transaction cannot be empty');
  }
  const events = transitions.flatMap((transition): SeatFramedAnimationEvent[] => {
    const projected = projectAnimationEvent(transition, viewerSeat);
    return projected === null ? [] : [{
      frame: transition.frame,
      scope: { ...transition.scope },
      event: projected,
    }];
  });
  return {
    version: 1,
    transactionId: transaction.transactionId,
    matchId: transaction.matchId,
    baseRevision: transaction.baseRevision,
    revision: transaction.revision,
    frame: finalState.timeline.frame,
    viewerSeat,
    events,
    postState: projectMatchStateForSeat(finalState, viewerSeat, manifest),
  };
}

/**
 * Client-side authoritative correction after animating a projected batch.
 * Filtered frame numbers may contain gaps because authority-only events are
 * intentionally absent.
 */
export function applySeatCommittedTransaction(
  snapshot: SeatMatchSnapshot,
  transaction: SeatCommittedTransaction,
): SeatMatchSnapshot {
  if (
    transaction.matchId !== snapshot.matchId
    || transaction.viewerSeat !== snapshot.viewerSeat
  ) {
    throw new Error('applySeatCommittedTransaction: match or seat mismatch');
  }
  if (
    transaction.baseRevision < snapshot.revision
    || transaction.revision !== transaction.baseRevision + 1
  ) {
    throw new Error(
      `applySeatCommittedTransaction: stale or invalid revision `
      + `${transaction.baseRevision}->${transaction.revision} after ${snapshot.revision}`,
    );
  }
  if (transaction.frame < snapshot.frame) {
    throw new Error('applySeatCommittedTransaction: frame moved backwards');
  }
  let previousFrame = snapshot.frame;
  for (const projected of transaction.events) {
    if (projected.frame <= previousFrame || projected.frame > transaction.frame) {
      throw new Error(
        `applySeatCommittedTransaction: invalid projected frame ${projected.frame}`,
      );
    }
    previousFrame = projected.frame;
  }
  return {
    version: 1,
    matchId: snapshot.matchId,
    revision: transaction.revision,
    frame: transaction.frame,
    viewerSeat: snapshot.viewerSeat,
    state: transaction.postState,
  };
}

/**
 * Server-controller-only mechanical view. This is not serializable wire data.
 * It preserves the engine shape required by AI planning while redacting
 * hidden location identity and future location order.
 */
export function projectMechanicalStateForController(
  state: MatchState,
  controllerSeat: Seat,
): MatchState {
  return redactLocationsForSeat(state, controllerSeat);
}

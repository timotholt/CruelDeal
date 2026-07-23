import type { LaneId, Owner } from '../engine/types/ids';
import type {
  SeatAnimationEvent,
  SeatCardToken,
  SeatVisibleCard,
  SeatVisibleMatchState,
} from '../runtime/projection';
import type { CardVisualFace } from './cardMotion';
import { CARD_MOTION_TIMING } from './cardMotionTiming';
import {
  eventBoolean,
  eventCardToken,
  eventLane,
  eventOwner,
  eventRecord,
} from './projectedEvent';

export type CardZoneRef =
  | { kind: 'DECK'; owner: Owner }
  | { kind: 'HAND'; owner: Owner; index?: number }
  | { kind: 'LANE'; owner: Owner; lane: LaneId; index?: number }
  | { kind: 'DISCARD'; owner: Owner }
  | { kind: 'DESTROYED'; owner: Owner }
  | { kind: 'BANISHED'; owner: Owner }
  | { kind: 'GENERATED'; owner: Owner; sourceId?: string }
  | { kind: 'OFFBOARD' };

export type TransferRoute =
  | 'visible-to-visible'
  | 'visible-to-anchor'
  | 'anchor-to-visible'
  | 'anchor-to-anchor'
  | 'layout-only';

export type TransferStyle = {
  route: TransferRoute;
  durationMs: number;
  easing: string;
  zIndex: number;
  arc: 'none' | 'small' | 'large';
  spin: 'none' | 'subtle' | 'flip';
  opacity: 'preserve' | 'fadeOut' | 'fadeIn';
  scale: { from: number; to: number };
  sfx?: string;
};

export type CardTransferFace =
  | 'preserve'
  | 'faceUp'
  | 'faceDown'
  | 'ownerVisible';

export type CardTransfer = {
  cardId: SeatCardToken;
  owner: Owner;
  from: CardZoneRef;
  to: CardZoneRef;
  reason: SeatAnimationEvent['type'];
  face: CardTransferFace;
  timing: { dispatch: 'before-flight' | 'after-flight' };
  style: TransferStyle;
  layout: {
    captureBefore: readonly CardZoneRef[];
    slideAfter: readonly CardZoneRef[];
  };
};

export type ZoneAnchorKey =
  | `${Owner}:deck`
  | `${Owner}:hand`
  | `${Owner}:discard`
  | `${Owner}:destroyed`
  | `${Owner}:banished`
  | `${Owner}:lane:${LaneId}`
  | 'generated';

export function resolveCardTransferFace(
  face: CardTransferFace,
  owner: Owner,
  viewer: Owner,
): CardVisualFace | null {
  switch (face) {
    case 'preserve': return null;
    case 'faceUp': return 'faceUp';
    case 'faceDown': return 'faceDown';
    case 'ownerVisible': return owner === viewer ? 'faceUp' : 'faceDown';
  }
}

const visibleZone = (zone: CardZoneRef): boolean =>
  zone.kind === 'HAND' || zone.kind === 'LANE';
const anchorZone = (zone: CardZoneRef): boolean => !visibleZone(zone);

export function zoneAnchorKey(zone: CardZoneRef): ZoneAnchorKey | null {
  switch (zone.kind) {
    case 'DECK': return `${zone.owner}:deck`;
    case 'HAND': return `${zone.owner}:hand`;
    case 'LANE': return `${zone.owner}:lane:${zone.lane}`;
    case 'DISCARD': return `${zone.owner}:discard`;
    case 'DESTROYED': return `${zone.owner}:destroyed`;
    case 'BANISHED': return `${zone.owner}:banished`;
    case 'GENERATED': return 'generated';
    case 'OFFBOARD': return null;
  }
}

const baseStyle: TransferStyle = {
  route: 'layout-only',
  durationMs: 320,
  easing: 'cubic-bezier(.4,0,.2,1)',
  zIndex: 80,
  arc: 'small',
  spin: 'none',
  opacity: 'preserve',
  scale: { from: 1, to: 1 },
};

function styleFor(
  from: CardZoneRef,
  to: CardZoneRef,
  reason: SeatAnimationEvent['type'],
): TransferStyle {
  const route: TransferRoute = visibleZone(from) && visibleZone(to)
    ? 'visible-to-visible'
    : visibleZone(from) && anchorZone(to)
      ? 'visible-to-anchor'
      : anchorZone(from) && visibleZone(to)
        ? 'anchor-to-visible'
        : 'anchor-to-anchor';
  let style = { ...baseStyle, route, scale: { ...baseStyle.scale } };
  if (from.kind === 'LANE' && to.kind === 'LANE') {
    style = { ...style, durationMs: 360, arc: 'small', sfx: 'move' };
  } else if (from.kind === 'HAND' && to.kind === 'LANE') {
    style = {
      ...style,
      durationMs: CARD_MOTION_TIMING.committedHandToLaneMs,
      arc: 'small',
      sfx: 'play',
    };
  } else if (from.kind === 'LANE' && to.kind === 'HAND') {
    style = { ...style, durationMs: 340, arc: 'small', sfx: 'move' };
  } else if (from.kind === 'DECK' && to.kind === 'HAND') {
    style = { ...style, durationMs: 360, spin: 'flip', sfx: 'draw' };
  } else if (from.kind === 'GENERATED' && visibleZone(to)) {
    style = {
      ...style,
      durationMs: 300,
      scale: { from: 0.76, to: 1 },
      sfx: 'draw',
    };
  } else if (
    visibleZone(from)
    && (to.kind === 'DISCARD'
      || to.kind === 'DESTROYED'
      || to.kind === 'BANISHED')
  ) {
    style = {
      ...style,
      durationMs: 280,
      opacity: 'fadeOut',
      scale: { from: 1, to: 0.48 },
      sfx: to.kind === 'DESTROYED' ? 'destroy' : 'move',
    };
  }
  if (reason === 'CARD_BANISHED') {
    style = {
      ...style,
      durationMs: 260,
      opacity: 'fadeOut',
      scale: { from: 1, to: 0.35 },
      sfx: 'destroy',
    };
  }
  return style;
}

function cardAt(
  state: SeatVisibleMatchState,
  token: SeatCardToken,
): SeatVisibleCard | null {
  return state.cards.find(card => card.token === token) ?? null;
}

function zoneOfCard(
  state: SeatVisibleMatchState,
  token: SeatCardToken,
): CardZoneRef | null {
  const card = cardAt(state, token);
  if (!card) return null;
  switch (card.zone) {
    case 'HAND':
      return {
        kind: 'HAND',
        owner: card.owner,
        index: state.hands[card.owner].indexOf(token),
      };
    case 'LANE': {
      if (card.lane === null) return null;
      const lane = state.lanes.find(candidate => candidate.id === card.lane);
      return {
        kind: 'LANE',
        owner: card.owner,
        lane: card.lane,
        index: lane?.cards[card.owner].indexOf(token),
      };
    }
    case 'DISCARD':
      return { kind: 'DISCARD', owner: card.owner };
    case 'DESTROYED':
      return { kind: 'DESTROYED', owner: card.owner };
    default:
      return null;
  }
}

function destinationZone(
  owner: Owner,
  destination: Readonly<Record<string, unknown>> | null,
): CardZoneRef | null {
  switch (destination?.kind) {
    case 'HAND': return { kind: 'HAND', owner };
    case 'DECK': return { kind: 'DECK', owner };
    case 'LANE':
      return typeof destination.lane === 'number'
        ? { kind: 'LANE', owner, lane: destination.lane as LaneId }
        : null;
    default:
      return null;
  }
}

function transfer(
  before: SeatVisibleMatchState,
  after: SeatVisibleMatchState,
  event: SeatAnimationEvent,
  token: SeatCardToken,
  from: CardZoneRef | null,
  to: CardZoneRef | null,
  face: CardTransferFace = 'preserve',
): readonly CardTransfer[] {
  const card = cardAt(after, token) ?? cardAt(before, token);
  if (!card || !from || !to) return [];
  const samePlacement = from.kind === to.kind
    && ('owner' in from ? from.owner : null) === ('owner' in to ? to.owner : null)
    && (from.kind === 'LANE' ? from.lane : null) === (to.kind === 'LANE' ? to.lane : null);
  if (samePlacement) return [];
  const touched = [from, to].filter(visibleZone);
  return [{
    cardId: token,
    owner: card.owner,
    from,
    to,
    reason: event.type,
    face: to.kind === 'HAND' ? 'ownerVisible' : face,
    timing: { dispatch: 'before-flight' },
    style: styleFor(from, to, event.type),
    layout: { captureBefore: touched, slideAfter: touched },
  }];
}

export function deriveCardTransfers(
  before: SeatVisibleMatchState,
  event: SeatAnimationEvent,
  after: SeatVisibleMatchState,
): readonly CardTransfer[] {
  const token = eventCardToken(event);
  if (!token) return [];
  const owner = eventOwner(event)
    ?? cardAt(before, token)?.owner
    ?? cardAt(after, token)?.owner
    ?? null;
  switch (event.type) {
    case 'CARD_DRAWN':
      return owner
        ? transfer(
            before,
            after,
            event,
            token,
            { kind: 'DECK', owner },
            zoneOfCard(after, token),
            'faceUp',
          )
        : [];
    case 'CARD_STAGED': {
      const lane = eventLane(event);
      return owner && lane !== null
        ? transfer(
            before,
            after,
            event,
            token,
            zoneOfCard(before, token),
            { kind: 'LANE', owner, lane },
            'faceDown',
          )
        : [];
    }
    case 'CARD_MOVED': {
      const fromLane = eventLane(event, 'fromLane');
      const toLane = eventLane(event, 'toLane');
      return owner && fromLane !== null && toLane !== null
        ? transfer(
            before,
            after,
            event,
            token,
            { kind: 'LANE', owner, lane: fromLane },
            { kind: 'LANE', owner, lane: toLane },
          )
        : [];
    }
    case 'CARD_ZONE_CHANGED':
      return owner
        ? transfer(
            before,
            after,
            event,
            token,
            zoneOfCard(before, token),
            destinationZone(owner, eventRecord(event, 'destination')),
          )
        : [];
    case 'CARD_RETURNED_TO_LANE': {
      const lane = eventLane(event);
      return owner && lane !== null
        ? transfer(
            before,
            after,
            event,
            token,
            zoneOfCard(before, token),
            { kind: 'LANE', owner, lane },
            eventBoolean(event, 'revealed') ? 'faceUp' : 'faceDown',
          )
        : [];
    }
    case 'CARD_CREATED': {
      const destination = eventRecord(event, 'destination');
      return owner
        ? transfer(
            before,
            after,
            event,
            token,
            { kind: 'GENERATED', owner },
            destinationZone(owner, destination),
            destination?.kind === 'LANE' && destination.revealed === false
              ? 'faceDown'
              : 'faceUp',
          )
        : [];
    }
    case 'CARD_DISCARDED':
    case 'CARD_DESTROYED':
    case 'CARD_BANISHED': {
      if (!owner) return [];
      const kind = event.type === 'CARD_DISCARDED'
        ? 'DISCARD'
        : event.type === 'CARD_DESTROYED'
          ? 'DESTROYED'
          : 'BANISHED';
      return transfer(
        before,
        after,
        event,
        token,
        zoneOfCard(before, token),
        { kind, owner },
      );
    }
    default:
      return [];
  }
}

const structuralCardEventTypes = new Set<SeatAnimationEvent['type']>([
  'CARD_DRAWN',
  'CARD_STAGED',
  'CARD_MOVED',
  'CARD_ZONE_CHANGED',
  'CARD_RETURNED_TO_LANE',
  'CARD_CREATED',
  'CARD_DISCARDED',
  'CARD_DESTROYED',
  'CARD_BANISHED',
]);

function cardPlacementKey(card: SeatVisibleCard | null): string {
  return card ? `${card.zone}|${card.lane ?? ''}|${card.owner}` : 'absent';
}

export function assertTransferCoverage(
  before: SeatVisibleMatchState,
  event: SeatAnimationEvent,
  after: SeatVisibleMatchState,
  transfers: readonly CardTransfer[],
): void {
  if (!structuralCardEventTypes.has(event.type)) return;
  const tokens = new Set([
    ...before.cards.map(card => card.token),
    ...after.cards.map(card => card.token),
  ]);
  const changed = [...tokens].filter(token =>
    cardPlacementKey(cardAt(before, token))
      !== cardPlacementKey(cardAt(after, token)));
  if (changed.length === 0) return;
  const covered = new Set(transfers.map(transfer => transfer.cardId));
  const missing = changed.filter(token => !covered.has(token));
  if (missing.length > 0) {
    throw new Error(
      `Missing card transfer animation for ${event.type}: ${missing.join(', ')}`,
    );
  }
}

export function isVisibleZone(zone: CardZoneRef): boolean {
  return visibleZone(zone);
}

export function isCardPileZone(
  zone: CardZoneRef,
): zone is Extract<CardZoneRef, {
  kind: 'DISCARD' | 'DESTROYED' | 'BANISHED';
}> {
  return zone.kind === 'DISCARD'
    || zone.kind === 'DESTROYED'
    || zone.kind === 'BANISHED';
}

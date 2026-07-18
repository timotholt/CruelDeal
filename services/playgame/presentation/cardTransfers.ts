import type { MatchEvent } from '../engine/types/events';
import type { CardId, LaneId, Owner } from '../engine/types/ids';
import type { CardInstance, CardZone, MatchState } from '../engine/types/state';

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

export type TransferTiming = {
  dispatch: 'before-flight' | 'after-flight';
};

export type TransferLayoutPlan = {
  captureBefore: readonly CardZoneRef[];
  slideAfter: readonly CardZoneRef[];
};

export type CardTransfer = {
  cardId: CardId;
  owner: Owner;
  from: CardZoneRef;
  to: CardZoneRef;
  reason: MatchEvent['type'];
  face: 'preserve' | 'faceUp' | 'faceDown';
  timing: TransferTiming;
  style: TransferStyle;
  layout: TransferLayoutPlan;
};

export type ZoneAnchorKey =
  | `${Owner}:deck`
  | `${Owner}:hand`
  | `${Owner}:discard`
  | `${Owner}:destroyed`
  | `${Owner}:banished`
  | `${Owner}:lane:${LaneId}`
  | 'generated';

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

const visibleZone = (zone: CardZoneRef): boolean => zone.kind === 'HAND' || zone.kind === 'LANE';
const anchorZone = (zone: CardZoneRef): boolean => zone.kind !== 'HAND' && zone.kind !== 'LANE';

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

function styleFor(from: CardZoneRef, to: CardZoneRef, reason: MatchEvent['type']): TransferStyle {
  const route: TransferRoute = visibleZone(from) && visibleZone(to)
    ? 'visible-to-visible'
    : visibleZone(from) && anchorZone(to)
      ? 'visible-to-anchor'
      : anchorZone(from) && visibleZone(to)
        ? 'anchor-to-visible'
        : anchorZone(from) && anchorZone(to)
          ? 'anchor-to-anchor'
          : 'layout-only';

  let style: TransferStyle = { ...baseStyle, route, scale: { ...baseStyle.scale } };

  if (from.kind === 'LANE' && to.kind === 'LANE') {
    style = { ...style, durationMs: 360, arc: 'small', sfx: 'move' };
  } else if (from.kind === 'HAND' && to.kind === 'LANE') {
    style = { ...style, durationMs: 300, arc: 'small', sfx: 'play' };
  } else if (from.kind === 'LANE' && to.kind === 'HAND') {
    style = { ...style, durationMs: 340, arc: 'small', sfx: 'move' };
  } else if (from.kind === 'DECK' && to.kind === 'HAND') {
    style = { ...style, durationMs: 360, spin: 'flip', sfx: 'draw' };
  } else if (from.kind === 'GENERATED' && visibleZone(to)) {
    style = { ...style, durationMs: 300, scale: { from: 0.76, to: 1 }, sfx: 'draw' };
  } else if (visibleZone(from) && ['DISCARD', 'DESTROYED', 'BANISHED'].includes(to.kind)) {
    style = { ...style, durationMs: 280, opacity: 'fadeOut', scale: { from: 1, to: 0.48 }, sfx: to.kind === 'DESTROYED' ? 'destroy' : 'move' };
  } else if (['DISCARD', 'DESTROYED', 'BANISHED'].includes(from.kind) && visibleZone(to)) {
    style = { ...style, durationMs: 340, opacity: 'fadeIn', scale: { from: 0.72, to: 1 }, sfx: 'move' };
  }

  if (reason === 'CARD_BANISHED') {
    style = { ...style, durationMs: 260, opacity: 'fadeOut', scale: { from: 1, to: 0.35 }, sfx: 'destroy' };
  }

  return style;
}

function zoneOfCard(state: MatchState, cardId: CardId): CardZoneRef | null {
  const card = state.cards[cardId];
  if (!card) return null;
  return zoneOfInstance(state, card);
}

function zoneOfInstance(state: MatchState, card: CardInstance): CardZoneRef {
  switch (card.zone) {
    case 'DECK': {
      const index = state.deck[card.owner].findIndex(c => c.id === card.id);
      return { kind: 'DECK', owner: card.owner, ...(index >= 0 ? { index } : {}) } as CardZoneRef;
    }
    case 'HAND': {
      const index = state.hand[card.owner].findIndex(c => c.id === card.id);
      return { kind: 'HAND', owner: card.owner, ...(index >= 0 ? { index } : {}) };
    }
    case 'LANE': {
      const lane = card.lane ?? 0;
      const index = state.lanes[lane].cards[card.owner].findIndex(id => id === card.id);
      return { kind: 'LANE', owner: card.owner, lane: lane as LaneId, ...(index >= 0 ? { index } : {}) };
    }
    case 'DISCARD':
      return { kind: 'DISCARD', owner: card.owner };
    case 'DESTROYED':
      return { kind: 'DESTROYED', owner: card.owner };
    case 'BANISHED':
      return { kind: 'BANISHED', owner: card.owner };
  }
}

function destinationZone(owner: Owner, destination: Extract<MatchEvent, { type: 'CARD_MOVED_TO_ZONE' }>['destination']): CardZoneRef {
  switch (destination.kind) {
    case 'HAND': return { kind: 'HAND', owner };
    case 'DECK': return { kind: 'DECK', owner };
    case 'LANE': return { kind: 'LANE', owner, lane: destination.lane };
  }
}

function transfer(
  before: MatchState,
  after: MatchState,
  event: MatchEvent,
  cardId: CardId,
  from: CardZoneRef | null,
  to: CardZoneRef | null,
  face: CardTransfer['face'] = 'preserve',
): CardTransfer[] {
  const card = after.cards[cardId] ?? before.cards[cardId];
  if (!card || !from || !to) return [];
  const style = styleFor(from, to, event.type);
  const touched = [from, to].filter((zone) => zone.kind === 'HAND' || zone.kind === 'LANE');
  return [{
    cardId,
    owner: card.owner,
    from,
    to,
    reason: event.type,
    face,
    timing: { dispatch: 'before-flight' },
    style,
    layout: {
      captureBefore: touched,
      slideAfter: touched,
    },
  }];
}

export function deriveCardTransfers(before: MatchState, event: MatchEvent, after: MatchState): readonly CardTransfer[] {
  switch (event.type) {
    case 'CARD_DRAWN':
      return transfer(before, after, event, event.cardId, { kind: 'DECK', owner: event.owner }, zoneOfCard(after, event.cardId), 'faceUp');

    case 'CARD_STAGED':
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId), { kind: 'LANE', owner: event.owner, lane: event.lane }, 'faceDown');

    case 'CARD_UNSTAGED':
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId), zoneOfCard(after, event.cardId), 'faceUp');

    case 'CARD_MOVED': {
      const card = before.cards[event.cardId] ?? after.cards[event.cardId];
      if (!card) return [];
      return transfer(
        before,
        after,
        event,
        event.cardId,
        { kind: 'LANE', owner: card.owner, lane: event.fromLane },
        { kind: 'LANE', owner: card.owner, lane: event.toLane },
      );
    }

    case 'CARD_MOVED_TO_ZONE': {
      const owner = before.cards[event.cardId]?.owner ?? after.cards[event.cardId]?.owner;
      if (!owner) return [];
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId), destinationZone(owner, event.destination));
    }

    case 'CARD_RETURNED_TO_LANE': {
      const owner = before.cards[event.cardId]?.owner ?? after.cards[event.cardId]?.owner;
      if (!owner) return [];
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId), { kind: 'LANE', owner, lane: event.lane }, event.revealed ? 'faceUp' : 'faceDown');
    }

    case 'CARD_ADDED_TO_HAND':
      return transfer(before, after, event, event.cardId, { kind: 'GENERATED', owner: event.owner }, zoneOfCard(after, event.cardId), 'faceUp');

    case 'CARD_ADDED_TO_LANE':
      return transfer(before, after, event, event.cardId, { kind: 'GENERATED', owner: event.owner }, { kind: 'LANE', owner: event.owner, lane: event.lane }, 'faceUp');

    case 'CARD_ADDED_TO_DECK':
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId) ?? { kind: 'GENERATED', owner: event.owner }, { kind: 'DECK', owner: event.owner });

    case 'CARD_DISCARDED': {
      const owner = before.cards[event.cardId]?.owner ?? after.cards[event.cardId]?.owner;
      if (!owner) return [];
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId), { kind: 'DISCARD', owner });
    }

    case 'CARD_DESTROYED': {
      const owner = before.cards[event.cardId]?.owner ?? after.cards[event.cardId]?.owner;
      if (!owner) return [];
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId), { kind: 'DESTROYED', owner });
    }

    case 'CARD_BANISHED': {
      const owner = before.cards[event.cardId]?.owner ?? after.cards[event.cardId]?.owner;
      if (!owner) return [];
      return transfer(before, after, event, event.cardId, zoneOfCard(before, event.cardId), { kind: 'BANISHED', owner });
    }

    default:
      return [];
  }
}

const structuralCardEventTypes = new Set<MatchEvent['type']>([
  'CARD_DRAWN',
  'CARD_STAGED',
  'CARD_UNSTAGED',
  'CARD_MOVED',
  'CARD_MOVED_TO_ZONE',
  'CARD_RETURNED_TO_LANE',
  'CARD_ADDED_TO_HAND',
  'CARD_ADDED_TO_LANE',
  'CARD_ADDED_TO_DECK',
  'CARD_DISCARDED',
  'CARD_DESTROYED',
  'CARD_BANISHED',
]);

function changedCards(before: MatchState, after: MatchState): CardId[] {
  const ids = new Set([...Object.keys(before.cards), ...Object.keys(after.cards)] as CardId[]);
  const changed: CardId[] = [];
  for (const id of ids) {
    const a = before.cards[id];
    const b = after.cards[id];
    if (!a || !b) {
      changed.push(id);
      continue;
    }
    if (a.zone !== b.zone || a.lane !== b.lane) changed.push(id);
  }
  return changed;
}

export function assertTransferCoverage(before: MatchState, event: MatchEvent, after: MatchState, transfers: readonly CardTransfer[]): void {
  if (!structuralCardEventTypes.has(event.type)) return;
  const changed = changedCards(before, after);
  if (changed.length === 0) return;
  const covered = new Set(transfers.map(t => t.cardId));
  const missing = changed.filter(id => !covered.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing card transfer animation for ${event.type}: ${missing.join(', ')}`);
  }
}

export function isVisibleZone(zone: CardZoneRef): boolean {
  return visibleZone(zone);
}

export function isCardPileZone(zone: CardZoneRef): zone is Extract<CardZoneRef, { kind: CardZone }> {
  return ['DISCARD', 'DESTROYED', 'BANISHED'].includes(zone.kind);
}

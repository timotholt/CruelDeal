import type { Manifest } from '../engine/manifest/types';
import type { ReplayFrame } from '../engine/replay';
import type { EffectRef } from '../engine/types/ability';
import type { CardId, LocationId } from '../engine/types/ids';
import type { MatchEvent } from '../engine/types/events';
import type { MatchState } from '../engine/types/state';

export interface ReplayNameResolver {
  cardName: (state: MatchState, id: CardId) => string;
  cardLabel: (state: MatchState, id: CardId) => string;
  cardType: (state: MatchState, id: CardId) => string | undefined;
  locationName: (state: MatchState, id: LocationId) => string;
  locationLabel: (state: MatchState, id: LocationId) => string;
}

export interface ReplayFrameDescription {
  readonly summary: string;
  readonly cause: string | null;
}

const label = (id: string, name: string | undefined): string => name ? `${id} (${name})` : id;

/**
 * Resolve replay instance ids through the instance's defId and the active
 * manifest. Historical location instances are retained because destroy and
 * replace events are rendered from their post-event state.
 */
export function createReplayNameResolver(
  frames: readonly ReplayFrame[],
  manifest: Manifest,
): ReplayNameResolver {
  const historicalCardDefIds = new Map<string, string>();
  const historicalLocationDefIds = new Map<string, string>();

  for (const frame of frames) {
    for (const card of Object.values(frame.state.cards)) {
      historicalCardDefIds.set(card.id, card.defId);
    }
    for (const lane of frame.state.lanes) {
      if (lane.location) historicalLocationDefIds.set(lane.location.id, lane.location.defId);
    }
  }

  const cardDef = (state: MatchState, id: CardId) => {
    const defId = state.cards[id]?.defId ?? historicalCardDefIds.get(id);
    return defId ? manifest.cards[defId] : undefined;
  };
  const locationDef = (state: MatchState, id: LocationId) => {
    const current = state.lanes.find((lane) => lane.location?.id === id)?.location;
    const defId = current?.defId ?? historicalLocationDefIds.get(id);
    return defId ? manifest.locations[defId] : undefined;
  };

  return {
    cardName: (state, id) => cardDef(state, id)?.name ?? id,
    cardLabel: (state, id) => label(id, cardDef(state, id)?.name),
    cardType: (state, id) => cardDef(state, id)?.cardType,
    locationName: (state, id) => locationDef(state, id)?.name ?? id,
    locationLabel: (state, id) => label(id, locationDef(state, id)?.name),
  };
}

const CARD_ID_FIELDS = new Set(['cardId', 'sourceCardId']);
const LOCATION_ID_FIELDS = new Set(['locationId', 'oldId', 'newId', 'sourceLocationId']);

function displayValue(
  key: string,
  value: unknown,
  state: MatchState,
  names: ReplayNameResolver,
  parent?: Readonly<Record<string, unknown>>,
): unknown {
  if (typeof value === 'string') {
    if (CARD_ID_FIELDS.has(key)) return names.cardLabel(state, value as CardId);
    if (LOCATION_ID_FIELDS.has(key)) return names.locationLabel(state, value as LocationId);
    if (key === 'sourceId') {
      return parent?.effectKind === 'LOCATION'
        ? names.locationLabel(state, value as LocationId)
        : names.cardLabel(state, value as CardId);
    }
    return value;
  }

  if (Array.isArray(value)) {
    const itemKey = key === 'newOrder' ? 'cardId' : key;
    return value.map((item) => displayValue(itemKey, item, state, names));
  }

  if (value !== null && typeof value === 'object') {
    const object = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.entries(object).map(([childKey, childValue]) => [
        childKey,
        displayValue(childKey, childValue, state, names, object),
      ]),
    );
  }

  return value;
}

function eventCause(event: MatchEvent): EffectRef | null {
  if (!('cause' in event) || !event.cause) return null;
  return event.cause;
}

export function describeReplayCause(
  frame: ReplayFrame | null,
  names: ReplayNameResolver,
): string | null {
  if (!frame?.event) return null;
  const cause = eventCause(frame.event);
  if (!cause) return null;

  if (cause.effectKind === 'ON_REVEAL' || cause.effectKind === 'ONGOING') {
    return `effect of ${names.cardName(frame.state, cause.sourceId as CardId)}`;
  }
  if (cause.effectKind === 'LOCATION') {
    return `effect of ${names.locationName(frame.state, cause.sourceId as LocationId)}`;
  }

  const eventCardId = 'cardId' in frame.event ? frame.event.cardId : undefined;
  if (
    eventCardId === cause.sourceId
    && names.cardType(frame.state, cause.sourceId as CardId) === 'spell'
  ) {
    return `${names.cardName(frame.state, cause.sourceId as CardId)}: spell resolved — banished by game rules`;
  }
  return cause.systemReason ? `game rules (${cause.systemReason})` : 'game rules';
}

export function describeReplayFrame(
  frame: ReplayFrame | null,
  names: ReplayNameResolver,
): ReplayFrameDescription {
  if (!frame?.event) return { summary: 'Initial seeded state', cause: null };
  const event = frame.event;
  const details = Object.entries(event)
    .filter(([key]) => key !== 'type')
    .slice(0, 3)
    .map(([key, value]) => {
      const displayed = displayValue(
        key,
        value,
        frame.state,
        names,
        event as unknown as Readonly<Record<string, unknown>>,
      );
      return `${key}=${typeof displayed === 'object' ? JSON.stringify(displayed) : String(displayed)}`;
    });

  return {
    summary: details.length > 0 ? `${event.type} · ${details.join(' · ')}` : event.type,
    cause: describeReplayCause(frame, names),
  };
}

/**
 * Pretty-printed event JSON with card/location names appended as comments
 * on id-bearing lines. Display-only: the copyable replay export stays raw
 * so exported JSON never carries decoration.
 */
export function annotateReplayEventJson(
  frame: ReplayFrame | null,
  names: ReplayNameResolver,
): string {
  if (!frame?.event) return '';
  const raw = JSON.stringify(frame.event, null, 2);
  return raw
    .split('\n')
    .map((line) => {
      const m = line.match(/"(cardId|sourceId|targetId|newCardId|locationId)":\s*"([^"]+)"/);
      if (!m) return line;
      const [, key, id] = m;
      const name = key === 'locationId'
        ? names.locationName(frame.state, id as LocationId)
        : names.cardName(frame.state, id as CardId);
      return name && name !== id ? `${line}  // ${name}` : line;
    })
    .join('\n');
}

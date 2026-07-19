import type { Manifest } from '../engine/manifest/types';
import type { ReplayStep } from '../engine/replay';
import type { EffectRef } from '../engine/types/ability';
import type { CardId, LocationCardInstanceId } from '../engine/types/ids';
import type { MatchEvent } from '../engine/types/events';
import type { MatchState } from '../engine/types/state';
import type { MatchRuntimeReplayExport } from '../runtime/contracts';

export interface ReplayNameResolver {
  cardName: (state: MatchState, id: CardId) => string;
  cardNameWithOwner: (state: MatchState, id: CardId) => string;
  cardOwner: (state: MatchState, id: CardId) => string | undefined;
  cardLabel: (state: MatchState, id: CardId) => string;
  cardType: (state: MatchState, id: CardId) => string | undefined;
  definitionName: (defId: string) => string;
  locationLane: (state: MatchState, id: LocationCardInstanceId) => number | undefined;
  locationName: (state: MatchState, id: LocationCardInstanceId) => string;
  locationLabel: (state: MatchState, id: LocationCardInstanceId) => string;
}

export interface ReplayStepDescription {
  readonly actor: string;
  readonly summary: string;
  readonly cause: string | null;
}

export interface ReplayActorResolver {
  actorLabel: (frame: ReplayStep | null) => string;
  playerLabel: (owner: string | undefined) => string;
}

const cardLabel = (id: string, name: string | undefined, owner: string | undefined): string => {
  if (!name) return id;
  return owner ? `${id} (${name}, ${owner})` : `${id} (${name})`;
};
const nameWithOwner = (id: string, name: string | undefined, owner: string | undefined): string => {
  const resolved = name ?? id;
  return owner ? `${resolved} (${owner})` : resolved;
};
const label = (id: string, name: string | undefined): string => name ? `${id} (${name})` : id;

/**
 * Resolve replay instance ids through the instance's defId and the active
 * manifest. Historical location instances are retained because destroy and
 * replace events are rendered from their post-event state.
 */
export function createReplayNameResolver(
  steps: readonly ReplayStep[],
  manifest: Manifest,
): ReplayNameResolver {
  const historicalCardDefIds = new Map<string, string>();
  const historicalCardOwners = new Map<string, string>();
  const historicalLocationDefIds = new Map<string, string>();
  const historicalLocationLanes = new Map<string, number>();

  for (const step of steps) {
    for (const card of Object.values(step.state.cards)) {
      historicalCardDefIds.set(card.id, card.defId);
      historicalCardOwners.set(card.id, card.owner);
    }
    for (const location of Object.values(step.state.locationCards)) {
      historicalLocationDefIds.set(location.id, location.defId);
      if (location.laneId !== null) {
        historicalLocationLanes.set(location.id, location.laneId);
      }
    }
  }

  const cardDef = (state: MatchState, id: CardId) => {
    const defId = state.cards[id]?.defId ?? historicalCardDefIds.get(id);
    return defId ? manifest.cards[defId] : undefined;
  };
  const locationDef = (state: MatchState, id: LocationCardInstanceId) => {
    const current = state.locationCards[id];
    const defId = current?.defId ?? historicalLocationDefIds.get(id);
    return defId ? manifest.locations[defId] : undefined;
  };
  const cardOwner = (state: MatchState, id: CardId) => (
    state.cards[id]?.owner ?? historicalCardOwners.get(id)
  );

  return {
    cardName: (state, id) => cardDef(state, id)?.name ?? id,
    cardNameWithOwner: (state, id) => nameWithOwner(id, cardDef(state, id)?.name, cardOwner(state, id)),
    cardOwner,
    cardLabel: (state, id) => cardLabel(id, cardDef(state, id)?.name, cardOwner(state, id)),
    cardType: (state, id) => cardDef(state, id)?.cardType,
    definitionName: (defId) => manifest.cards[defId]?.name ?? defId,
    locationLane: (state, id) => (
      state.locationCards[id]?.laneId
      ?? historicalLocationLanes.get(id)
    ),
    locationName: (state, id) => locationDef(state, id)?.name ?? id,
    locationLabel: (state, id) => label(id, locationDef(state, id)?.name),
  };
}

/** Resolve a runtime replay frame through its committed transaction identity. */
export function createReplayActorResolver(replay: MatchRuntimeReplayExport): ReplayActorResolver {
  const actorByTransaction = new Map(
    replay.transactions.map((transaction) => [transaction.transactionId, transaction.intent.seat]),
  );
  const playerLabel = (owner: string | undefined): string => {
    if (owner === 'P0') return 'Player 1';
    if (owner === 'P1') return 'Player 2';
    return 'Game';
  };
  return {
    playerLabel,
    actorLabel: (frame) => {
      if (!frame?.transactionId) return 'Game';
      const seat = actorByTransaction.get(frame.transactionId);
      if (!seat || seat === 'SYSTEM') return 'Game';
      const displayName = replay.bootstrap.participants[seat].displayName;
      return `${playerLabel(seat)} (${displayName})`;
    },
  };
}

function eventCause(event: MatchEvent): EffectRef | null {
  if (!('cause' in event) || !event.cause) return null;
  return event.cause;
}

export function describeReplayCause(
  frame: ReplayStep | null,
  names: ReplayNameResolver,
): string | null {
  if (!frame?.event) return null;
  const cause = eventCause(frame.event);
  if (!cause) return null;

  if (cause.effectKind === 'ON_REVEAL' || cause.effectKind === 'ONGOING') {
    return `caused by ${names.cardNameWithOwner(frame.state, cause.sourceId as CardId)}`;
  }
  if (cause.effectKind === 'LOCATION') {
    const locationId = cause.sourceId as LocationCardInstanceId;
    const lane = names.locationLane(frame.state, locationId);
    return lane === undefined
      ? `caused by location ${names.locationName(frame.state, locationId)}`
      : `caused by ${laneLabel(lane)} location ${names.locationName(frame.state, locationId)}`;
  }

  const eventCardId = 'cardId' in frame.event ? frame.event.cardId : undefined;
  if (
    eventCardId === cause.sourceId
    && names.cardType(frame.state, cause.sourceId as CardId) === 'spell'
  ) {
    return `caused by ${names.cardNameWithOwner(frame.state, cause.sourceId as CardId)} resolving under the game rules`;
  }
  return cause.systemReason
    ? `caused by game rules: ${humanizeToken(cause.systemReason)}`
    : 'caused by game rules';
}

const humanizeToken = (value: string): string => value
  .toLowerCase()
  .replaceAll('_', ' ')
  .replace(/^\w/, (letter) => letter.toUpperCase());

const LANE_LABELS = ['left lane', 'center lane', 'right lane'] as const;
const SLOT_LABELS = ['FL', 'FR', 'BL', 'BR'] as const;

const laneLabel = (lane: number): string => LANE_LABELS[lane] ?? `lane ${lane}`;
const slotLabel = (slot: number): string => SLOT_LABELS[slot] ?? `slot ${slot}`;

const signedChange = (delta: number, positive: string, negative: string): string => (
  delta >= 0 ? `${positive} ${delta}` : `${negative} ${Math.abs(delta)}`
);

export function describeReplayStep(
  step: ReplayStep | null,
  names: ReplayNameResolver,
  actors: ReplayActorResolver,
): ReplayStepDescription {
  const actor = actors.actorLabel(step);
  if (!step?.event) return { actor, summary: 'Initial game state.', cause: null };
  const event = step.event;
  const cardName = (id: CardId): string => names.cardName(step.state, id);
  const cardPlayer = (id: CardId): string => actors.playerLabel(names.cardOwner(step.state, id));
  const cardOwner = (id: CardId): string => names.cardOwner(step.state, id) ?? actor;
  const player = (owner: string | undefined): string => actors.playerLabel(owner);
  const locationName = (id: LocationCardInstanceId): string => names.locationName(step.state, id);
  const cardSlot = (cardId: CardId, lane: number, owner: string): string => {
    if (owner !== 'P0' && owner !== 'P1') return slotLabel(0);
    const slot = Math.max(0, step.state.lanesById[lane]?.cards[owner].indexOf(cardId) ?? 0);
    return slotLabel(slot);
  };
  const destination = (value: Extract<MatchEvent, { type: 'CARD_MOVED_TO_ZONE' }>['destination']): string => {
    if (value.kind === 'LANE') return `the ${laneLabel(value.lane)}`;
    if (value.kind === 'DECK') return `${value.position?.toLowerCase() ?? 'the'} deck`;
    return 'their hand';
  };

  let summary: string;
  switch (event.type) {
    case 'CARD_STAGED':
      summary = `${player(event.owner)} played ${cardName(event.cardId)} to the ${laneLabel(event.lane)}, slot ${cardSlot(event.cardId, event.lane, event.owner)}.`;
      break;
    case 'CARD_UNSTAGED':
      summary = `${cardPlayer(event.cardId)} returned ${cardName(event.cardId)} to their hand.`;
      break;
    case 'ENERGY_CHANGED':
      summary = `${player(event.owner)} ${signedChange(event.delta, 'gained', 'spent')} energy (${humanizeToken(event.reason).toLowerCase()}).`;
      break;
    case 'MAX_ENERGY_CHANGED':
      summary = `${player(event.owner)}'s maximum energy ${signedChange(event.delta, 'increased by', 'decreased by')}.`;
      break;
    case 'NEXT_TURN_ENERGY_BONUS_CHANGED':
      summary = `${player(event.owner)}'s next-turn energy bonus ${signedChange(event.delta, 'increased by', 'decreased by')}.`;
      break;
    case 'CARD_FLIPPED':
      summary = `${cardPlayer(event.cardId)} — ${cardName(event.cardId)} — Revealed.`;
      break;
    case 'OR_WINDOW_OPEN':
      summary = `${cardName(event.cardId)} began resolving its reveal effect${event.multiplier === 1 ? '' : ` ${event.multiplier} times`}.`;
      break;
    case 'OR_WINDOW_CLOSE':
      summary = `${cardName(event.cardId)} finished resolving its reveal effect.`;
      break;
    case 'CARD_POWER_CHANGED':
      summary = `${cardName(event.cardId)} ${signedChange(event.delta, 'gained', 'lost')} power.`;
      break;
    case 'CARD_COST_CHANGED':
      summary = `${cardOwner(event.cardId)} - ${cardName(event.cardId)}'s cost ${signedChange(event.delta, 'increased by', 'decreased by')}.`;
      break;
    case 'CARD_DESTROYED':
      summary = `${cardPlayer(event.cardId)}'s ${cardName(event.cardId)} was destroyed.`;
      break;
    case 'CARD_DISCARDED':
      summary = `${cardPlayer(event.cardId)} discarded ${cardName(event.cardId)} (${humanizeToken(event.reason).toLowerCase()}).`;
      break;
    case 'CARD_BANISHED':
      summary = `${cardPlayer(event.cardId)}'s ${cardName(event.cardId)} was banished.`;
      break;
    case 'CARD_MOVED':
      summary = `${cardName(event.cardId)} moved from the ${laneLabel(event.fromLane)} to the ${laneLabel(event.toLane)}.`;
      break;
    case 'CARD_RETURNED_TO_LANE':
      summary = `${cardName(event.cardId)} returned to the ${laneLabel(event.lane)} ${event.revealed ? 'face up' : 'face down'}.`;
      break;
    case 'CARD_TRANSFORMED':
      summary = `${names.definitionName(event.oldDefId)} transformed into ${names.definitionName(event.newDefId)}.`;
      break;
    case 'CARD_TAG_ADDED':
      summary = `${cardName(event.cardId)} gained the “${humanizeToken(event.tag.kind)}” status.`;
      break;
    case 'CARD_TAG_REMOVED':
      summary = `${cardName(event.cardId)} lost the “${humanizeToken(event.tag)}” status.`;
      break;
    case 'CARD_TEXT_OVERRIDDEN':
      summary = `${cardName(event.cardId)}'s rules text changed.`;
      break;
    case 'CARD_COUNTER_CHANGED':
      summary = `${cardName(event.cardId)}'s ${event.name} counter ${signedChange(event.delta, 'increased by', 'decreased by')}.`;
      break;
    case 'CARD_DRAWN':
      summary = `${player(event.owner)} drew ${cardName(event.cardId)}.`;
      break;
    case 'CARD_ADDED_TO_DECK':
      summary = `${cardName(event.cardId)} was added to ${player(event.owner)}'s deck${event.position ? ` at the ${event.position.toLowerCase()}` : ''}.`;
      break;
    case 'CARD_ADDED_TO_HAND':
      summary = `${names.definitionName(event.defId)} was added to ${player(event.owner)}'s hand.`;
      break;
    case 'CARD_ADDED_TO_LANE':
      summary = `${names.definitionName(event.defId)} was added to ${player(event.owner)}'s side of the ${laneLabel(event.lane)}.`;
      break;
    case 'CARD_MOVED_TO_ZONE':
      summary = `${cardName(event.cardId)} moved to ${destination(event.destination)}.`;
      break;
    case 'DECK_SHUFFLED':
      summary = `${player(event.owner)}'s deck was shuffled.`;
      break;
    case 'PENDING_EFFECT_ADDED':
      summary = `The “${humanizeToken(event.effect.kind)}” effect was scheduled.`;
      break;
    case 'PENDING_EFFECT_REMOVED':
      summary = `The “${humanizeToken(event.effect.kind)}” effect finished.`;
      break;
    case 'LOCATION_REVEALED':
      summary = `${locationName(event.locationId)} was revealed in the ${laneLabel(event.lane)}.`;
      break;
    case 'LOCATION_REPLACED':
      summary = event.newDefId === 'ruin'
        ? `${locationName(event.oldId)} was destroyed and replaced by Ruin in the ${laneLabel(event.lane)}.`
        : `${locationName(event.oldId)} was replaced by ${locationName(event.newId)} in the ${laneLabel(event.lane)}.`;
      break;
    case 'LOCATIONS_SWAPPED':
      summary = `${locationName(event.left.locationId)} and ${locationName(event.right.locationId)} swapped lanes.`;
      break;
    case 'LOCATION_SHIFTED':
      summary = `${locationName(event.locationId)} moved from the ${laneLabel(event.fromLane)} to the ${laneLabel(event.toLane)}.`;
      break;
    case 'LOCATION_TAG_ADDED':
      summary = `The ${laneLabel(event.lane)} gained the “${humanizeToken(event.tag.kind)}” status.`;
      break;
    case 'LOCATION_TAG_REMOVED':
      summary = `The ${laneLabel(event.lane)} lost the “${humanizeToken(event.tag)}” status.`;
      break;
    case 'LOCATION_COUNTER_CHANGED':
      summary = `The ${laneLabel(event.lane)}'s ${event.name} counter ${signedChange(event.delta, 'increased by', 'decreased by')}${event.owner ? ` for ${player(event.owner)}` : ''}.`;
      break;
    case 'LANE_DESTRUCTION_STARTED':
      summary = `Destruction of the ${laneLabel(event.lane)} began.`;
      break;
    case 'LANE_DESTROYED':
      summary = `The ${laneLabel(event.lane)} was destroyed.`;
      break;
    case 'LANE_CREATION_STARTED':
      summary = `Creation of lane ${event.lane} began.`;
      break;
    case 'LANE_CREATED':
      summary = `Lane ${event.lane} entered play at position ${event.position + 1}.`;
      break;
    case 'TURN_RESOLUTION_STARTED':
      summary = `Turn ${event.turn} began resolving.`;
      break;
    case 'TURN_STARTED':
      summary = `Turn ${event.turn} started. ${player(event.priority)} has priority (${humanizeToken(event.priorityReason).toLowerCase()}).`;
      break;
    case 'TURN_ENDED':
      summary = `Turn ${event.turn} ended.`;
      break;
    case 'MATCH_ENDED':
      summary = event.result.winner === 'DRAW'
        ? 'End of game — draw.'
        : `End of game — ${player(event.result.winner)} won.`;
      break;
    case 'RECURSION_LIMIT_HIT':
      summary = `${cardName(event.cardId)} stopped resolving after reaching the effect limit at depth ${event.depth}.`;
      break;
    case 'INTENT_REJECTED':
      summary = `${actor}'s action was rejected: ${event.reason}.`;
      break;
  }

  const cause = describeReplayCause(step, names);
  return {
    actor,
    summary: cause ? `${summary.replace(/\.$/, '')} - ${cause}.` : summary,
    cause,
  };
}

/**
 * Pretty-printed event JSON with card/location names appended as comments
 * on id-bearing lines. Display-only: the copyable replay export stays raw
 * so exported JSON never carries decoration.
 */
export function annotateReplayEventJson(
  frame: ReplayStep | null,
  names: ReplayNameResolver,
): string {
  if (!frame?.event) return '';
  const raw = JSON.stringify(frame.event, null, 2);
  const cause = eventCause(frame.event);
  return raw
    .split('\n')
    .map((line) => {
      const m = line.match(/"(cardId|sourceId|targetId|newCardId|locationId)":\s*"([^"]+)"/);
      if (!m) return line;
      const [, key, id] = m;
      const isLocation = key === 'locationId'
        || (key === 'sourceId' && cause?.sourceId === id && cause.effectKind === 'LOCATION');
      const lane = isLocation ? names.locationLane(frame.state, id as LocationCardInstanceId) : undefined;
      const name = isLocation
        ? `${names.locationName(frame.state, id as LocationCardInstanceId)}${lane === undefined ? '' : `, ${laneLabel(lane)}`}`
        : names.cardNameWithOwner(frame.state, id as CardId);
      return name && name !== id ? `${line}  // ${name}` : line;
    })
    .map((line) => {
      const match = line.match(/"(lane|fromLane|toLane)":\s*(0|1|2)/);
      return match ? `${line}  // ${laneLabel(Number(match[2]))}` : line;
    })
    .join('\n');
}

import type { Manifest } from '../engine/manifest/types';
import type { ReplayStep } from '../engine/replay';
import type { EffectRef } from '../engine/types/ability';
import type {
  CanonicalEntityRef,
  EffectTraceEntry,
} from '../engine/types/effectTrace';
import type { CardId, LocationCardInstanceId } from '../engine/types/ids';
import type { MatchEvent } from '../engine/types/events';
import type { MatchState } from '../engine/types/state';
import type { MatchRuntimeReplayExport } from '../runtime/contracts';
import {
  getAllCardIds,
  getCardRuntime,
} from '../engine/projections/cardRuntime';
import { getCardTemplate } from '../engine/projections/cardTemplate';
import {
  getAllLocationStates,
  getLocationState,
} from '../engine/projections/locationRuntime';
import { getLocationTemplate } from '../engine/projections/locationTemplate';

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
    for (const id of getAllCardIds(step.state)) {
      const card = getCardRuntime(step.state, id, manifest);
      if (!card) continue;
      historicalCardDefIds.set(card.id, card.defId);
      historicalCardOwners.set(card.id, card.owner);
    }
    for (const location of getAllLocationStates(step.state)) {
      historicalLocationDefIds.set(location.id, location.defId);
      if (location.laneId !== null) {
        historicalLocationLanes.set(location.id, location.laneId);
      }
    }
  }

  const cardDef = (state: MatchState, id: CardId) => {
    const defId = getCardRuntime(state, id, manifest)?.defId ??
      historicalCardDefIds.get(id);
    return defId ? getCardTemplate(manifest, defId) ?? undefined : undefined;
  };
  const locationDef = (state: MatchState, id: LocationCardInstanceId) => {
    const current = getLocationState(state, id);
    const defId = current?.defId ?? historicalLocationDefIds.get(id);
    return defId ? getLocationTemplate(manifest, defId) ?? undefined : undefined;
  };
  const cardOwner = (state: MatchState, id: CardId) => (
    getCardRuntime(state, id, manifest)?.owner ?? historicalCardOwners.get(id)
  );

  return {
    cardName: (state, id) => cardDef(state, id)?.canonicalName ?? id,
    cardNameWithOwner: (state, id) => nameWithOwner(id, cardDef(state, id)?.canonicalName, cardOwner(state, id)),
    cardOwner,
    cardLabel: (state, id) => cardLabel(id, cardDef(state, id)?.canonicalName, cardOwner(state, id)),
    cardType: (state, id) => cardDef(state, id)?.domain,
    definitionName: (defId) => getCardTemplate(manifest, defId)?.canonicalName ?? defId,
    locationLane: (state, id) => (
      getLocationState(state, id)?.laneId
      ?? historicalLocationLanes.get(id)
    ),
    locationName: (state, id) => locationDef(state, id)?.canonicalName ?? id,
    locationLabel: (state, id) => label(id, locationDef(state, id)?.canonicalName),
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
  // Staging is the player's initiating action. Its mandatory provenance is
  // mechanically important, but narrating it as self-caused is misleading.
  if (frame.event.type === 'CARD_STAGED') return null;
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
  if (
    frame.event.type === 'LOCATION_REPLACED'
    && frame.event.oldId === cause.sourceId
  ) {
    return 'caused by game rules';
  }
  return `caused by game rules: ${humanizeToken(cause.reason)}`;
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

function entityLabel(
  state: MatchState,
  ref: CanonicalEntityRef,
  names: ReplayNameResolver,
  actors: ReplayActorResolver,
): string {
  switch (ref.kind) {
    case 'CARD':
      return names.cardNameWithOwner(state, ref.cardId);
    case 'LOCATION': {
      const lane = names.locationLane(state, ref.locationId);
      return lane === undefined
        ? names.locationName(state, ref.locationId)
        : `${names.locationName(state, ref.locationId)} (${laneLabel(lane)})`;
    }
    case 'LANE':
      return laneLabel(ref.laneId);
    case 'PLAYER':
      return actors.playerLabel(ref.owner);
    case 'ZONE':
      return `${ref.owner ? `${actors.playerLabel(ref.owner)} ` : ''}${humanizeToken(ref.zone).toLowerCase()}`;
    case 'SYSTEM':
      return `system ${ref.systemId}`;
  }
}

function abilityLabel(effect: Extract<EffectTraceEntry, {
  readonly kind: 'EFFECT_INVOCATION_STARTED';
}>): string {
  return `${humanizeToken(effect.ability.kind)} ${effect.ability.ruleIndex + 1}`;
}

export function describeReplayEffect(
  step: ReplayStep | null,
  names: ReplayNameResolver,
  actors: ReplayActorResolver,
): string | null {
  const effect = step?.canonicalFrame?.effect;
  if (!step || !effect) return null;
  switch (effect.kind) {
    case 'EFFECT_INVOCATION_STARTED': {
      const source = entityLabel(step.state, effect.source, names, actors);
      const count = effect.candidates.length;
      return `${source} began ${abilityLabel(effect)}: ${count} target${count === 1 ? '' : 's'} selected.`;
    }
    case 'EFFECT_TARGET_RESOLVED': {
      const target = entityLabel(step.state, effect.target, names, actors);
      const blockers = effect.blockedBy.map(blocker =>
        entityLabel(step.state, blocker, names, actors)
      );
      const blockedBy = blockers.length === 0
        ? ''
        : ` by ${blockers.join(', ')}`;
      const reason = effect.reason ? ` (${humanizeToken(effect.reason).toLowerCase()})` : '';
      return `Attempt ${effect.attemptOrdinal + 1}: ${effect.operation} on ${target} — ${humanizeToken(effect.result).toLowerCase()}${blockedBy}${reason}.`;
    }
    case 'EFFECT_INVOCATION_COMPLETED':
      return `Effect completed: ${effect.affected} affected, ${effect.blocked} blocked, ${effect.invalidated} invalidated, ${effect.unchanged} unchanged.`;
  }
}

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
  const player = (owner: string | undefined): string => actors.playerLabel(owner);
  const locationName = (id: LocationCardInstanceId): string => names.locationName(step.state, id);
  const cardSlot = (cardId: CardId, lane: number, owner: string): string => {
    if (owner !== 'P0' && owner !== 'P1') return slotLabel(0);
    const slot = Math.max(0, step.state.lanesById[lane]?.cards[owner].indexOf(cardId) ?? 0);
    return slotLabel(slot);
  };
  const destination = (value: Extract<MatchEvent, { type: 'CARD_ZONE_CHANGED' }>['destination']): string => {
    if (value.kind === 'LANE') return `the ${laneLabel(value.lane)}`;
    if (value.kind === 'DECK') return `${value.position?.toLowerCase() ?? 'the'} deck`;
    return 'their hand';
  };

  let summary: string;
  switch (event.type) {
    case 'CARD_STAGED':
      summary = `${player(event.owner)} played ${cardName(event.cardId)} to the ${laneLabel(event.lane)}, slot ${cardSlot(event.cardId, event.lane, event.owner)}.`;
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
    case 'CARD_REVEAL_SCHEDULED':
      summary = event.timing.kind === 'END_OF_GAME'
        ? `${cardName(event.cardId)} was scheduled to reveal at the end of the game.`
        : `${cardName(event.cardId)} was scheduled to reveal on turn ${event.timing.turn}.`;
      break;
    case 'CARD_REVEALED':
      summary = `${cardPlayer(event.cardId)} — ${cardName(event.cardId)} — Revealed.`;
      break;
    case 'CARD_PLAY_COMPLETED':
      summary = `${cardPlayer(event.cardId)} — ${cardName(event.cardId)} — Completed its play in lane ${event.lane + 1}.`;
      break;
    case 'OR_WINDOW_OPEN':
      summary = `${cardName(event.cardId)} began resolving its reveal effect${event.multiplier === 1 ? '' : ` ${event.multiplier} times`}.`;
      break;
    case 'OR_WINDOW_CLOSE':
      summary = `${cardName(event.cardId)} finished resolving its reveal effect.`;
      break;
    case 'CARD_POWER_CHANGED':
      summary = event.mutation.kind === 'ADD'
        ? `${cardPlayer(event.cardId)}'s ${cardName(event.cardId)} ${signedChange(event.mutation.delta, 'gained', 'lost')} power.`
        : event.mutation.kind === 'SET'
          ? `${cardPlayer(event.cardId)}'s ${cardName(event.cardId)} had its power set to ${event.mutation.value}.`
          : `${cardPlayer(event.cardId)}'s ${cardName(event.cardId)} had its permanent power reset.`;
      break;
    case 'CARD_COST_CHANGED':
      summary = `${cardPlayer(event.cardId)}'s ${cardName(event.cardId)} cost ${signedChange(event.delta, 'increased by', 'decreased by')}.`;
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
    case 'CARD_CREATED':
      summary = event.destination.kind === 'LANE'
        ? `${names.definitionName(event.defId)} was created on ${player(event.owner)}'s side of the ${laneLabel(event.destination.lane)}.`
        : event.destination.kind === 'HAND'
          ? `${names.definitionName(event.defId)} was created in ${player(event.owner)}'s hand.`
          : `${names.definitionName(event.defId)} was created in ${player(event.owner)}'s deck${event.destination.position ? ` at the ${event.destination.position.toLowerCase()}` : ''}.`;
      break;
    case 'CARD_ZONE_CHANGED':
      summary = `${cardName(event.cardId)} moved to ${destination(event.destination)}.`;
      break;
    case 'DECK_SHUFFLED':
      summary = `${player(event.owner)}'s deck was shuffled.`;
      break;
    case 'PENDING_EFFECT_SCHEDULED':
      summary = `Pending effect “${event.effect.id}” was scheduled for ${humanizeToken(event.effect.when).toLowerCase()}.`;
      break;
    case 'PENDING_EFFECT_CONSUMED':
      summary = `Pending effect “${event.pendingEffectId}” was consumed.`;
      break;
    case 'LOCATION_DECK_INITIALIZED':
      summary = `The location deck was initialized with ${event.locations.length} cards.`;
      break;
    case 'LOCATION_CARD_CREATED':
      summary = `${names.definitionName(event.defId)} was created for lane ${event.pendingLane}.`;
      break;
    case 'LOCATION_CARD_DRAWN':
      summary = `${locationName(event.locationId)} was drawn for lane ${event.pendingLane}.`;
      break;
    case 'LOCATION_CARD_PLAYED':
      summary = `${locationName(event.locationId)} was placed face down in the ${laneLabel(event.lane)}.`;
      break;
    case 'LOCATION_SLOT_REVEAL_SCHEDULED':
      summary = event.revealAtTurn === null
        ? `The ${laneLabel(event.lane)} location reveal was unscheduled.`
        : `The ${laneLabel(event.lane)} location was scheduled to reveal on turn ${event.revealAtTurn}.`;
      break;
    case 'LOCATION_REVEALED':
      summary = `${locationName(event.locationId)} was revealed in the ${laneLabel(event.lane)}.`;
      break;
    case 'LOCATION_TURNED_FACE_DOWN':
      summary = `${locationName(event.locationId)} was turned face down in the ${laneLabel(event.lane)}.`;
      break;
    case 'LOCATION_SHOWN_TO_SEATS':
      summary = `${locationName(event.locationId)} was privately shown to ${event.seats.map(player).join(' and ')}.`;
      break;
    case 'LOCATION_REPLACED':
      summary = event.newDefId === 'ruin'
        ? `${locationName(event.oldId)} was destroyed and replaced by Ruin in the ${laneLabel(event.lane)}.`
        : `${locationName(event.oldId)} was replaced by ${locationName(event.newId)} in the ${laneLabel(event.lane)}.`;
      break;
    case 'LOCATIONS_SWAPPED':
      summary = `${locationName(event.left.locationId)} and ${locationName(event.right.locationId)} swapped lanes.`;
      break;
    case 'LOCATION_MOVED':
      summary = `${locationName(event.locationId)} moved from the ${laneLabel(event.fromLane)} to the ${laneLabel(event.toLane)}.`;
      break;
    case 'LOCATION_REMOVED_FROM_LANE':
      summary = `${locationName(event.locationId)} left the ${laneLabel(event.lane)} for ${event.destination.toLowerCase()}.`;
      break;
    case 'LOCATION_RETURNED_TO_DECK':
      summary = `${locationName(event.locationId)} returned to the ${event.placement.toLowerCase()} of the location deck.`;
      break;
    case 'LOCATION_TAG_ADDED':
      summary = `${locationName(event.locationId)} gained the “${humanizeToken(event.tag.kind)}” status.`;
      break;
    case 'LOCATION_TAG_REMOVED':
      summary = `${locationName(event.locationId)} lost the “${humanizeToken(event.tag)}” status.`;
      break;
    case 'LOCATION_COUNTER_CHANGED':
      summary = `${locationName(event.locationId)}'s ${event.name} counter ${signedChange(event.delta, 'increased by', 'decreased by')}${event.owner ? ` for ${player(event.owner)}` : ''}.`;
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
    case 'MATCH_SETUP_COMPLETED':
      summary = 'Match setup completed.';
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
    default:
      summary = humanizeToken(event.type);
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

/**
 * Pretty-printed effect JSON with canonical entity names appended as comments.
 * Display-only; exported replay JSON remains undecorated.
 */
export function annotateReplayEffectJson(
  frame: ReplayStep | null,
  names: ReplayNameResolver,
  actors: ReplayActorResolver,
): string {
  const effect = frame?.canonicalFrame?.effect;
  if (!frame || !effect) return '';
  const raw = JSON.stringify(effect, null, 2);
  return raw
    .split('\n')
    .map((line) => {
      const card = line.match(/"(cardId)":\s*"([^"]+)"/);
      if (card) {
        const id = card[2] as CardId;
        const name = names.cardNameWithOwner(frame.state, id);
        return name && name !== id ? `${line}  // ${name}` : line;
      }
      const location = line.match(/"(locationId)":\s*"([^"]+)"/);
      if (location) {
        const id = location[2] as LocationCardInstanceId;
        const lane = names.locationLane(frame.state, id);
        const name = `${names.locationName(frame.state, id)}${lane === undefined ? '' : `, ${laneLabel(lane)}`}`;
        return name && name !== id ? `${line}  // ${name}` : line;
      }
      const lane = line.match(/"(laneId)":\s*(0|1|2)/);
      if (lane) return `${line}  // ${laneLabel(Number(lane[2]))}`;
      const owner = line.match(/"(owner)":\s*"(P0|P1)"/);
      if (owner) return `${line}  // ${actors.playerLabel(owner[2])}`;
      return line;
    })
    .join('\n');
}

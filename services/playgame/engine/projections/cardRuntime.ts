import type {
  CardAbilities,
  CardDomain,
  Manifest,
} from '../manifest/types';
import type {
  InternalCardRecord,
  CardRevealTiming,
  CardTag,
  CardZone,
  CostLogEntry,
  CardLifecycleState,
  MatchState,
  PowerLedgerEntry,
  SpawnSource,
  TextLogEntry,
} from '../types/state';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from '../types/ids';
import type {
  CardBoardPosition,
} from '../types/cardPosition';
import type { TextOverride } from '../types/ability';
import { locationCardAtLane } from '../laneTopology';
import { getCardBoardPosition } from './cardPosition';
import {
  getCardAbilityLabels as labelsForAbilities,
  type CardAbilityLabel,
  type CardAbilitySlot,
} from './abilityPresence';
import { getCardTemplate } from './cardTemplate';
import {
  listCardsInternal,
  readCardInternal,
} from '../internal/cardStore';

export type CurrentCardPosition =
  | {
      readonly zone: 'LANE';
      readonly laneId: LaneId;
      readonly locationCardId: LocationCardInstanceId | null;
      readonly locationDefId: string | null;
      readonly slot: CardBoardPosition['slot'] | null;
      readonly row: CardBoardPosition['row'] | null;
      readonly column: CardBoardPosition['column'] | null;
    }
  | {
      readonly zone: Exclude<CardZone, 'LANE' | 'BANISHED'>;
      readonly owner: Owner;
      readonly index: number;
    }
  | {
      readonly zone: 'BANISHED';
      readonly owner: Owner;
    };

export interface EffectiveCardText {
  readonly abilities: CardAbilities;
  readonly abilityLabels: readonly CardAbilityLabel[];
  readonly rulesText: string;
  readonly override: TextOverride | null;
}

export type CardLifecycle = CardLifecycleState;

export interface CardRuntime {
  readonly id: CardId;
  readonly defId: string;
  readonly variantId?: string;
  readonly version: number;
  readonly owner: Owner;
  readonly domain: CardDomain;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  readonly revealed: boolean;
  readonly revealTiming: CardRevealTiming | null;
  readonly lifecycle: CardLifecycle;
  readonly text: EffectiveCardText;
  readonly tags: readonly CardTag[];
  readonly counters: Readonly<Record<string, number>>;
  readonly spawnSource: SpawnSource;
  readonly powerLedger: readonly PowerLedgerEntry[];
  readonly costDelta: number;
  readonly costHistory: readonly CostLogEntry[];
  readonly textHistory: readonly TextLogEntry[];
}

export interface CardPlacement {
  readonly id: CardId;
  readonly owner: Owner;
  readonly zone: CardZone;
  readonly lane: LaneId | null;
  readonly position: CurrentCardPosition;
  readonly revealed: boolean;
}

/**
 * Manifest-free, read-only stored state. Use this for diagnostics and reducer
 * assertions; gameplay logic should prefer CardRuntime/CurrentCard so domain,
 * effective text, and effective stats are included.
 */
export type CardState = Readonly<InternalCardRecord>;

export function getCardLifecycle(
  state: MatchState,
  cardId: CardId,
): CardLifecycle | null {
  return cardRecord(state, cardId)?.lifecycle ?? null;
}

function cardRecord(state: MatchState, cardId: CardId): InternalCardRecord | null {
  return readCardInternal(state, cardId);
}

function cardsInIndexedZone(
  state: MatchState,
  zone: 'DECK' | 'HAND' | 'DISCARD' | 'DESTROYED',
  owner: Owner,
): readonly InternalCardRecord[] {
  if (zone === 'DECK') {
    return state.deck[owner]
      .map(id => cardRecord(state, id))
      .filter((card): card is InternalCardRecord => card !== null);
  }
  if (zone === 'HAND') {
    return state.hand[owner]
      .map(id => cardRecord(state, id))
      .filter((card): card is InternalCardRecord => card !== null);
  }
  return listCardsInternal(state).filter(
    (card) => card.owner === owner && card.zone === zone,
  );
}

function resolvePosition(
  state: MatchState,
  card: InternalCardRecord,
): CurrentCardPosition {
  if (card.zone === 'LANE' && card.lane !== null) {
    const board = getCardBoardPosition(card, state);
    const location = locationCardAtLane(state, card.lane);
    return {
      zone: 'LANE',
      laneId: card.lane,
      locationCardId: location?.id ?? null,
      locationDefId: location?.defId ?? null,
      slot: board?.slot ?? null,
      row: board?.row ?? null,
      column: board?.column ?? null,
    };
  }
  if (card.zone === 'BANISHED') {
    return { zone: 'BANISHED', owner: card.owner };
  }
  if (card.zone === 'LANE') {
    throw new Error(`card ${card.id} has zone LANE without a lane`);
  }
  return {
    zone: card.zone,
    owner: card.owner,
    index: cardsInIndexedZone(state, card.zone, card.owner)
      .findIndex((entry) => entry.id === card.id),
  };
}

/** State-only placement projection for presentation code that has no manifest. */
export function getCardPlacement(
  state: MatchState,
  cardId: CardId,
): CardPlacement | null {
  const card = cardRecord(state, cardId);
  if (!card) return null;
  return {
    id: card.id,
    owner: card.owner,
    zone: card.zone,
    lane: card.lane,
    position: resolvePosition(state, card),
    revealed: card.revealed,
  };
}

export function getCardState(
  state: MatchState,
  cardId: CardId,
): CardState | null {
  return cardRecord(state, cardId);
}

export function getAllCardStates(state: MatchState): readonly CardState[] {
  return listCardsInternal(state);
}

export function getEffectiveCardText(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): EffectiveCardText | null {
  const card = cardRecord(state, cardId);
  if (!card) return null;
  const template = getCardTemplate(manifest, card.defId);
  if (!template) return null;

  const printed: EffectiveCardText = {
    abilities: template.abilities,
    abilityLabels: template.abilityLabels,
    rulesText: template.rulesText,
    override: null,
  };
  const override = card.textOverride;
  if (!override) return printed;
  return {
    abilities: override.abilities,
    abilityLabels: labelsForAbilities(override.abilities),
    rulesText: override.rulesText,
    override,
  };
}

export function getCardRuntime(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): CardRuntime | null {
  const card = cardRecord(state, cardId);
  if (!card) return null;
  const template = getCardTemplate(manifest, card.defId);
  const text = getEffectiveCardText(state, cardId, manifest);
  if (!template || !text) return null;
  return {
    id: card.id,
    defId: card.defId,
    variantId: card.variantId,
    version: card.version,
    owner: card.owner,
    domain: template.domain,
    zone: card.zone,
    lane: card.lane,
    revealed: card.revealed,
    revealTiming: card.revealTiming,
    lifecycle: card.lifecycle,
    text,
    tags: card.tags,
    counters: card.counters,
    spawnSource: card.spawnSource,
    powerLedger: card.powerLedger,
    costDelta: card.costDelta,
    costHistory: card.costLog,
    textHistory: card.textLog,
  };
}

export function getCardDomain(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): CardDomain | null {
  return getCardRuntime(state, cardId, manifest)?.domain ?? null;
}

export function getCurrentCardAbilityLabels(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): readonly CardAbilityLabel[] {
  return getEffectiveCardText(state, cardId, manifest)?.abilityLabels ?? [];
}

export function getCurrentCardAbilityEffects(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  slot: CardAbilitySlot,
): CardAbilities[CardAbilitySlot] {
  return getEffectiveCardText(state, cardId, manifest)?.abilities[slot];
}

export function getAllCardIds(state: MatchState): readonly CardId[] {
  return listCardsInternal(state).map((card) => card.id);
}

export function getCardsInZone(
  state: MatchState,
  manifest: Manifest,
  zone: CardZone,
  owner?: Owner,
): readonly CardRuntime[] {
  return getAllCardIds(state)
    .map((cardId) => getCardRuntime(state, cardId, manifest))
    .filter((card): card is CardRuntime =>
      card !== null
      && card.zone === zone
      && (owner === undefined || card.owner === owner));
}

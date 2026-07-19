import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import { getCardCost } from '../projections/cost';
import { getCardRuntime } from '../projections/cardRuntime';
import type { EffectRef, TextOverride } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId } from '../types/ids';
import type { CardTag, MatchState } from '../types/state';
import {
  resolveCardPowerAdd,
  resolveCardPowerMutation,
  type PowerMutationResult,
} from './power';

export interface CardMutationResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

function commit(
  state: MatchState,
  event: MatchEvent,
  manifest: Manifest,
): CardMutationResult {
  return { events: [event], state: apply(state, event, manifest) };
}

function requireCause(cause: EffectRef): void {
  if (String(cause.sourceId).trim().length === 0) {
    throw new Error('card mutation sourceId must be non-empty');
  }
  if (cause.reason.trim().length === 0) {
    throw new Error('card mutation reason must be non-empty');
  }
}

function requireFiniteInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a finite integer`);
  }
}

function snapshotCause(cause: EffectRef): EffectRef {
  return { ...cause };
}

/**
 * Every public card mutation requires an EffectRef. Its sourceId identifies
 * who initiated the write and its non-empty reason is retained by the framed
 * event ledger.
 */
export function adjustCardCost(
  state: MatchState,
  cardId: CardId,
  delta: number,
  cause: EffectRef,
  manifest: Manifest,
): CardMutationResult {
  requireCause(cause);
  requireFiniteInteger(delta, 'card cost delta');
  if (delta === 0 || !getCardRuntime(state, cardId, manifest)) {
    return { events: [], state };
  }
  return commit(state, {
    type: 'CARD_COST_CHANGED',
    cardId,
    delta,
    cause: snapshotCause(cause),
  }, manifest);
}

export function setCardCost(
  state: MatchState,
  cardId: CardId,
  value: number,
  cause: EffectRef,
  manifest: Manifest,
): CardMutationResult {
  requireCause(cause);
  requireFiniteInteger(value, 'card cost');
  const desired = Math.max(0, value);
  return adjustCardCost(
    state,
    cardId,
    desired - getCardCost(state, cardId, manifest),
    cause,
    manifest,
  );
}

export function setCardPower(
  state: MatchState,
  cardId: CardId,
  value: number,
  cause: EffectRef,
  manifest: Manifest,
): PowerMutationResult {
  requireCause(cause);
  requireFiniteInteger(value, 'card power');
  return resolveCardPowerMutation(
    state,
    cardId,
    { kind: 'SET', value },
    cause,
    manifest,
  );
}

export function adjustCardPower(
  state: MatchState,
  cardId: CardId,
  delta: number,
  cause: EffectRef,
  manifest: Manifest,
): PowerMutationResult {
  requireCause(cause);
  requireFiniteInteger(delta, 'card power delta');
  return resolveCardPowerAdd(state, cardId, delta, cause, manifest);
}

export function resetCardPower(
  state: MatchState,
  cardId: CardId,
  cause: EffectRef,
  manifest: Manifest,
): PowerMutationResult {
  requireCause(cause);
  return resolveCardPowerMutation(
    state,
    cardId,
    { kind: 'RESET' },
    cause,
    manifest,
  );
}

export function replaceCardText(
  state: MatchState,
  cardId: CardId,
  override: TextOverride | null,
  cause: EffectRef,
  manifest: Manifest,
): CardMutationResult {
  requireCause(cause);
  const overrideSnapshot = override === null
    ? null
    : structuredClone(override);
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || JSON.stringify(card.text.override) === JSON.stringify(overrideSnapshot)) {
    return { events: [], state };
  }
  return commit(state, {
    type: 'CARD_TEXT_OVERRIDDEN',
    cardId,
    override: overrideSnapshot,
    cause: snapshotCause(cause),
  }, manifest);
}

export function addCardTag(
  state: MatchState,
  cardId: CardId,
  tag: CardTag,
  cause: EffectRef,
  manifest: Manifest,
): CardMutationResult {
  requireCause(cause);
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || card.tags.some(existing => existing.kind === tag.kind)) {
    return { events: [], state };
  }
  return commit(state, {
    type: 'CARD_TAG_ADDED',
    cardId,
    tag,
    cause: snapshotCause(cause),
  }, manifest);
}

export function removeCardTag(
  state: MatchState,
  cardId: CardId,
  tag: CardTag['kind'],
  cause: EffectRef,
  manifest: Manifest,
): CardMutationResult {
  requireCause(cause);
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || !card.tags.some(existing => existing.kind === tag)) {
    return { events: [], state };
  }
  return commit(state, {
    type: 'CARD_TAG_REMOVED',
    cardId,
    tag,
    cause: snapshotCause(cause),
  }, manifest);
}

export function changeCardCounter(
  state: MatchState,
  cardId: CardId,
  name: string,
  delta: number,
  cause: EffectRef,
  manifest: Manifest,
): CardMutationResult {
  requireCause(cause);
  requireFiniteInteger(delta, 'card counter delta');
  if (name.trim().length === 0) {
    throw new Error('card counter name must be non-empty');
  }
  if (delta === 0 || !getCardRuntime(state, cardId, manifest)) {
    return { events: [], state };
  }
  return commit(state, {
    type: 'CARD_COUNTER_CHANGED',
    cardId,
    name,
    delta,
    cause: snapshotCause(cause),
  }, manifest);
}

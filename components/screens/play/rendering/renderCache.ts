import { cardStatTone, type ResolvedCard, type ResolvedLocation } from '@/services/playgame/view';
import type { CardRenderModel, LocationRenderModel } from './renderModels';

const CARD_CACHE_LIMIT = 512;
const LOCATION_CACHE_LIMIT = 64;
const cardPlans = new Map<string, CardRenderModel>();
const locationPlans = new Map<string, LocationRenderModel>();

const remember = <T>(cache: Map<string, T>, key: string, value: T, limit: number): T => {
  cache.set(key, value);
  if (cache.size > limit) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return value;
};

const cardKey = (card: ResolvedCard): string => JSON.stringify([
  card.name,
  card.type,
  card.cost,
  card.power,
  card.portraitPath,
  card.art,
  card.textDisabled,
  cardStatTone(card, 'cost'),
  cardStatTone(card, 'power'),
]);

export const resolveCardRenderPlan = (
  card: ResolvedCard,
): CardRenderModel => {
  const key = cardKey(card);
  const cached = cardPlans.get(key);
  if (cached) return cached;
  return remember(cardPlans, key, Object.freeze({
    key,
    name: card.name,
    type: card.type,
    cost: card.cost,
    power: card.power,
    portraitPath: card.portraitPath,
    art: card.art,
    textDisabled: card.textDisabled,
    costTone: cardStatTone(card, 'cost'),
    powerTone: cardStatTone(card, 'power'),
  }), CARD_CACHE_LIMIT);
};

const locationKey = (location: ResolvedLocation): string => JSON.stringify([
  location.defId,
  location.name,
  location.desc,
  location.art,
  location.mapArt,
  location.revealed,
]);

export const resolveLocationRenderPlan = (location: ResolvedLocation): LocationRenderModel => {
  const key = locationKey(location);
  const cached = locationPlans.get(key);
  if (cached) return cached;
  return remember(locationPlans, key, Object.freeze({
    key,
    name: location.revealed ? location.name : '???',
    description: location.revealed ? location.desc : '',
    art: location.art,
    mapArt: location.mapArt,
    revealed: location.revealed,
  }), LOCATION_CACHE_LIMIT);
};

export const clearRenderPlanCachesForTests = (): void => {
  cardPlans.clear();
  locationPlans.clear();
};

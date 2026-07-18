import type { CardDef } from './types';
import { CORE_V1_CARD_MODULES } from './card-sets/core-v1/cards.generated';

export interface CardModule {
  folder: string;
  card: CardDef;
}

export interface CardValidationIssue {
  cardId: string;
  message: string;
  severity?: 'error' | 'warning';
}

const ACTIVE_CARD_SETS: Record<string, readonly CardModule[]> = {
  'core-v1': CORE_V1_CARD_MODULES,
};

const hasAbilityEntries = (card: CardDef): boolean => (
  Object.values(card.abilities).some((value) => Array.isArray(value) && value.length > 0)
);

export const validateCardModule = (module: CardModule): CardValidationIssue[] => {
  const { folder, card } = module;
  const cardId = card?.defId || folder || '<unknown>';
  const issues: CardValidationIssue[] = [];

  if (!card || typeof card !== 'object') {
    return [{ cardId, message: 'card.json must export an object' }];
  }
  if (folder !== card.defId) issues.push({ cardId, message: `folder "${folder}" must match defId "${card.defId}"` });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.defId)) issues.push({ cardId, message: 'defId must be kebab-case' });
  if (!Number.isInteger(card.version) || card.version < 1) issues.push({ cardId, message: 'version must be an integer >= 1' });
  if (!['character', 'device', 'spell'].includes(card.cardType)) {
    issues.push({ cardId, message: 'cardType must be character, device, or spell' });
  }
  if (!Number.isInteger(card.cost) || card.cost < 0 || card.cost > 6) issues.push({ cardId, message: 'cost must be an integer in [0,6]' });
  if (!Number.isInteger(card.basePower) || card.basePower < 0) issues.push({ cardId, message: 'basePower must be an integer >= 0' });
  if (card.cardType === 'spell' && card.basePower !== 0) {
    issues.push({
      cardId,
      severity: 'warning',
      message: `spell basePower (${card.basePower}) is meaningless and ignored; retained only for schema compatibility`,
    });
  }
  if (!card.abilities || typeof card.abilities !== 'object') issues.push({ cardId, message: 'abilities must be an object' });
  if (!card.cosmetic || typeof card.cosmetic !== 'object') issues.push({ cardId, message: 'cosmetic must be an object' });
  if (!card.cosmetic?.displayName) issues.push({ cardId, message: 'cosmetic.displayName is required' });
  if (hasAbilityEntries(card) && !card.cosmetic?.rulesText) {
    issues.push({ cardId, message: 'cards with abilities must have cosmetic.rulesText' });
  }

  const portraitPath = card.cosmetic?.art?.portrait?.path;
  if (typeof portraitPath !== 'string') {
    issues.push({ cardId, message: 'cosmetic.art.portrait.path must be a string' });
  } else if (portraitPath && !portraitPath.startsWith('/art/cards/')) {
    issues.push({ cardId, message: 'portrait path must be empty or start with /art/cards/' });
  }

  return issues;
};

export const loadCardsFromSets = (setIds: readonly string[] = ['core-v1']): Record<string, CardDef> => {
  const cards: Record<string, CardDef> = {};

  for (const setId of setIds) {
    const modules = ACTIVE_CARD_SETS[setId];
    if (!modules) throw new Error(`loadCardsFromSets: unknown active card set "${setId}"`);

    for (const module of modules) {
      const issues = validateCardModule(module);
      const errors = issues.filter(issue => issue.severity !== 'warning');
      if (errors.length > 0) {
        throw new Error(
          `loadCardsFromSets: invalid card "${module.card?.defId ?? module.folder}"\n` +
          errors.map((issue) => `- ${issue.message}`).join('\n'),
        );
      }
      if (cards[module.card.defId]) {
        throw new Error(`loadCardsFromSets: duplicate defId "${module.card.defId}"`);
      }
      cards[module.card.defId] = module.card;
    }
  }

  return cards;
};

export const getActiveCardModules = (setIds: readonly string[] = ['core-v1']): readonly CardModule[] => (
  setIds.flatMap((setId) => {
    const modules = ACTIVE_CARD_SETS[setId];
    if (!modules) throw new Error(`getActiveCardModules: unknown active card set "${setId}"`);
    return [...modules];
  })
);

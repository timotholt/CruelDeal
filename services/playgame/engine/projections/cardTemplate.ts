import type {
  CardAbilities,
  CardDomain,
  Manifest,
} from '../manifest/types';
import {
  getCardAbilityLabels as labelsForAbilities,
  type CardAbilityLabel,
} from './abilityPresence';

export interface CardTemplate {
  readonly defId: string;
  readonly version: number;
  readonly canonicalName: string;
  readonly name: string;
  readonly domain: CardDomain;
  readonly baseCost: number;
  readonly basePower: number | null;
  readonly abilities: CardAbilities;
  readonly abilityLabels: readonly CardAbilityLabel[];
  readonly rulesText: string;
  readonly frame: string | null;
  readonly variantIds: readonly string[];
  readonly accent: string | null;
  readonly portraitPath: string | null;
}

export function getCardTemplate(
  manifest: Manifest,
  defId: string,
): CardTemplate | null {
  const definition = manifest.cards[defId];
  if (!definition) return null;
  return {
    defId: definition.defId,
    version: definition.version,
    canonicalName: definition.name,
    name: definition.cosmetic.displayName || definition.name,
    domain: definition.cardType,
    baseCost: definition.cost,
    basePower: definition.cardType === 'spell' ? null : definition.basePower,
    abilities: definition.abilities,
    abilityLabels: labelsForAbilities(definition.abilities),
    rulesText: definition.cosmetic.rulesText ?? '',
    frame: definition.cosmetic.frame ?? null,
    variantIds: (definition.cosmetic.variants ?? []).map((variant) => variant.variantId),
    accent: definition.cosmetic.accent ?? null,
    portraitPath: definition.cosmetic.art.portrait.path || null,
  };
}

export function getAllCardTemplates(manifest: Manifest): readonly CardTemplate[] {
  return Object.keys(manifest.cards)
    .map((defId) => getCardTemplate(manifest, defId))
    .filter((template): template is CardTemplate => template !== null);
}

export function getCardTemplateDomain(
  manifest: Manifest,
  defId: string,
): CardDomain | null {
  return getCardTemplate(manifest, defId)?.domain ?? null;
}

export function getCardTemplateAbilityLabels(
  manifest: Manifest,
  defId: string,
): readonly CardAbilityLabel[] {
  return getCardTemplate(manifest, defId)?.abilityLabels ?? [];
}

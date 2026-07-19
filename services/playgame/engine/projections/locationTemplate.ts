import type {
  LocationAbilities,
  Manifest,
} from '../manifest/types';
import {
  getLocationAbilityLabels,
  type LocationAbilityLabel,
} from './locationAbilityPresence';

export interface LocationTemplate {
  readonly defId: string;
  readonly version: number;
  readonly canonicalName: string;
  readonly name: string;
  readonly rarity: number;
  readonly abilities: LocationAbilities;
  readonly abilityLabels: readonly LocationAbilityLabel[];
  readonly description: string;
  readonly accent: string | null;
  readonly mapArtPath: string;
}

export function getLocationTemplate(
  manifest: Manifest,
  defId: string,
): LocationTemplate | null {
  const definition = manifest.locations[defId];
  if (!definition) return null;
  return {
    defId: definition.defId,
    version: definition.version,
    canonicalName: definition.name,
    name: definition.cosmetic.displayName || definition.name,
    rarity: definition.rarity,
    abilities: definition.abilities,
    abilityLabels: getLocationAbilityLabels(definition.abilities),
    description: definition.cosmetic.description,
    accent: definition.cosmetic.accent ?? null,
    mapArtPath: definition.cosmetic.art.map.path,
  };
}

export function getAllLocationTemplates(
  manifest: Manifest,
): readonly LocationTemplate[] {
  return Object.keys(manifest.locations)
    .map((defId) => getLocationTemplate(manifest, defId))
    .filter((template): template is LocationTemplate => template !== null);
}

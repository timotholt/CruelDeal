import type { Manifest, MatchRuleset } from '../engine/manifest/types';
import type {
  LocationCardDeckEntry,
  LocationDeckBootstrap,
} from './contracts';
import { computeLocationDeckContentHash } from './bootstrapValidation';
import { getAllLocationTemplates } from '../engine/projections/locationTemplate';

export interface LocationDeckFactoryInput {
  readonly manifest: Manifest;
  readonly ruleset: MatchRuleset;
  readonly seed: string;
}

export interface LocationDeckFactory {
  build(input: LocationDeckFactoryInput): LocationDeckBootstrap;
}

export const defaultLocationDeckFactory: LocationDeckFactory = Object.freeze({
  build({ manifest, ruleset, seed }: LocationDeckFactoryInput): LocationDeckBootstrap {
    const globallyDisabled = new Set(manifest.disabled.locations);
    const rulesetEnabled = ruleset.enabledLocationDefIds
      ? new Set(ruleset.enabledLocationDefIds)
      : null;
    const eligible = getAllLocationTemplates(manifest)
      .filter(
        (definition) => definition.rarity > 0
          && !globallyDisabled.has(definition.defId)
          && (!rulesetEnabled || rulesetEnabled.has(definition.defId)),
      )
      .sort((left, right) => left.poolOrder - right.poolOrder);
    const entries: readonly LocationCardDeckEntry[] = Object.freeze(
      eligible.map((definition) => Object.freeze({ defId: definition.defId })),
    );
    const deck: LocationDeckBootstrap = {
      kind: 'LOCATION',
      order: 'WEIGHTED_RANDOM',
      deckId: `locations:${ruleset.rulesetId}:${seed}`,
      revision: 1,
      name: 'Location Deck',
      entries,
      contentHash: computeLocationDeckContentHash(entries),
    };
    return Object.freeze(deck);
  },
});

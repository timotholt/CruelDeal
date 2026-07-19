import type { Manifest, MatchRuleset } from '../engine/manifest/types';
import { createRng, type Rng } from '../engine/rng';
import type {
  LocationCardDeckEntry,
  LocationDeckBootstrap,
} from './contracts';
import { computeLocationDeckContentHash } from './bootstrapValidation';

export interface LocationDeckFactoryInput {
  readonly manifest: Manifest;
  readonly ruleset: MatchRuleset;
  readonly seed: string;
}

export interface LocationDeckFactory {
  build(input: LocationDeckFactoryInput): LocationDeckBootstrap;
}

/**
 * Produces the canonical rarity-weighted order before runtime construction.
 * Runtime receives and preserves this snapshot; it never samples the manifest.
 */
function weightedPermutation<T extends { readonly rarity: number }>(
  pool: readonly T[],
  rng: Rng,
): T[] {
  const ordered: T[] = [];
  const remaining = pool.filter((entry) => entry.rarity > 0).slice();
  while (remaining.length > 0) {
    const scale = 1000;
    const scaledTotal = remaining.reduce(
      (total, entry) => total + Math.floor(entry.rarity * scale),
      0,
    );
    const roll = rng.int(0, Math.max(0, scaledTotal - 1));
    let accumulated = 0;
    let chosenIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index++) {
      accumulated += Math.floor(remaining[index].rarity * scale);
      if (roll < accumulated) {
        chosenIndex = index;
        break;
      }
    }
    ordered.push(remaining[chosenIndex]);
    remaining.splice(chosenIndex, 1);
  }
  return ordered;
}

export const defaultLocationDeckFactory: LocationDeckFactory = Object.freeze({
  build({ manifest, ruleset, seed }: LocationDeckFactoryInput): LocationDeckBootstrap {
    const globallyDisabled = new Set(manifest.disabled.locations);
    const rulesetEnabled = ruleset.enabledLocationDefIds
      ? new Set(ruleset.enabledLocationDefIds)
      : null;
    const eligible = Object.values(manifest.locations).filter(
      (definition) => definition.rarity > 0
        && !globallyDisabled.has(definition.defId)
        && (!rulesetEnabled || rulesetEnabled.has(definition.defId)),
    );
    const entries: readonly LocationCardDeckEntry[] = Object.freeze(
      weightedPermutation(eligible, createRng(seed).fork('locations'))
        .map((definition) => Object.freeze({ defId: definition.defId })),
    );
    const deck: LocationDeckBootstrap = {
      kind: 'LOCATION',
      order: 'PRESERVE',
      deckId: `locations:${ruleset.rulesetId}:${seed}`,
      revision: 1,
      name: 'Location Deck',
      entries,
      contentHash: computeLocationDeckContentHash(entries),
    };
    return Object.freeze(deck);
  },
});

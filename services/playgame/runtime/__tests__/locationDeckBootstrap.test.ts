import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { createInitialMatchState } from '../../engine/cli/initState';
import { BOOTSTRAP_MANIFEST } from '../../engine/manifest/bootstrap';
import type { Manifest } from '../../engine/manifest/types';
import {
  computeDeckContentHash,
  computeLocationDeckContentHash,
  validateMatchBootstrap,
} from '../bootstrapValidation';
import type {
  LocationCardDeckEntry,
  MatchBootstrap,
} from '../contracts';
import { defaultLocationDeckFactory } from '../locationDeckFactory';

const ruleset = BOOTSTRAP_MANIFEST.rulesets.standard;
if (!ruleset) throw new Error('location deck tests require the standard ruleset');

function candidate(seed = 'phase1.2-location-deck'): MatchBootstrap {
  return buildDebugMatchBootstrap(DEBUG_DECKS[0], DEBUG_DECKS[1], seed);
}

function withLocationEntries(
  bootstrap: MatchBootstrap,
  entries: readonly LocationCardDeckEntry[],
): MatchBootstrap {
  return {
    ...bootstrap,
    decks: {
      ...bootstrap.decks,
      LOCATIONS: {
        ...bootstrap.decks.LOCATIONS,
        entries,
        contentHash: computeLocationDeckContentHash(entries),
      },
    },
  };
}

function issueCodes(input: unknown, manifest: Manifest = BOOTSTRAP_MANIFEST): string[] {
  const result = validateMatchBootstrap(input, manifest);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('Phase 1.2 location deck bootstrap', () => {
  it('builds one deterministic, complete, deeply frozen ordered snapshot', () => {
    const first = defaultLocationDeckFactory.build({
      manifest: BOOTSTRAP_MANIFEST,
      ruleset,
      seed: 'factory-determinism',
    });
    const second = defaultLocationDeckFactory.build({
      manifest: BOOTSTRAP_MANIFEST,
      ruleset,
      seed: 'factory-determinism',
    });
    const disabled = new Set(BOOTSTRAP_MANIFEST.disabled.locations);
    const enabledCount = Object.values(BOOTSTRAP_MANIFEST.locations)
      .filter(definition => definition.rarity > 0 && !disabled.has(definition.defId))
      .length;

    expect(first).toEqual(second);
    expect(first.kind).toBe('LOCATION');
    expect(first.order).toBe('PRESERVE');
    expect(first.entries).toHaveLength(enabledCount);
    expect(new Set(first.entries.map((entry) => entry.defId)).size).toBe(enabledCount);
    expect(first.contentHash).toBe(computeLocationDeckContentHash(first.entries));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.entries)).toBe(true);
    expect(first.entries.every(Object.isFrozen)).toBe(true);
  });

  it('preserves the legacy first-three picks across a fixed seed corpus', () => {
    for (let index = 0; index < 128; index++) {
      const seed = `location-parity-${index}`;
      const legacy = createInitialMatchState(seed, BOOTSTRAP_MANIFEST)
        .lanes.map((lane) => lane.location?.defId);
      const ordered = defaultLocationDeckFactory.build({
        manifest: BOOTSTRAP_MANIFEST,
        ruleset,
        seed,
      }).entries.slice(0, 3).map((entry) => entry.defId);
      expect(ordered, seed).toEqual(legacy);
    }
  });

  it('makes supplied bootstrap order immune to manifest insertion order', () => {
    const seed = 'supplied-order-not-manifest-order';
    const locationDeck = defaultLocationDeckFactory.build({
      manifest: BOOTSTRAP_MANIFEST,
      ruleset,
      seed,
    });
    const reversedManifest: Manifest = {
      ...BOOTSTRAP_MANIFEST,
      locations: Object.fromEntries(
        Object.entries(BOOTSTRAP_MANIFEST.locations).reverse(),
      ),
    };
    const original = createInitialMatchState(
      seed,
      BOOTSTRAP_MANIFEST,
      {},
      locationDeck.entries,
    );
    const reversed = createInitialMatchState(
      seed,
      reversedManifest,
      {},
      locationDeck.entries,
    );

    expect(original.lanes.map((lane) => lane.location?.defId))
      .toEqual(locationDeck.entries.slice(0, 3).map((entry) => entry.defId));
    expect(reversed.lanes.map((lane) => lane.location?.defId))
      .toEqual(original.lanes.map((lane) => lane.location?.defId));
  });

  it('rejects a missing location deck before runtime construction', () => {
    const bootstrap = candidate();
    const playerDecks = {
      P0: bootstrap.decks.P0,
      P1: bootstrap.decks.P1,
    };
    expect(issueCodes({ ...bootstrap, decks: playerDecks }))
      .toContain('INVALID_BOOTSTRAP_SHAPE');
  });

  it('rejects unknown, disabled, player-card, duplicate, and hash-invalid entries', () => {
    const bootstrap = candidate();
    const entries = bootstrap.decks.LOCATIONS.entries;
    const unknown = withLocationEntries(
      bootstrap,
      [{ defId: 'missing-location' }, ...entries.slice(1)],
    );
    expect(issueCodes(unknown)).toContain('UNKNOWN_LOCATION_DEFINITION');

    const disabledDefId = entries[0].defId;
    const disabledManifest: Manifest = {
      ...BOOTSTRAP_MANIFEST,
      disabled: {
        ...BOOTSTRAP_MANIFEST.disabled,
        locations: [...BOOTSTRAP_MANIFEST.disabled.locations, disabledDefId],
      },
    };
    expect(issueCodes(bootstrap, disabledManifest))
      .toContain('DISABLED_LOCATION_DEFINITION');

    const playerCard = withLocationEntries(
      bootstrap,
      [{ defId: bootstrap.decks.P0.entries[0].defId }, ...entries.slice(1)],
    );
    expect(issueCodes(playerCard)).toContain('PLAYER_CARD_IN_LOCATION_DECK');

    const locationInPlayerDeckEntries = bootstrap.decks.P0.entries.map(
      (entry, index) => index === 0 ? { defId: entries[0].defId } : entry,
    );
    expect(issueCodes({
      ...bootstrap,
      decks: {
        ...bootstrap.decks,
        P0: {
          ...bootstrap.decks.P0,
          entries: locationInPlayerDeckEntries,
          contentHash: computeDeckContentHash(locationInPlayerDeckEntries),
        },
      },
    })).toContain('LOCATION_CARD_IN_PLAYER_DECK');

    const duplicate = withLocationEntries(
      bootstrap,
      [entries[0], entries[0], ...entries.slice(2)],
    );
    expect(issueCodes(duplicate)).toContain('UNIQUENESS_RULE_VIOLATION');

    expect(issueCodes({
      ...bootstrap,
      decks: {
        ...bootstrap.decks,
        LOCATIONS: {
          ...bootstrap.decks.LOCATIONS,
          contentHash: 'sha256:not-the-location-deck',
        },
      },
    })).toContain('CONTENT_HASH_MISMATCH');
  });

  it('enforces the ruleset-owned lane plus reserve minimum', () => {
    const bootstrap = candidate('location-deck-minimum');
    const tooShort = withLocationEntries(
      bootstrap,
      bootstrap.decks.LOCATIONS.entries.slice(0, 3),
    );
    expect(issueCodes(tooShort)).toContain('INVALID_LOCATION_DECK_SIZE');
  });

  it('defensively copies and deeply freezes the validated third deck', () => {
    const bootstrap = candidate('location-deck-freeze');
    const result = validateMatchBootstrap(bootstrap, BOOTSTRAP_MANIFEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.decks.LOCATIONS).not.toBe(bootstrap.decks.LOCATIONS);
    expect(result.value.decks.LOCATIONS.entries)
      .not.toBe(bootstrap.decks.LOCATIONS.entries);
    expect(Object.isFrozen(result.value.decks.LOCATIONS)).toBe(true);
    expect(Object.isFrozen(result.value.decks.LOCATIONS.entries)).toBe(true);
    expect(result.value.decks.LOCATIONS.entries.every(Object.isFrozen)).toBe(true);
  });
});

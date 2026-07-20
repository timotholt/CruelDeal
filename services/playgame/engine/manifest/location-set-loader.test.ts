import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaultLocationDeckFactory } from '../../runtime/locationDeckFactory';
import { createInitialMatchState } from '../cli/initState';
import { activeLaneIds, locationCardAtLane } from '../laneTopology';
import { BOOTSTRAP_MANIFEST } from './bootstrap';
import {
  getActiveLocationModules,
  loadLocationsFromSets,
  validateLocationModule,
  type AuthoredLocationDef,
  type LocationModule,
} from './location-set-loader';

const EXPECTED_LOCATION_ORDER = [
  'neon-reliquary',
  'dark-alley',
  'chrome-depot',
  'ammo-club',
  'cryo-storage',
  'public-pool',
  'helixdyne-lab',
  'supercharging-station',
  'chrome-beach',
  'charging-station',
  'meridian-tower',
  'kurotek-atrium',
  'organ-bank',
  'gun-store',
  'red-needle',
  'the-pineapple-club',
  'black-halo',
  'the-cage',
  'chip-tune',
  'netrunner-shrine',
  'federal-courthouse',
  'courthouse',
  'data-chapel',
  'the-meat-market',
  'debt-alley',
  'skyrail',
  'cryobank',
  'signal-pit',
  'drone-hive',
  'civil-court',
  'backdoor',
  'scrap-yard',
  'pawn-shop',
  'rent-a-wreck',
  'power-sink',
  'overclock-room',
  'black-clinic',
  'ruin',
] as const;

const cloneLocation = (location: AuthoredLocationDef): AuthoredLocationDef => (
  JSON.parse(JSON.stringify(location)) as AuthoredLocationDef
);

describe('location-set loader', () => {
  it('preserves the pre-folderization normalized manifest and pool insertion order', () => {
    const loaded = loadLocationsFromSets(['core-v1']);
    const locations = Object.values(loaded.locations);
    const normalized = JSON.stringify({
      locations,
      disabled: loaded.disabledLocationIds,
    });

    expect(locations.map((location) => location.defId)).toEqual(EXPECTED_LOCATION_ORDER);
    expect(loaded.disabledLocationIds).toEqual([]);
    expect(createHash('sha256').update(normalized).digest('hex')).toBe(
      '0423559df99d93a83bcafba642c36df13a187ccb3ff40d2d4ed4f5b2797ea1f8',
    );
  });

  it('authors Cryobank with the canonical end-game card schedule', () => {
    const cryobank = loadLocationsFromSets(['core-v1']).locations.cryobank;
    expect(cryobank?.abilities.onCardEnteredHere).toBeUndefined();
    expect(cryobank?.abilities.ongoing).toEqual([{
      kind: 'REVEAL_TIMING_OVERRIDE',
      target: {
        kind: 'SAME_LANE',
        of: { kind: 'SELF' },
        ownerFilter: 'ANY_OWNER',
      },
      timing: { kind: 'END_OF_GAME' },
      stack: 'MAX',
    }]);
  });

  it('gives every definition one unique contiguous poolOrder', () => {
    const poolOrders = getActiveLocationModules(['core-v1'])
      .map((module) => module.location.poolOrder)
      .sort((a, b) => a - b);

    expect(poolOrders).toEqual(Array.from({ length: EXPECTED_LOCATION_ORDER.length }, (_, index) => index));
  });

  it.each([
    {
      seed: 'location-parity-a',
      first: ['helixdyne-lab', 'the-meat-market', 'supercharging-station'],
      hash: 'sha256:210ae722d8e42597b3eb0c72209f69065b1b523f051b11fa6450839a49e471f3',
    },
    {
      seed: 'location-parity-b',
      first: ['data-chapel', 'helixdyne-lab', 'debt-alley'],
      hash: 'sha256:210ae722d8e42597b3eb0c72209f69065b1b523f051b11fa6450839a49e471f3',
    },
    {
      seed: 'supplied-order-not-manifest-order',
      first: ['the-cage', 'skyrail', 'the-meat-market'],
      hash: 'sha256:210ae722d8e42597b3eb0c72209f69065b1b523f051b11fa6450839a49e471f3',
    },
  ])('preserves the state-owned seeded location selection for $seed', ({ seed, first, hash }) => {
    const deck = defaultLocationDeckFactory.build({
      manifest: BOOTSTRAP_MANIFEST,
      ruleset: BOOTSTRAP_MANIFEST.rulesets.standard,
      seed,
    });
    const state = createInitialMatchState(
      seed,
      BOOTSTRAP_MANIFEST,
      {},
      deck.entries,
    );

    expect(activeLaneIds(state).map((lane) => locationCardAtLane(state, lane)?.defId))
      .toEqual(first);
    expect(deck.contentHash).toBe(hash);
  });

  it('rejects unknown hooks and DSL operators', () => {
    const source = getActiveLocationModules(['core-v1'])[0];
    const location = cloneLocation(source.location);
    (location.abilities as Record<string, unknown>).onCardTeleportedHere = [];
    location.abilities.onReveal = [{
      kind: 'NOT_A_REAL_OPERATOR',
    } as never];
    const module: LocationModule = { folder: source.folder, location };

    expect(validateLocationModule(module).map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        'unknown location hook "onCardTeleportedHere"',
        'abilities.onReveal[0].kind "NOT_A_REAL_OPERATOR" is not a supported location DSL operator',
      ]),
    );
  });

  it('accepts the governed onCardBanishedHere authoring hook', () => {
    const source = getActiveLocationModules(['core-v1'])[0];
    const location = cloneLocation(source.location);
    location.abilities.onCardBanishedHere = [{
      kind: 'ADJUST_ENERGY',
      owner: 'EVENT_OWNER',
      delta: { kind: 'LIT', n: 1 },
    }];

    expect(validateLocationModule({
      folder: source.folder,
      location,
    })).toEqual([]);
  });

  it('requires an explicit supported transform metadata policy', () => {
    const source = getActiveLocationModules(['core-v1']).find(
      (module) => module.location.defId === 'black-clinic',
    );
    expect(source).toBeDefined();

    const missing = cloneLocation(source!.location);
    const missingTransform = (
      missing.abilities.onCardPlayedHere?.[0] as {
        then: Record<string, unknown>[];
      }
    ).then[0];
    delete missingTransform.metadataPolicy;

    const invalid = cloneLocation(source!.location);
    const invalidTransform = (
      invalid.abilities.onCardPlayedHere?.[0] as {
        then: Record<string, unknown>[];
      }
    ).then[0];
    invalidTransform.metadataPolicy = 'LEGACY_RESET';

    expect(validateLocationModule({
      folder: source!.folder,
      location: missing,
    }).map((issue) => issue.message)).toContain(
      'abilities.onCardPlayedHere[0].then[0].metadataPolicy is required for TRANSFORM_CARD',
    );
    expect(validateLocationModule({
      folder: source!.folder,
      location: invalid,
    }).map((issue) => issue.message)).toContain(
      'abilities.onCardPlayedHere[0].then[0].metadataPolicy must be PRESERVE or RESET_TO_DEFINITION',
    );
  });

  it('rejects folder drift, malformed parameters, and non-pool system rarity', () => {
    const source = getActiveLocationModules(['core-v1']).find(
      (module) => module.location.defId === 'ruin',
    );
    expect(source).toBeDefined();
    const location = cloneLocation(source!.location);
    location.rarity = 1;
    location.abilities.onReveal = [{
      kind: 'ADD_POWER',
      target: { kind: 'SELF' },
    } as never];
    const module: LocationModule = { folder: 'wrong-folder', location };
    const messages = validateLocationModule(module).map((issue) => issue.message);

    expect(messages).toContain('folder "wrong-folder" must match defId "ruin"');
    expect(messages).toContain('system locations must have rarity 0');
    expect(messages).toContain('abilities.onReveal[0].delta is required for ADD_POWER');
  });
});

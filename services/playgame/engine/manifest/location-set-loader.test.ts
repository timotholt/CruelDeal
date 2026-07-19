import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaultLocationDeckFactory } from '../../runtime/locationDeckFactory';
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
      '5ece5ce3ae7f719d85b750df493d7fc86aa56487e176b2657ba7991c63c647e4',
    );
  });

  it('authors Cryobank with the canonical end-game card schedule', () => {
    const cryobank = loadLocationsFromSets(['core-v1']).locations.cryobank;
    expect(cryobank?.abilities.ongoing).toBeUndefined();
    expect(cryobank?.abilities.onCardEnteredHere).toEqual([{
      kind: 'SCHEDULE_REVEAL',
      target: { kind: 'EVENT_CARD' },
      timing: { kind: 'END_OF_GAME' },
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
      first: ['the-cage', 'overclock-room', 'chip-tune'],
      hash: 'sha256:08428233da481087a62b8880d2ec34ca11671afc588714617bb7301ddedd578e',
    },
    {
      seed: 'location-parity-b',
      first: ['the-meat-market', 'skyrail', 'data-chapel'],
      hash: 'sha256:6c84af1c0ef7f3bd0c9cfe47073bd9df1deec94fee988a26d42f1952b26c4ae8',
    },
    {
      seed: 'supplied-order-not-manifest-order',
      first: ['supercharging-station', 'black-halo', 'civil-court'],
      hash: 'sha256:b72cf702b655c0b7a72543ef5c80740eae929f3f16043ca7784e214fa41d23b2',
    },
  ])('preserves the seeded location selection for $seed', ({ seed, first, hash }) => {
    const deck = defaultLocationDeckFactory.build({
      manifest: BOOTSTRAP_MANIFEST,
      ruleset: BOOTSTRAP_MANIFEST.rulesets.standard,
      seed,
    });

    expect(deck.entries.slice(0, 3).map((entry) => entry.defId)).toEqual(first);
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

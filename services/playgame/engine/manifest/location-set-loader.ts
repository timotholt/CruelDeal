import type { LocationCardDef } from './types';
import {
  CORE_V1_LOCATION_MODULES,
  CORE_V1_LOCATION_SET,
} from './location-sets/core-v1/locations.generated';

export type LocationAuthoringStatus = 'playable' | 'unimplemented' | 'system';

export interface AuthoredLocationDef extends LocationCardDef {
  status: LocationAuthoringStatus;
  /** Stable order in the location pool. Seeded selection depends on this order. */
  poolOrder: number;
  /** Human-facing note naming the primitive or reason the location is disabled. */
  implementationNote: string;
}

export interface LocationSetMetadata {
  setId: string;
  displayName: string;
  status: 'active' | 'deprecated' | 'experimental';
  locationsPath: string;
  world?: {
    name: string;
    fullName: string;
    publicSlogan: string;
    streetSlogan: string;
  };
  notes?: string;
}

export interface LocationModule {
  folder: string;
  location: AuthoredLocationDef;
}

export interface LocationValidationIssue {
  locationId: string;
  message: string;
}

export interface LoadedLocationSet {
  locations: Readonly<Record<string, LocationCardDef>>;
  disabledLocationIds: readonly string[];
}

interface ActiveLocationSet {
  metadata: LocationSetMetadata;
  modules: readonly LocationModule[];
}

const ACTIVE_LOCATION_SETS: Record<string, ActiveLocationSet> = {
  'core-v1': {
    metadata: CORE_V1_LOCATION_SET,
    modules: CORE_V1_LOCATION_MODULES,
  },
};

const TOP_LEVEL_KEYS = new Set([
  'status',
  'poolOrder',
  'implementationNote',
  'defId',
  'version',
  'name',
  'rarity',
  'abilities',
  'cosmetic',
]);

const ABILITY_KEYS = new Set([
  'ongoing',
  'onReveal',
  'atTurnStart',
  'atTurnEnd',
  'onCardPlayedHere',
  'onCardRevealedHere',
  'onCardEnteredHere',
  'onCardLeftHere',
  'onCardCreatedHere',
  'onCardReturnedHere',
  'onCardDestroyedHere',
  'onCardBanishedHere',
]);

const COSMETIC_KEYS = new Set(['displayName', 'description', 'accent', 'art', 'destroyedArt']);
const ART_KEYS = new Set(['map', 'thumbnail']);
const ASSET_KEYS = new Set(['path', 'hash', 'kind', 'w', 'h']);

/**
 * Phase 1.5 starts with the operators used by the migrated location set. New
 * operators are added here only with their engine primitive and focused test.
 */
const LOCATION_DSL_KINDS = new Set([
  'ADD_POWER',
  'ADJUST_COST',
  'ADJUST_ENERGY',
  'ADJUST_NEXT_TURN_ENERGY_BONUS',
  'ALL_CARDS',
  'AND',
  'ANY_RANDOM',
  'BANISH',
  'BLOCK_MOVE',
  'BLOCK_PLAY',
  'BLOCK_POWER_INCREASE',
  'BOOST_ONGOINGS',
  'CONDITIONAL',
  'COST_CMP',
  'COST_RANGE',
  'COST_REDUCED',
  'COUNT',
  'CREATE_CARD_IN_ZONE',
  'DEPLOY_FROM_DECK',
  'CURRENT_TURN',
  'DEF_ID_LIST',
  'DESTROY',
  'DISABLE_ONGOING',
  'DISCARD',
  'END_OF_GAME',
  'EVENT_CARD',
  'EXTEND_GAME_TURNS',
  'HAND',
  'HAND_ENTRY_POWER_ADD',
  'HAND_OF',
  'HAS_ABILITY',
  'HAS_COPIED_TEXT',
  'HAS_NO_ABILITY',
  'HAS_ONGOING',
  'LANE',
  'LANE_POWER_MULTIPLIER',
  'LIT',
  'LOCATION_COUNTER',
  'MIN_POWER_OF',
  'MODIFY_LOCATION_COUNTER',
  'MOVE',
  'NUM_CMP',
  'ON_REVEAL_MULTIPLIER',
  'OR',
  'OTHER_LANES',
  'POWER_ADD',
  'REVEAL_TIMING_OVERRIDE',
  'RANDOM_N',
  'RETURN_TO_LANE',
  'SCHEDULE_REVEAL',
  'SAME_LANE',
  'SELF',
  'SEQUENCE',
  'TEXT_DISABLED',
  'TURN',
  'TRANSFORM_CARD',
  'TRIGGER_ON_REVEAL',
  'WHERE',
]);

const REQUIRED_DSL_FIELDS: Readonly<Record<string, readonly string[]>> = {
  ADD_POWER: ['target', 'delta'],
  ADJUST_COST: ['target', 'delta'],
  ADJUST_ENERGY: ['owner', 'delta'],
  ADJUST_NEXT_TURN_ENERGY_BONUS: ['owner', 'delta'],
  ALL_CARDS: [],
  AND: ['all'],
  ANY_RANDOM: ['ownerFilter'],
  BANISH: ['target'],
  BLOCK_MOVE: ['target', 'stack'],
  BLOCK_PLAY: ['stack'],
  BLOCK_POWER_INCREASE: ['target', 'stack'],
  BOOST_ONGOINGS: ['scope', 'factor', 'stack'],
  CONDITIONAL: ['if', 'then'],
  COST_CMP: ['target', 'op', 'value'],
  COST_RANGE: ['ownerDeck', 'min', 'max'],
  COST_REDUCED: ['target'],
  COUNT: ['of'],
  CREATE_CARD_IN_ZONE: ['pool', 'owner', 'destination'],
  DEPLOY_FROM_DECK: ['owner', 'lane', 'selection'],
  CURRENT_TURN: [],
  DEF_ID_LIST: ['ids'],
  DESTROY: ['target'],
  DISABLE_ONGOING: ['target', 'stack'],
  DISCARD: ['target'],
  END_OF_GAME: [],
  EVENT_CARD: [],
  EXTEND_GAME_TURNS: ['turns', 'stack'],
  HAND: [],
  HAND_ENTRY_POWER_ADD: ['ownerFilter', 'delta', 'stack'],
  HAND_OF: ['owner'],
  HAS_ABILITY: ['target', 'slot'],
  HAS_COPIED_TEXT: ['target'],
  HAS_NO_ABILITY: ['target'],
  HAS_ONGOING: ['target'],
  LANE: ['lane'],
  LANE_POWER_MULTIPLIER: ['laneScope', 'factor', 'stack'],
  LIT: ['n'],
  LOCATION_COUNTER: ['name'],
  MIN_POWER_OF: ['of'],
  MODIFY_LOCATION_COUNTER: ['lane', 'name', 'delta'],
  MOVE: ['target', 'to'],
  NUM_CMP: ['a', 'op', 'b'],
  ON_REVEAL_MULTIPLIER: ['target', 'factor', 'stack'],
  OR: ['any'],
  OTHER_LANES: ['of'],
  POWER_ADD: ['target', 'delta', 'stack'],
  REVEAL_TIMING_OVERRIDE: ['target', 'timing', 'stack'],
  RANDOM_N: ['of', 'count'],
  RETURN_TO_LANE: ['target', 'to'],
  SCHEDULE_REVEAL: ['target', 'timing'],
  SAME_LANE: ['of'],
  SELF: [],
  SEQUENCE: ['items'],
  TEXT_DISABLED: ['target'],
  TURN: ['turn'],
  TRANSFORM_CARD: ['target', 'pool'],
  TRIGGER_ON_REVEAL: ['target'],
  WHERE: ['of', 'pred'],
};

const OPTIONAL_DSL_FIELDS: Readonly<Record<string, readonly string[]>> = {
  ALL_CARDS: ['ownerFilter', 'zoneFilter'],
  BLOCK_PLAY: ['target', 'laneOf', 'pred', 'cardPred', 'when', 'ownerFilter'],
  BOOST_ONGOINGS: ['excludeSelf'],
  CONDITIONAL: ['else'],
  LANE: ['revealed'],
  LOCATION_COUNTER: ['lane', 'owner'],
  MODIFY_LOCATION_COUNTER: ['owner'],
  OTHER_LANES: ['ownerFilter'],
  RETURN_TO_LANE: ['revealed'],
  SAME_LANE: ['ownerFilter', 'exclude'],
  TRANSFORM_CARD: ['resetStats'],
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const unknownKeys = (value: Record<string, unknown>, allowed: ReadonlySet<string>): string[] => (
  Object.keys(value).filter((key) => !allowed.has(key))
);

const validateAssetRef = (
  value: unknown,
  path: string,
  issues: LocationValidationIssue[],
  locationId: string,
): void => {
  if (!isRecord(value)) {
    issues.push({ locationId, message: `${path} must be an object` });
    return;
  }
  for (const key of unknownKeys(value, ASSET_KEYS)) {
    issues.push({ locationId, message: `${path}.${key} is not a supported asset field` });
  }
  if (typeof value.path !== 'string') {
    issues.push({ locationId, message: `${path}.path must be a string` });
  }
  if (value.kind !== undefined && !['image', 'video', 'audio'].includes(String(value.kind))) {
    issues.push({ locationId, message: `${path}.kind must be image, video, or audio` });
  }
  for (const sizeKey of ['w', 'h'] as const) {
    if (value[sizeKey] !== undefined && (!Number.isFinite(value[sizeKey]) || Number(value[sizeKey]) <= 0)) {
      issues.push({ locationId, message: `${path}.${sizeKey} must be a positive number` });
    }
  }
};

const validateDslValue = (
  value: unknown,
  path: string,
  issues: LocationValidationIssue[],
  locationId: string,
): void => {
  if (Array.isArray(value)) {
    value.forEach((child, index) => validateDslValue(child, `${path}[${index}]`, issues, locationId));
    return;
  }
  if (!isRecord(value)) return;

  if (typeof value.kind === 'string') {
    if (!LOCATION_DSL_KINDS.has(value.kind)) {
      issues.push({ locationId, message: `${path}.kind "${value.kind}" is not a supported location DSL operator` });
    } else {
      const requiredFields = REQUIRED_DSL_FIELDS[value.kind] ?? [];
      for (const field of requiredFields) {
        if (value[field] === undefined) {
          issues.push({ locationId, message: `${path}.${field} is required for ${value.kind}` });
        }
      }
      const allowedFields = new Set([
        'kind',
        ...requiredFields,
        ...(OPTIONAL_DSL_FIELDS[value.kind] ?? []),
      ]);
      for (const key of unknownKeys(value, allowedFields)) {
        issues.push({ locationId, message: `${path}.${key} is not valid for ${value.kind}` });
      }
      if (value.kind === 'LIT' && !Number.isFinite(value.n)) {
        issues.push({ locationId, message: `${path}.n must be a finite number` });
      }
      if (
        value.kind === 'DEF_ID_LIST'
        && (!Array.isArray(value.ids) || value.ids.some((id) => typeof id !== 'string'))
      ) {
        issues.push({ locationId, message: `${path}.ids must be an array of defId strings` });
      }
    }
  }
  if (value.op !== undefined && !['<', '<=', '==', '>=', '>'].includes(String(value.op))) {
    issues.push({ locationId, message: `${path}.op "${String(value.op)}" is not a comparison operator` });
  }
  if (value.stack !== undefined && !['MULTIPLICATIVE', 'ADDITIVE', 'MAX', 'SINGLE'].includes(String(value.stack))) {
    issues.push({ locationId, message: `${path}.stack "${String(value.stack)}" is not a stacking policy` });
  }
  if (value.until !== undefined && value.until !== 'END_OF_GAME') {
    issues.push({ locationId, message: `${path}.until must be END_OF_GAME` });
  }

  for (const [key, child] of Object.entries(value)) {
    if (key !== 'kind') validateDslValue(child, `${path}.${key}`, issues, locationId);
  }
};

export const validateLocationModule = (module: LocationModule): LocationValidationIssue[] => {
  const { folder, location } = module;
  const locationId = location?.defId || folder || '<unknown>';
  const issues: LocationValidationIssue[] = [];

  if (!isRecord(location)) {
    return [{ locationId, message: 'location.json must export an object' }];
  }
  for (const key of unknownKeys(location, TOP_LEVEL_KEYS)) {
    issues.push({ locationId, message: `unknown top-level field "${key}"` });
  }
  if (folder !== location.defId) {
    issues.push({ locationId, message: `folder "${folder}" must match defId "${location.defId}"` });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(location.defId)) {
    issues.push({ locationId, message: 'defId must be kebab-case' });
  }
  if (!Number.isInteger(location.version) || location.version < 1) {
    issues.push({ locationId, message: 'version must be an integer >= 1' });
  }
  if (!['playable', 'unimplemented', 'system'].includes(location.status)) {
    issues.push({ locationId, message: 'status must be playable, unimplemented, or system' });
  }
  if (!Number.isInteger(location.poolOrder) || location.poolOrder < 0) {
    issues.push({ locationId, message: 'poolOrder must be an integer >= 0' });
  }
  if (typeof location.implementationNote !== 'string' || location.implementationNote.trim() === '') {
    issues.push({ locationId, message: 'implementationNote is required' });
  }
  if (typeof location.name !== 'string' || location.name.trim() === '') {
    issues.push({ locationId, message: 'name is required' });
  }
  if (!Number.isFinite(location.rarity) || location.rarity < 0) {
    issues.push({ locationId, message: 'rarity must be a finite number >= 0' });
  }
  if (location.status === 'playable' && location.rarity <= 0) {
    issues.push({ locationId, message: 'playable locations must have rarity > 0' });
  }
  if (location.status !== 'playable' && location.rarity !== 0) {
    issues.push({ locationId, message: `${location.status} locations must have rarity 0` });
  }

  if (!isRecord(location.abilities)) {
    issues.push({ locationId, message: 'abilities must be an object' });
  } else {
    for (const key of unknownKeys(location.abilities, ABILITY_KEYS)) {
      issues.push({ locationId, message: `unknown location hook "${key}"` });
    }
    for (const [slot, expressions] of Object.entries(location.abilities)) {
      if (!Array.isArray(expressions)) {
        issues.push({ locationId, message: `abilities.${slot} must be an array` });
      } else {
        validateDslValue(expressions, `abilities.${slot}`, issues, locationId);
      }
    }
  }

  if (!isRecord(location.cosmetic)) {
    issues.push({ locationId, message: 'cosmetic must be an object' });
  } else {
    for (const key of unknownKeys(location.cosmetic, COSMETIC_KEYS)) {
      issues.push({ locationId, message: `cosmetic.${key} is not supported` });
    }
    if (typeof location.cosmetic.displayName !== 'string' || location.cosmetic.displayName.trim() === '') {
      issues.push({ locationId, message: 'cosmetic.displayName is required' });
    }
    if (typeof location.cosmetic.description !== 'string' || location.cosmetic.description.trim() === '') {
      issues.push({ locationId, message: 'cosmetic.description is required' });
    } else if (
      location.status === 'unimplemented'
      && !location.cosmetic.description.startsWith('UNIMPLEMENTED - ')
    ) {
      issues.push({ locationId, message: 'unimplemented descriptions must start with "UNIMPLEMENTED - "' });
    }
    if (!isRecord(location.cosmetic.art)) {
      issues.push({ locationId, message: 'cosmetic.art must be an object' });
    } else {
      for (const key of unknownKeys(location.cosmetic.art, ART_KEYS)) {
        issues.push({ locationId, message: `cosmetic.art.${key} is not supported` });
      }
      validateAssetRef(location.cosmetic.art.map, 'cosmetic.art.map', issues, locationId);
      const mapPath = isRecord(location.cosmetic.art.map) ? location.cosmetic.art.map.path : undefined;
      if (typeof mapPath === 'string' && !mapPath.startsWith('/art/maps/')) {
        issues.push({ locationId, message: 'map path must start with /art/maps/' });
      }
      if (location.cosmetic.art.thumbnail !== undefined) {
        validateAssetRef(location.cosmetic.art.thumbnail, 'cosmetic.art.thumbnail', issues, locationId);
      }
    }
    if (location.cosmetic.destroyedArt !== undefined) {
      validateAssetRef(location.cosmetic.destroyedArt, 'cosmetic.destroyedArt', issues, locationId);
    }
  }

  return issues;
};

const validateSetMetadata = (requestedId: string, metadata: LocationSetMetadata): void => {
  if (metadata.setId !== requestedId) {
    throw new Error(`loadLocationsFromSets: set key "${requestedId}" must match setId "${metadata.setId}"`);
  }
  if (metadata.status !== 'active') {
    throw new Error(`loadLocationsFromSets: set "${requestedId}" is not active`);
  }
  if (metadata.locationsPath !== 'locations') {
    throw new Error(`loadLocationsFromSets: set "${requestedId}" locationsPath must be "locations"`);
  }
};

export const getActiveLocationModules = (
  setIds: readonly string[] = ['core-v1'],
): readonly LocationModule[] => (
  setIds.flatMap((setId) => {
    const set = ACTIVE_LOCATION_SETS[setId];
    if (!set) throw new Error(`getActiveLocationModules: unknown active location set "${setId}"`);
    validateSetMetadata(setId, set.metadata);
    return [...set.modules];
  })
);

export const loadLocationsFromSets = (
  setIds: readonly string[] = ['core-v1'],
): LoadedLocationSet => {
  const modules = [...getActiveLocationModules(setIds)]
    .sort((a, b) => a.location.poolOrder - b.location.poolOrder);
  const locations: Record<string, LocationCardDef> = {};
  const disabledLocationIds: string[] = [];
  const seenPoolOrders = new Set<number>();

  for (const module of modules) {
    const issues = validateLocationModule(module);
    if (issues.length > 0) {
      throw new Error(
        `loadLocationsFromSets: invalid location "${module.location?.defId ?? module.folder}"\n`
        + issues.map((issue) => `- ${issue.message}`).join('\n'),
      );
    }
    if (locations[module.location.defId]) {
      throw new Error(`loadLocationsFromSets: duplicate defId "${module.location.defId}"`);
    }
    if (seenPoolOrders.has(module.location.poolOrder)) {
      throw new Error(`loadLocationsFromSets: duplicate poolOrder ${module.location.poolOrder}`);
    }
    seenPoolOrders.add(module.location.poolOrder);

    const { status } = module.location;
    const definition: LocationCardDef = {
      defId: module.location.defId,
      version: module.location.version,
      name: module.location.name,
      rarity: module.location.rarity,
      abilities: module.location.abilities,
      cosmetic: module.location.cosmetic,
    };
    locations[definition.defId] = definition;
    if (status === 'unimplemented') disabledLocationIds.push(definition.defId);
  }

  const poolOrders = [...seenPoolOrders].sort((a, b) => a - b);
  for (let index = 0; index < poolOrders.length; index++) {
    if (poolOrders[index] !== index) {
      throw new Error(
        `loadLocationsFromSets: poolOrder must be contiguous from 0; expected ${index}, got ${poolOrders[index]}`,
      );
    }
  }

  return { locations, disabledLocationIds };
};

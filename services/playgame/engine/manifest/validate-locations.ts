import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GENERATED_LOCATION_PATH,
  generateLocationModulesSource,
} from '../../../../scripts/locations/generate-location-modules';
import { getActiveCardModules } from './card-set-loader';
import {
  getActiveLocationModules,
  loadLocationsFromSets,
  validateLocationModule,
} from './location-set-loader';

let failures = 0;
const fail = (message: string): void => {
  failures++;
  console.error(`FAIL: ${message}`);
};

const projectRoot = pathResolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const modules = getActiveLocationModules(['core-v1']);
const cardIds = new Set(getActiveCardModules(['core-v1']).map((module) => module.card.defId));
const locationIds = new Set(modules.map((module) => module.location.defId));

if (!existsSync(GENERATED_LOCATION_PATH)) {
  fail(`${GENERATED_LOCATION_PATH}: generated module index is missing`);
} else {
  const currentGenerated = readFileSync(GENERATED_LOCATION_PATH, 'utf8');
  const expectedGenerated = generateLocationModulesSource();
  if (currentGenerated !== expectedGenerated) {
    fail(`${GENERATED_LOCATION_PATH}: stale generated module index; run npm run locations:generate`);
  }
}

for (const module of modules) {
  for (const issue of validateLocationModule(module)) {
    fail(`${issue.locationId}: ${issue.message}`);
  }

  const mapPath = module.location.cosmetic.art.map.path;
  if (mapPath.startsWith('/')) {
    const onDisk = pathResolve(projectRoot, `public${mapPath}`);
    if (!existsSync(onDisk)) fail(`${module.location.defId}: map asset does not exist: ${onDisk}`);
  }
}

try {
  loadLocationsFromSets(['core-v1']);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const visitRefs = (value: unknown, source: string, path = '$'): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitRefs(item, source, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  if (record.kind === 'DEF_ID_LIST' && Array.isArray(record.ids)) {
    record.ids.forEach((id, index) => {
      if (typeof id === 'string' && !cardIds.has(id)) {
        fail(`${source}: missing card defId "${id}" at ${path}.ids[${index}]`);
      }
    });
  }
  if (record.kind === 'COPY_OF_DEF' && typeof record.defId === 'string' && !cardIds.has(record.defId)) {
    fail(`${source}: missing card defId "${record.defId}" at ${path}.defId`);
  }
  if (
    record.kind === 'REPLACE_LOCATION'
    && typeof record.newDefId === 'string'
    && !locationIds.has(record.newDefId)
  ) {
    fail(`${source}: missing location defId "${record.newDefId}" at ${path}.newDefId`);
  }
  for (const [key, child] of Object.entries(record)) {
    visitRefs(child, source, `${path}.${key}`);
  }
};

for (const module of modules) {
  visitRefs(module.location.abilities, `location ${module.location.defId}`);
}

if (failures > 0) {
  console.error(`\n${failures} location validation failure(s).`);
  process.exit(1);
}

const loaded = loadLocationsFromSets(['core-v1']);
const playableCount = modules.filter((module) => module.location.status === 'playable').length;
const systemCount = modules.filter((module) => module.location.status === 'system').length;
console.log(
  `PASS: ${modules.length} core-v1 location definitions validated `
  + `(${playableCount} playable, ${systemCount} system, `
  + `${loaded.disabledLocationIds.length} disabled; ${Object.keys(loaded.locations).length} manifest entries).`,
);

import { existsSync, readFileSync } from 'node:fs';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { GENERATED_PATH, generateCardModulesSource } from '../../../../scripts/cards/generate-card-modules';
import { getActiveCardModules, validateCardModule } from './card-set-loader';
import { loadLocationsFromSets } from './location-set-loader';

let failures = 0;
const fail = (message: string): void => {
  failures++;
  console.error(`FAIL: ${message}`);
};

const modules = getActiveCardModules(['core-v1']);
const seen = new Set<string>();
const locations = Object.values(loadLocationsFromSets(['core-v1']).locations);
const locationIds = new Set(locations.map((location) => location.defId));

if (!existsSync(GENERATED_PATH)) {
  fail(`${GENERATED_PATH}: generated module index is missing`);
} else {
  const currentGenerated = readFileSync(GENERATED_PATH, 'utf8');
  const expectedGenerated = generateCardModulesSource();
  if (currentGenerated !== expectedGenerated) {
    fail(`${GENERATED_PATH}: stale generated module index; run npm run cards:generate`);
  }
}

for (const module of modules) {
  const issues = validateCardModule(module);
  for (const issue of issues) {
    fail(`${issue.cardId}: ${issue.message}`);
  }

  if (seen.has(module.card.defId)) {
    fail(`${module.card.defId}: duplicate defId`);
  }
  seen.add(module.card.defId);
}

const reportMissingCard = (source: string, path: string, defId: string): void => {
  if (!seen.has(defId)) fail(`${source}: missing card defId "${defId}" at ${path}`);
};

const reportMissingLocation = (source: string, path: string, defId: string): void => {
  if (!locationIds.has(defId)) fail(`${source}: missing location defId "${defId}" at ${path}`);
};

const visitRefs = (value: unknown, source: string, path = '$'): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitRefs(item, source, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  if (record.kind === 'DEF_ID_LIST') {
    const ids = record.ids;
    if (Array.isArray(ids)) {
      ids.forEach((id, index) => {
        if (typeof id === 'string') reportMissingCard(source, `${path}.ids[${index}]`, id);
      });
    }
  }
  if (record.kind === 'COPY_OF_DEF' && typeof record.defId === 'string') {
    reportMissingCard(source, `${path}.defId`, record.defId);
  }
  if (record.kind === 'REPLACE_LOCATION' && typeof record.newDefId === 'string') {
    reportMissingLocation(source, `${path}.newDefId`, record.newDefId);
  }

  for (const [key, child] of Object.entries(record)) {
    visitRefs(child, source, `${path}.${key}`);
  }
};

for (const module of modules) {
  visitRefs(module.card.abilities, `card ${module.card.defId}`);
}

for (const location of locations) {
  visitRefs(location.abilities, `location ${location.defId}`);
}

for (const deck of DEBUG_DECKS) {
  deck.cards.forEach((entry, index) => reportMissingCard(`debug deck ${deck.id}`, `cards[${index}].defId`, entry.defId));
}

if (failures > 0) {
  console.error(`\n${failures} card validation failure(s).`);
  process.exit(1);
}

console.log(`PASS: ${modules.length} active core-v1 cards validated.`);

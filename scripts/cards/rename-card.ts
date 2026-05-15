import { existsSync, readFileSync, renameSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateCardModulesSource } from './generate-card-modules';

const CARDS_DIR = 'services/playgame/engine/manifest/card-sets/core-v1/cards';
const GENERATED_PATH = 'services/playgame/engine/manifest/card-sets/core-v1/cards.generated.ts';
const TEXT_REFERENCE_ROOTS = [
  'services/playgame/debug',
  'services/playgame/engine/manifest/content',
  'services/playgame/presentation',
];
const TEXT_REFERENCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const [fromId, toId] = process.argv.slice(2);

const fail = (message: string): never => {
  console.error(`cards:rename failed: ${message}`);
  process.exit(1);
};

if (!fromId || !toId) fail('usage: npm run cards:rename -- <from-defId> <to-defId>');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toId)) fail(`"${toId}" is not kebab-case`);
if (fromId === toId) fail('from-defId and to-defId are identical');

const fromDir = join(CARDS_DIR, fromId);
const toDir = join(CARDS_DIR, toId);
if (!existsSync(fromDir)) fail(`missing card folder ${fromDir}`);
if (existsSync(toDir)) fail(`target card folder already exists: ${toDir}`);

const replaceJsonStrings = (value: unknown): unknown => {
  if (typeof value === 'string') return value === fromId ? toId : value;
  if (Array.isArray(value)) return value.map(replaceJsonStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, replaceJsonStrings(child)]),
    );
  }
  return value;
};

const walkFiles = (root: string): string[] => {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
};

renameSync(fromDir, toDir);

for (const jsonPath of walkFiles(CARDS_DIR).filter((path) => path.endsWith('.json'))) {
  const parsed = JSON.parse(readFileSync(jsonPath, 'utf8')) as unknown;
  const rewritten = replaceJsonStrings(parsed);
  writeFileSync(jsonPath, `${JSON.stringify(rewritten, null, 2)}\n`);
}

for (const root of TEXT_REFERENCE_ROOTS) {
  for (const path of walkFiles(root)) {
    const ext = path.slice(path.lastIndexOf('.'));
    if (!TEXT_REFERENCE_EXTENSIONS.has(ext)) continue;
    const current = readFileSync(path, 'utf8');
    const next = current
      .replaceAll(`'${fromId}'`, `'${toId}'`)
      .replaceAll(`"${fromId}"`, `"${toId}"`);
    if (next !== current) writeFileSync(path, next);
  }
}

writeFileSync(GENERATED_PATH, generateCardModulesSource());

console.log(`Renamed card defId ${fromId} -> ${toId}.`);
console.log(`Moved ${dirname(fromDir)}/${fromId} -> ${dirname(toDir)}/${toId}.`);
console.log('Regenerated cards.generated.ts.');

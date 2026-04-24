/**
 * BOOTSTRAP_MANIFEST structural tests.
 *
 * Runs under `npx tsx services/playgame/engine/manifest/manifest.test.ts`.
 * Validates that the manifest assembles correctly, has the expected
 * counts, and that every location references a real map asset.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOTSTRAP_MANIFEST } from './bootstrap';

// ESM equivalent of __dirname.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let failures = 0;
const pass = (label: string) => { console.log(`PASS: ${label}`); };
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail) : ''}`);
};
const expectEq = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(label);
  else fail(label, { actual, expected });
};
const expectTrue = (cond: boolean, label: string) => cond ? pass(label) : fail(label);

// ---- Counts ---------------------------------------------------------------

expectEq(Object.keys(BOOTSTRAP_MANIFEST.cards).length, 106, '106 cards in manifest (105 cyberpunk + junk-card token)');
expectEq(Object.keys(BOOTSTRAP_MANIFEST.locations).length, 35, '35 Vantaris locations in manifest');
expectEq(BOOTSTRAP_MANIFEST.disabled.locations.length, 13, '13 design-only locations disabled');

// ---- Locations are exactly the current map roster -------------------------

const expectedLocIds = [
  'backdoor',
  'black-clinic',
  'black-halo',
  'charging-station',
  'chip-swap',
  'chrome-beach',
  'chrome-depot',
  'cold-vault',
  'courthouse',
  'cryo-storage',
  'data-chapel',
  'debt-alley',
  'drone-hive',
  'fusion-plant',
  'ghost-market',
  'grub-hub',
  'helixdyne-lab',
  'kurotek-atrium',
  'market-sprawl',
  'meridian-tower',
  'nanobot-factory',
  'neon-reliquary',
  'netrunner-shrine',
  'noodle-bar',
  'organ-bank',
  'overclock-room',
  'patent-office',
  'power-sink',
  'red-needle',
  'scrap-yard',
  'signal-pit',
  'skyrail',
  'stock-exchange',
  'the-cage',
  'the-last-terminal',
];
for (const id of expectedLocIds) {
  expectTrue(BOOTSTRAP_MANIFEST.locations[id] !== undefined, `location "${id}" is present`);
}

for (const id of BOOTSTRAP_MANIFEST.disabled.locations) {
  const loc = BOOTSTRAP_MANIFEST.locations[id];
  expectTrue(loc !== undefined, `disabled location "${id}" exists in manifest.locations`);
  expectEq(loc?.rarity, 0, `disabled location "${id}" has rarity 0`);
  expectTrue(
    loc?.cosmetic.description.startsWith('UNIMPLEMENTED - ') ?? false,
    `disabled location "${id}" description is marked UNIMPLEMENTED`,
  );
}

// ---- Each location's map asset exists on disk -----------------------------

const projectRoot = pathResolve(__dirname, '../../../..');
for (const loc of Object.values(BOOTSTRAP_MANIFEST.locations)) {
  const mapPath = loc.cosmetic.art.map.path;
  expectTrue(mapPath.startsWith('/art/maps/'), `${loc.defId} map path under /art/maps/ (got "${mapPath}")`);
  const onDisk = pathResolve(projectRoot, 'public' + mapPath);
  expectTrue(existsSync(onDisk), `${loc.defId} map file exists on disk: ${onDisk}`);
}

// ---- defId → entry consistency --------------------------------------------

for (const [id, def] of Object.entries(BOOTSTRAP_MANIFEST.cards)) {
  expectEq(def.defId, id, `card key "${id}" matches def.defId`);
}
for (const [id, def] of Object.entries(BOOTSTRAP_MANIFEST.locations)) {
  expectEq(def.defId, id, `location key "${id}" matches def.defId`);
}

// ---- Stats sanity ----------------------------------------------------------

for (const c of Object.values(BOOTSTRAP_MANIFEST.cards)) {
  expectTrue(c.cost >= 0 && c.cost <= 6, `${c.defId} cost in [0,6] (got ${c.cost})`);
  expectTrue(c.basePower >= 0, `${c.defId} basePower >= 0 (got ${c.basePower})`);
  expectTrue(c.version >= 1, `${c.defId} version >= 1`);
  expectTrue(c.cosmetic.displayName.length > 0, `${c.defId} has displayName`);
  // Vanilla cards with no abilities legitimately have empty rulesText.
  const hasAbilities = Object.values(c.abilities).some(v => Array.isArray(v) && v.length > 0);
  if (hasAbilities) {
    expectTrue(c.cosmetic.rulesText.length > 0, `${c.defId} has rulesText`);
  }
}

// ---- Ability DSL well-formed-ness (spot-check a few) ----------------------

{
  const neonReliquary = BOOTSTRAP_MANIFEST.locations['neon-reliquary']!;
  const first = neonReliquary.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'ON_REVEAL_MULTIPLIER', 'Neon Reliquary ongoing[0] is ON_REVEAL_MULTIPLIER');
}
{
  const kurotek = BOOTSTRAP_MANIFEST.locations['kurotek-atrium']!;
  const first = kurotek.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'BOOST_ONGOINGS', 'KuroTek Atrium ongoing[0] is BOOST_ONGOINGS');
}
{
  const helixDyne = BOOTSTRAP_MANIFEST.locations['helixdyne-lab']!;
  const first = helixDyne.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'LANE_POWER_MULTIPLIER', 'HelixDyne Lab ongoing[0] is LANE_POWER_MULTIPLIER');
}
{
  const nanobotFactory = BOOTSTRAP_MANIFEST.locations['nanobot-factory']!;
  const first = nanobotFactory.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'POWER_ADD', 'Nanobot Factory ongoing[0] is POWER_ADD');
  if (first?.kind === 'POWER_ADD') {
    expectTrue(first.delta.kind === 'COUNT', 'Nanobot Factory delta is dynamic COUNT');
  }
}
{
  const marketSprawl = BOOTSTRAP_MANIFEST.locations['market-sprawl']!;
  const first = marketSprawl.abilities.onReveal?.[0];
  expectTrue(first?.kind === 'DRAW', 'Market Sprawl onReveal[0] is DRAW');
}

// ---- Exit ------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll manifest tests passed.');
}

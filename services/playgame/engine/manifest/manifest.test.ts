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
expectEq(Object.keys(BOOTSTRAP_MANIFEST.locations).length, 37, '37 Vantaris locations in manifest');
expectEq(BOOTSTRAP_MANIFEST.disabled.locations.length, 0, '0 design-only locations disabled');

// ---- Locations are exactly the current map roster -------------------------

const expectedLocIds = [
  'backdoor',
  'ammo-club',
  'black-clinic',
  'black-halo',
  'charging-station',
  'chip-tune',
  'chrome-beach',
  'chrome-depot',
  'civil-court',
  'courthouse',
  'cryobank',
  'cryo-storage',
  'data-chapel',
  'debt-alley',
  'drone-hive',
  'federal-courthouse',
  'gun-store',
  'helixdyne-lab',
  'kurotek-atrium',
  'meridian-tower',
  'dark-alley',
  'neon-reliquary',
  'netrunner-shrine',
  'organ-bank',
  'overclock-room',
  'pawn-shop',
  'power-sink',
  'public-pool',
  'red-needle',
  'rent-a-wreck',
  'scrap-yard',
  'signal-pit',
  'skyrail',
  'supercharging-station',
  'the-cage',
  'the-meat-market',
  'the-pineapple-club',
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
  const darkAlley = BOOTSTRAP_MANIFEST.locations['dark-alley']!;
  const first = darkAlley.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'POWER_ADD', 'Dark Alley ongoing[0] is POWER_ADD');
  if (first?.kind === 'POWER_ADD') {
    expectTrue(first.delta.kind === 'COUNT', 'Dark Alley delta is dynamic COUNT');
  }
}
{
  const chromeDepot = BOOTSTRAP_MANIFEST.locations['chrome-depot']!;
  const first = chromeDepot.abilities.onReveal?.[0];
  expectTrue(first?.kind === 'CREATE_CARD_IN_ZONE', 'Chrome Depot onReveal[0] is CREATE_CARD_IN_ZONE');
  if (first?.kind === 'CREATE_CARD_IN_ZONE') {
    expectTrue(first.pool.kind === 'COST_RANGE' && first.pool.min === 1 && first.pool.max === 1, 'Chrome Depot adds random 1-Cost cards');
    expectTrue(first.destination.kind === 'HAND', 'Chrome Depot creates cards in hand');
  }
}
{
  const rentAWreck = BOOTSTRAP_MANIFEST.locations['rent-a-wreck']!;
  const first = rentAWreck.abilities.onReveal?.[0];
  expectTrue(first?.kind === 'CREATE_CARD_IN_ZONE', 'Rent-A-Wreck onReveal[0] is CREATE_CARD_IN_ZONE');
  if (first?.kind === 'CREATE_CARD_IN_ZONE') {
    expectTrue(first.pool.kind === 'DEF_ID_LIST', 'Rent-A-Wreck uses a curated move-card pool');
    expectTrue(first.destination.kind === 'HAND', 'Rent-A-Wreck creates cards in hand');
  }
}

// ---- Exit ------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll manifest tests passed.');
}

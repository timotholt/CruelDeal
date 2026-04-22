/**
 * BOOTSTRAP_MANIFEST structural tests.
 *
 * Runs under `npx tsx services/playgame/engine/manifest/manifest.test.ts`.
 * Validates that the manifest assembles correctly, has the expected
 * counts, and that all three locations reference a real map asset.
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

expectEq(Object.keys(BOOTSTRAP_MANIFEST.cards).length, 10, '10 cards in manifest');
expectEq(Object.keys(BOOTSTRAP_MANIFEST.locations).length, 3, '3 locations in manifest');

// ---- Locations are exactly the three launch maps --------------------------

const expectedLocIds = ['cathedral', 'jungle-trail', 'science-lab'];
for (const id of expectedLocIds) {
  expectTrue(BOOTSTRAP_MANIFEST.locations[id] !== undefined, `location "${id}" is present`);
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
  expectTrue(c.cosmetic.rulesText.length > 0, `${c.defId} has rulesText`);
}

// ---- Ability DSL well-formed-ness (spot-check a few) ----------------------

{
  const cathedral = BOOTSTRAP_MANIFEST.locations['cathedral']!;
  const first = cathedral.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'ON_REVEAL_MULTIPLIER', 'Cathedral ongoing[0] is ON_REVEAL_MULTIPLIER');
}
{
  const sciLab = BOOTSTRAP_MANIFEST.locations['science-lab']!;
  const first = sciLab.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'LANE_POWER_MULTIPLIER', 'Science Lab ongoing[0] is LANE_POWER_MULTIPLIER');
}
{
  const jungle = BOOTSTRAP_MANIFEST.locations['jungle-trail']!;
  const first = jungle.abilities.ongoing?.[0];
  expectTrue(first?.kind === 'POWER_ADD', 'Jungle Trail ongoing[0] is POWER_ADD');
  if (first?.kind === 'POWER_ADD') {
    expectTrue(first.delta.kind === 'COUNT', 'Jungle Trail delta is dynamic COUNT');
  }
}

// ---- Exit ------------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll manifest tests passed.');
}

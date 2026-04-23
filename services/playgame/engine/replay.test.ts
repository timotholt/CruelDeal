import { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';
import { runMatch } from './cli/runMatch';
import { exportReplayBundle, replayMatch, validateReplayBundle } from './replay';

let failures = 0;
const pass = (label: string) => { console.log(`PASS: ${label}`); };
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail, null, 2) : ''}`);
};
const eq = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(label);
  else fail(label, { actual, expected });
};
const truthy = (cond: boolean, label: string) => cond ? pass(label) : fail(label);

{
  const result = runMatch({
    seed: 'replay-seed-1',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const replayed = replayMatch({
    seed: result.finalState.seed,
    manifest: BOOTSTRAP_MANIFEST,
    events: result.events,
  });

  eq(replayed.frames.length, result.events.length + 1, 'replayMatch: frame count = events + initial');
  eq(replayed.finalState, result.finalState, 'replayMatch: final state matches original run');
}

{
  const result = runMatch({
    seed: 'replay-seed-2',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const bundle = exportReplayBundle(result.finalState, BOOTSTRAP_MANIFEST, {
    localSeat: 'P0',
    notes: 'test bundle',
  });
  eq(bundle.seed, result.finalState.seed, 'exportReplayBundle: seed copied');
  eq(bundle.events.length, result.finalState.log.length, 'exportReplayBundle: event count matches log');
  eq(bundle.manifestVersion, BOOTSTRAP_MANIFEST.version, 'exportReplayBundle: manifestVersion copied');
}

{
  const result = runMatch({
    seed: 'replay-seed-3',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const bundle = exportReplayBundle(result.finalState, BOOTSTRAP_MANIFEST);
  const validation = validateReplayBundle(bundle, BOOTSTRAP_MANIFEST);
  truthy(validation.ok, 'validateReplayBundle: valid bundle passes');
  eq(validation.errors.length, 0, 'validateReplayBundle: valid bundle has no errors');
}

{
  const result = runMatch({
    seed: 'replay-seed-4',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const bundle = {
    ...exportReplayBundle(result.finalState, BOOTSTRAP_MANIFEST),
    manifestVersion: BOOTSTRAP_MANIFEST.version + 1,
  };
  const validation = validateReplayBundle(bundle, BOOTSTRAP_MANIFEST);
  truthy(!validation.ok, 'validateReplayBundle: mismatched manifest version fails');
  truthy(
    validation.errors.some((e) => e.includes('Manifest version mismatch')),
    'validateReplayBundle: mismatch error reported',
  );
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll replay tests passed.');
}

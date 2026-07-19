import { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';
import { runMatch } from './cli/runMatch';
import { exportReplayBundle, replayMatch, validateReplayBundle } from './replay';
import { createMatchGenesis, createSetupMatch } from './cli/initState';
import { apply } from './apply';
import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';

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
const clone = <T>(value: T): T => structuredClone(value) as T;
const framedEvents = (state: MatchState) => state.log.map(({ frame, scope, event }) => ({
  frame,
  scope,
  event: event as MatchEvent,
}));

{
  const initialState = createMatchGenesis('replay-seed-1', BOOTSTRAP_MANIFEST);
  const result = runMatch({
    seed: 'replay-seed-1',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const replayed = replayMatch({
    seed: result.finalState.seed,
    manifest: BOOTSTRAP_MANIFEST,
    initialState,
    framedEvents: framedEvents(result.finalState),
  });

  eq(replayed.steps.length, result.events.length + 1, 'replayMatch: step count = events + genesis');
  eq(replayed.finalState, result.finalState, 'replayMatch: final state matches original run');
}

{
  const initialState = createMatchGenesis('replay-seed-2', BOOTSTRAP_MANIFEST);
  const result = runMatch({
    seed: 'replay-seed-2',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const bundle = exportReplayBundle(result.finalState, BOOTSTRAP_MANIFEST, {
    localSeat: 'P0',
    notes: 'test bundle',
  }, initialState);
  eq(bundle.seed, result.finalState.seed, 'exportReplayBundle: seed copied');
  eq(bundle.framedEvents.length, result.finalState.log.length, 'exportReplayBundle: event count matches log');
  eq(bundle.manifestVersion, BOOTSTRAP_MANIFEST.version, 'exportReplayBundle: manifestVersion copied');
  eq(bundle.manifestSnapshot.version, BOOTSTRAP_MANIFEST.version, 'exportReplayBundle: manifest snapshot copied');
}

{
  const setup = createSetupMatch('replay-custom-initial', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'drill-instructor' }],
    P1: [{ defId: 'junk-card' }],
  });
  const initialState = setup.genesis;
  const initialSnapshot = clone(initialState);
  const cardId = initialState.deck.P0[0].id;
  const draw: MatchEvent = { type: 'CARD_DRAWN', owner: 'P0', cardId, toHand: true };
  const finalState = apply(setup.state, draw, BOOTSTRAP_MANIFEST);
  const replayed = replayMatch({
    seed: finalState.seed,
    manifest: BOOTSTRAP_MANIFEST,
    initialState,
    framedEvents: framedEvents(finalState),
  });
  eq(replayed.initialState.cards[cardId]!.defId, 'drill-instructor', 'replayMatch: preserves supplied initial card identity');
  eq(replayed.finalState, finalState, 'replayMatch: supplied initial state reaches expected final state');
  eq(initialState, initialSnapshot, 'apply/replayMatch: supplied initial state remains unmutated');
}

{
  const initialState = createMatchGenesis('replay-seed-3', BOOTSTRAP_MANIFEST);
  const result = runMatch({
    seed: 'replay-seed-3',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const bundle = exportReplayBundle(result.finalState, BOOTSTRAP_MANIFEST, undefined, initialState);
  const validation = validateReplayBundle(bundle, BOOTSTRAP_MANIFEST);
  truthy(validation.ok, 'validateReplayBundle: valid bundle passes');
  eq(validation.errors.length, 0, 'validateReplayBundle: valid bundle has no errors');

  const legacyValidation = validateReplayBundle(
    { ...bundle, version: 1 } as unknown as typeof bundle,
    BOOTSTRAP_MANIFEST,
  );
  truthy(!legacyValidation.ok, 'validateReplayBundle: legacy raw-event schema is rejected');
  truthy(
    legacyValidation.errors.some((e) => e.includes('Unsupported replay bundle version: 1')),
    'validateReplayBundle: legacy schema reports its unsupported version',
  );
}

{
  const initialState = createMatchGenesis('replay-seed-4', BOOTSTRAP_MANIFEST);
  const result = runMatch({
    seed: 'replay-seed-4',
    manifest: BOOTSTRAP_MANIFEST,
  });
  const bundle = {
    ...exportReplayBundle(result.finalState, BOOTSTRAP_MANIFEST, undefined, initialState),
    manifestVersion: BOOTSTRAP_MANIFEST.version + 1,
  };
  const validation = validateReplayBundle(bundle, BOOTSTRAP_MANIFEST);
  truthy(!validation.ok, 'validateReplayBundle: mismatched manifest version fails');
  truthy(
    validation.errors.some((e) => e.includes('Manifest version mismatch')),
    'validateReplayBundle: mismatch error reported',
  );
}

{
  const result = runMatch({
    seed: 'replay-missing-initial',
    manifest: BOOTSTRAP_MANIFEST,
  });
  let threw = false;
  try {
    replayMatch({
      seed: result.finalState.seed,
      manifest: BOOTSTRAP_MANIFEST,
      initialState: undefined as never,
      framedEvents: framedEvents(result.finalState),
    });
  } catch {
    threw = true;
  }
  truthy(threw, 'replayMatch: missing initialState throws');
}

{
  const currentState = createMatchGenesis('replay-bad-export', BOOTSTRAP_MANIFEST);
  const badInitial = { ...currentState, seed: 'different-seed' } as MatchState;
  let threw = false;
  try {
    exportReplayBundle(currentState, BOOTSTRAP_MANIFEST, undefined, badInitial);
  } catch {
    threw = true;
  }
  truthy(threw, 'exportReplayBundle: mismatched initialState throws');
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll replay tests passed.');
}

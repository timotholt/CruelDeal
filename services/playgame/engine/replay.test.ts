import { getCardState } from './projections/cardRuntime';
import { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';
import { runMatch } from './cli/runMatch';
import { exportReplayBundle, replayMatch, validateReplayBundle } from './replay';
import { createMatchGenesis, createSetupMatch } from './cli/initState';
import { frameAndFoldEvents } from './transactionTimeline';
import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';
import type { CardId } from './types/ids';
import { orderedTestLocationDeck } from './testkit/runtimeFixture';

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
const locationDeck = orderedTestLocationDeck(BOOTSTRAP_MANIFEST);

{
  const initialState = createMatchGenesis('replay-seed-1', BOOTSTRAP_MANIFEST);
  const result = runMatch({
    seed: 'replay-seed-1',
    manifest: BOOTSTRAP_MANIFEST,
    locationDeck,
  });
  const replayed = replayMatch({
    seed: result.finalState.rng.seed,
    manifest: BOOTSTRAP_MANIFEST,
    initialState,
    framedEvents: result.framedEvents,
  });

  eq(replayed.steps.length, result.events.length + 1, 'replayMatch: step count = events + genesis');
  eq(replayed.finalState, result.finalState, 'replayMatch: final state matches original run');
}

{
  const initialState = createMatchGenesis('replay-seed-2', BOOTSTRAP_MANIFEST);
  const result = runMatch({
    seed: 'replay-seed-2',
    manifest: BOOTSTRAP_MANIFEST,
    locationDeck,
  });
  const bundle = exportReplayBundle({
    finalState: result.finalState,
    manifest: BOOTSTRAP_MANIFEST,
    metadata: {
      localSeat: 'P0',
      notes: 'test bundle',
    },
    initialState,
    framedEvents: result.framedEvents,
  });
  eq(bundle.seed, result.finalState.rng.seed, 'exportReplayBundle: seed copied');
  eq(bundle.framedEvents.length, result.framedEvents.length, 'exportReplayBundle: event count matches record');
  eq(bundle.manifestVersion, BOOTSTRAP_MANIFEST.version, 'exportReplayBundle: manifestVersion copied');
  eq(bundle.manifestSnapshot.version, BOOTSTRAP_MANIFEST.version, 'exportReplayBundle: manifest snapshot copied');
}

{
  const setup = createSetupMatch('replay-custom-initial', BOOTSTRAP_MANIFEST, {
    P0: [{ defId: 'drill-instructor' }],
    P1: [{ defId: 'junk-card' }],
  }, locationDeck);
  const initialState = setup.genesis;
  const initialSnapshot = clone(initialState);
  const cardId = initialState.deck.P0[0];
  const draw: MatchEvent = {
    type: 'CARD_DRAWN',
    owner: 'P0',
    cardId,
    cause: {
      sourceId: 'system:replay-test' as CardId,
      effectKind: 'SYSTEM',
      reason: 'TEST_DRAW',
    },
  };
  const drawTransaction = frameAndFoldEvents({
    transactionId: 'replay-custom-initial:draw',
    initialState: setup.state,
    events: [draw],
    manifest: BOOTSTRAP_MANIFEST,
  });
  const finalState = drawTransaction.finalState;
  const replayed = replayMatch({
    seed: finalState.rng.seed,
    manifest: BOOTSTRAP_MANIFEST,
    initialState,
    framedEvents: [
      ...setup.transaction.framedEvents,
      ...drawTransaction.framedEvents,
    ],
  });
  eq(getCardState(replayed.initialState, cardId)!.defId, 'drill-instructor', 'replayMatch: preserves supplied initial card identity');
  eq(replayed.finalState, finalState, 'replayMatch: supplied initial state reaches expected final state');
  eq(initialState, initialSnapshot, 'apply/replayMatch: supplied initial state remains unmutated');
}

{
  const initialState = createMatchGenesis('replay-seed-3', BOOTSTRAP_MANIFEST);
  const result = runMatch({
    seed: 'replay-seed-3',
    manifest: BOOTSTRAP_MANIFEST,
    locationDeck,
  });
  const bundle = exportReplayBundle({
    finalState: result.finalState,
    manifest: BOOTSTRAP_MANIFEST,
    initialState,
    framedEvents: result.framedEvents,
  });
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
    locationDeck,
  });
  const bundle = {
    ...exportReplayBundle({
      finalState: result.finalState,
      manifest: BOOTSTRAP_MANIFEST,
      initialState,
      framedEvents: result.framedEvents,
    }),
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
    locationDeck,
  });
  let threw = false;
  try {
    replayMatch({
      seed: result.finalState.rng.seed,
      manifest: BOOTSTRAP_MANIFEST,
      initialState: undefined as never,
      framedEvents: result.framedEvents,
    });
  } catch {
    threw = true;
  }
  truthy(threw, 'replayMatch: missing initialState throws');
}

{
  const currentState = createMatchGenesis('replay-bad-export', BOOTSTRAP_MANIFEST);
  const badInitial = {
    ...currentState,
    rng: { ...currentState.rng, seed: 'different-seed' },
  } as MatchState;
  let threw = false;
  try {
    exportReplayBundle({
      finalState: currentState,
      manifest: BOOTSTRAP_MANIFEST,
      initialState: badInitial,
      framedEvents: [],
    });
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

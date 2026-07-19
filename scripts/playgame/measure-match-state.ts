import { gzipSync } from 'node:zlib';

import { createMatchGenesis } from '../../services/playgame/engine/cli/initState';
import { runMatch } from '../../services/playgame/engine/cli/runMatch';
import { BOOTSTRAP_MANIFEST } from '../../services/playgame/engine/manifest/bootstrap';
import { cardRecordsInternal } from '../../services/playgame/engine/internal/cardStore';
import { locationRecordsInternal } from '../../services/playgame/engine/internal/locationStore';
import { replayMatch } from '../../services/playgame/engine/replay';
import type { MatchState } from '../../services/playgame/engine/types/state';
import { defaultLocationDeckFactory } from '../../services/playgame/runtime/locationDeckFactory';

const MATCH_COUNT = 20;
const FINAL_STATE_AVERAGE_BUDGET_BYTES = 25_000;

interface Sample {
  readonly genesisBytes: number;
  readonly finalStateBytes: number;
  readonly finalStateGzipBytes: number;
  readonly replayRecordBytes: number;
  readonly replayRecordGzipBytes: number;
  readonly playCheckpointBytes: number;
  readonly playCheckpointGzipBytes: number;
  readonly plays: number;
  readonly topLevelBytes: Readonly<Record<string, number>>;
  readonly cardFieldBytes: Readonly<Record<string, number>>;
  readonly locationFieldBytes: Readonly<Record<string, number>>;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function bytes(value: unknown): number {
  return Buffer.byteLength(json(value));
}

function gzipBytes(value: unknown): number {
  return gzipSync(json(value)).byteLength;
}

function summarize(values: readonly number[]): {
  readonly min: number;
  readonly average: number;
  readonly max: number;
} {
  return {
    min: Math.min(...values),
    average: Math.round(values.reduce((total, value) => total + value, 0) / values.length),
    max: Math.max(...values),
  };
}

function fieldBytes(
  records: readonly object[],
): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      totals[key] = (totals[key] ?? 0) + bytes({ [key]: value });
    }
  }
  return totals;
}

function averageBreakdown(
  samples: readonly Sample[],
  select: (sample: Sample) => Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const sample of samples) {
    for (const [key, value] of Object.entries(select(sample))) {
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return Object.fromEntries(
    Object.entries(totals)
      .map(([key, value]) => [key, Math.round(value / samples.length)] as const)
      .sort((left, right) => right[1] - left[1]),
  );
}

function assertHistoryFree(state: MatchState): void {
  if ('log' in state) {
    throw new Error('MatchState must not own canonical event history');
  }
}

function sample(seed: string): Sample {
  const manifest = BOOTSTRAP_MANIFEST;
  const ruleset = manifest.rulesets.standard;
  if (!ruleset) throw new Error('state-size probe requires the standard ruleset');

  const locationDeck = defaultLocationDeckFactory.build({
    manifest,
    ruleset,
    seed,
  });
  const genesis = createMatchGenesis(seed, manifest);
  const result = runMatch({
    seed,
    manifest,
    locationDeck: locationDeck.entries,
  });
  assertHistoryFree(genesis);
  assertHistoryFree(result.finalState);

  const replay = replayMatch({
    seed,
    manifest,
    initialState: genesis,
    framedEvents: result.framedEvents,
  });
  const checkpoints = replay.steps
    .filter(step => step.event?.type === 'CARD_STAGED')
    .map(step => step.state);
  const replayRecord = {
    version: 3,
    genesis,
    framedEvents: result.framedEvents,
  };

  return {
    genesisBytes: bytes(genesis),
    finalStateBytes: bytes(result.finalState),
    finalStateGzipBytes: gzipBytes(result.finalState),
    replayRecordBytes: bytes(replayRecord),
    replayRecordGzipBytes: gzipBytes(replayRecord),
    playCheckpointBytes: bytes(checkpoints),
    playCheckpointGzipBytes: gzipBytes(checkpoints),
    plays: checkpoints.length,
    topLevelBytes: fieldBytes([result.finalState]),
    cardFieldBytes: fieldBytes(Object.values(cardRecordsInternal(result.finalState))),
    locationFieldBytes: fieldBytes(Object.values(locationRecordsInternal(result.finalState))),
  };
}

const samples = Array.from(
  { length: MATCH_COUNT },
  (_, index) => sample(`match-state-size:${index}`),
);

const report = {
  matches: MATCH_COUNT,
  finalStateAverageBudgetBytes: FINAL_STATE_AVERAGE_BUDGET_BYTES,
  plays: summarize(samples.map(value => value.plays)),
  genesisBytes: summarize(samples.map(value => value.genesisBytes)),
  finalStateBytes: summarize(samples.map(value => value.finalStateBytes)),
  finalStateGzipBytes: summarize(samples.map(value => value.finalStateGzipBytes)),
  replayRecordBytes: summarize(samples.map(value => value.replayRecordBytes)),
  replayRecordGzipBytes: summarize(samples.map(value => value.replayRecordGzipBytes)),
  playCheckpointBytes: summarize(samples.map(value => value.playCheckpointBytes)),
  playCheckpointGzipBytes: summarize(samples.map(value => value.playCheckpointGzipBytes)),
  averageTopLevelFieldBytes: averageBreakdown(samples, sample => sample.topLevelBytes),
  averageCardFieldBytes: averageBreakdown(samples, sample => sample.cardFieldBytes),
  averageLocationFieldBytes: averageBreakdown(samples, sample => sample.locationFieldBytes),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (report.finalStateBytes.average > FINAL_STATE_AVERAGE_BUDGET_BYTES) {
  throw new Error(
    `average final MatchState is ${report.finalStateBytes.average} bytes; `
    + `budget is ${FINAL_STATE_AVERAGE_BUDGET_BYTES}`,
  );
}

import type { Manifest } from '../engine/manifest/types';
import type { ReplayFrame, ReplayResult } from '../engine/replay';
import { buildEventTransactionFrames } from '../engine/transactionFrames';
import type { MatchRuntimeReplayExport } from './contracts';

/** Read-only replay rendering from the runtime's canonical export shape. */
export function renderRuntimeReplay(
  replay: MatchRuntimeReplayExport,
  manifest: Manifest,
): ReplayResult {
  if (replay.bootstrap.manifestVersion !== manifest.version) {
    throw new Error(
      `Runtime replay manifest mismatch: export=${replay.bootstrap.manifestVersion} manifest=${manifest.version}`,
    );
  }
  if (replay.genesis.seed !== replay.bootstrap.seed) {
    throw new Error(
      `Runtime replay seed mismatch: bootstrap=${replay.bootstrap.seed} genesis=${replay.genesis.seed}`,
    );
  }

  const frames: ReplayFrame[] = [{ index: 0, event: null, state: replay.genesis }];
  let state = replay.genesis;
  let previousRevision = 0;

  for (const transaction of replay.transactions) {
    if (transaction.matchId !== replay.bootstrap.matchId) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has the wrong matchId`);
    }
    if (transaction.revision <= previousRevision || transaction.baseRevision < previousRevision) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} is out of order`);
    }
    if (transaction.revision !== transaction.baseRevision + 1) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has a non-contiguous commit revision`);
    }

    const built = buildEventTransactionFrames({
      transactionId: transaction.transactionId,
      initialState: state,
      events: transaction.events,
      manifest,
    });
    for (const frame of built.frames) {
      frames.push({
        index: frames.length,
        transactionId: transaction.transactionId,
        event: frame.event,
        state: frame.after,
      });
    }
    state = built.finalState;
    previousRevision = transaction.revision;
  }

  return {
    initialState: replay.genesis,
    finalState: state,
    frames,
  };
}

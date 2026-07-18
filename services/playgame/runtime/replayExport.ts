import type { Manifest } from '../engine/manifest/types';
import type { ReplayResult, ReplayStep } from '../engine/replay';
import { currentFrame } from '../engine/timeline';
import { foldFramedEvents } from '../engine/transactionTimeline';
import { GENESIS_FRAME } from '../engine/types/timeline';
import { assertProtocolPayload } from '../protocol';
import type { MatchRuntimeReplayExport } from './contracts';

/** Read-only replay rendering from the runtime's canonical export shape. */
export function renderRuntimeReplay(
  replay: MatchRuntimeReplayExport,
  manifest: Manifest,
): ReplayResult {
  const serializedVersion = (replay as { readonly version: number }).version;
  if (serializedVersion !== 2) {
    throw new Error(`Unsupported runtime replay version: ${serializedVersion}`);
  }
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
  if (currentFrame(replay.genesis) !== GENESIS_FRAME || replay.genesis.log.length !== 0) {
    throw new Error(
      `Runtime replay genesis must be frame 0; received frame ${currentFrame(replay.genesis)}`,
    );
  }

  const steps: ReplayStep[] = [{
    cursor: 0,
    framedEvent: null,
    frame: GENESIS_FRAME,
    scope: null,
    event: null,
    state: replay.genesis,
  }];
  let state = replay.genesis;
  let previousRevision = 0;
  const transactionIds = new Set<string>();

  for (const transaction of replay.transactions) {
    if (transactionIds.has(transaction.transactionId)) {
      throw new Error(`Runtime replay has duplicate transactionId ${transaction.transactionId}`);
    }
    transactionIds.add(transaction.transactionId);
    if (transaction.matchId !== replay.bootstrap.matchId) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has the wrong matchId`);
    }
    if (
      transaction.baseRevision < previousRevision
      || transaction.revision <= previousRevision
    ) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} is out of order`);
    }
    if (transaction.revision !== transaction.baseRevision + 1) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has a non-contiguous commit revision`);
    }
    if (transaction.framedEvents.length === 0) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has no framed events`);
    }
    assertProtocolPayload('COMMITTED_TRANSACTION', transaction);

    const built = foldFramedEvents({
      transactionId: transaction.transactionId,
      initialState: state,
      framedEvents: transaction.framedEvents,
      manifest,
    });
    for (const frame of built.transitions) {
      steps.push({
        cursor: steps.length,
        transactionId: transaction.transactionId,
        framedEvent: frame.framedEvent,
        frame: frame.frame,
        scope: frame.scope,
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
    steps,
  };
}

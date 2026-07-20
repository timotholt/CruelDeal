import type { MatchEvent } from './types/events';
import type { Manifest } from './manifest/types';
import type { MatchState } from './types/state';
import { currentFrame } from './timeline';
import {
  GENESIS_FRAME,
  type Frame,
  type FramedEvent,
  type TemporalScope,
} from './types/timeline';
import { foldFramedEvents } from './transactionTimeline';
import { assertProtocolPayload } from '../protocol';
import {
  getAllCardIds,
  getCardRuntime,
} from './projections/cardRuntime';
import { getCardTemplate } from './projections/cardTemplate';
import { getAllLocationStates } from './projections/locationRuntime';
import { getLocationTemplate } from './projections/locationTemplate';

export interface ReplayBundle {
  readonly version: 3;
  readonly manifestVersion: number;
  readonly protocolVersion: number;
  readonly seed: string;
  readonly manifestSnapshot: Manifest;
  readonly initialState: MatchState;
  readonly framedEvents: readonly FramedEvent[];
  readonly metadata?: {
    readonly createdAt?: string;
    readonly localSeat?: 'P0' | 'P1';
    readonly notes?: string;
  };
}

/**
 * Materialized replay view. `cursor` addresses playback storage; `frame` is
 * the one canonical gameplay coordinate shared with live execution.
 */
export interface ReplayStep {
  readonly cursor: number;
  /** Present on runtime-record replays so debug UI can resolve the actor. */
  readonly transactionId?: string;
  readonly framedEvent: FramedEvent | null;
  readonly frame: Frame;
  readonly scope: TemporalScope | null;
  readonly event: MatchEvent | null;
  readonly state: MatchState;
}

export interface ReplayResult {
  readonly initialState: MatchState;
  readonly finalState: MatchState;
  readonly steps: readonly ReplayStep[];
}

export interface ReplayMatchOptions {
  readonly seed: string;
  readonly manifest: Manifest;
  readonly initialState: MatchState;
  readonly framedEvents: readonly FramedEvent[];
}

export interface ReplayValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export interface ExportReplayBundleOptions {
  readonly finalState: MatchState;
  readonly manifest: Manifest;
  readonly metadata?: ReplayBundle['metadata'];
  readonly initialState: MatchState;
  readonly framedEvents: readonly FramedEvent[];
}

export function replayMatch(opts: ReplayMatchOptions): ReplayResult {
  if (opts.initialState.rng.seed !== opts.seed) {
    throw new Error(`replayMatch: seed mismatch initialState=${opts.initialState.rng.seed} replay=${opts.seed}`);
  }
  assertReplayInitialState(opts.initialState, opts.manifest);
  for (const framedEvent of opts.framedEvents) {
    assertProtocolPayload('FRAMED_EVENT', framedEvent);
  }
  const initialState = opts.initialState;
  const transaction = foldFramedEvents({
    transactionId: 'replay',
    initialState,
    framedEvents: opts.framedEvents,
    manifest: opts.manifest,
  });
  const steps: ReplayStep[] = [
    {
      cursor: 0,
      framedEvent: null,
      frame: GENESIS_FRAME,
      scope: null,
      event: null,
      state: initialState,
    },
    ...transaction.transitions.map((frame) => ({
      cursor: frame.index + 1,
      framedEvent: frame.framedEvent,
      frame: frame.frame,
      scope: frame.scope,
      event: frame.event,
      state: frame.after,
    })),
  ];

  return {
    initialState,
    finalState: transaction.finalState,
    steps,
  };
}

export function exportReplayBundle(
  options: ExportReplayBundleOptions,
): ReplayBundle {
  const {
    finalState,
    manifest,
    metadata,
    initialState,
    framedEvents,
  } = options;
  if (initialState.rng.seed !== finalState.rng.seed) {
    throw new Error(
      `exportReplayBundle: seed mismatch initialState=${initialState.rng.seed} state=${finalState.rng.seed}`,
    );
  }
  for (const framedEvent of framedEvents) {
    assertProtocolPayload('FRAMED_EVENT', framedEvent);
  }
  const finalFrame = framedEvents.at(-1)?.frame ?? GENESIS_FRAME;
  if (currentFrame(finalState) !== finalFrame) {
    throw new Error(
      `exportReplayBundle: final state frame ${currentFrame(finalState)} does not match event frame ${finalFrame}`,
    );
  }
  return {
    version: 3,
    manifestVersion: manifest.version,
    protocolVersion: manifest.protocolVersion,
    seed: finalState.rng.seed,
    manifestSnapshot: manifest,
    initialState,
    framedEvents,
    metadata,
  };
}

export function replayBundle(bundle: ReplayBundle): ReplayResult {
  assertReplayBundle(bundle);
  return replayMatch({
    seed: bundle.seed,
    manifest: bundle.manifestSnapshot,
    initialState: bundle.initialState,
    framedEvents: bundle.framedEvents,
  });
}

export function assertReplayBundle(bundle: ReplayBundle): void {
  const serializedVersion = (bundle as { readonly version: number }).version;
  if (serializedVersion !== 3) {
    throw new Error(`Unsupported replay bundle version: ${serializedVersion}`);
  }
  if (!bundle.manifestSnapshot) {
    throw new Error('Replay bundle is missing manifestSnapshot');
  }
  if (bundle.manifestVersion !== bundle.manifestSnapshot.version) {
    throw new Error(
      `Replay manifest version mismatch: bundle=${bundle.manifestVersion} snapshot=${bundle.manifestSnapshot.version}`,
    );
  }
  if (bundle.protocolVersion !== bundle.manifestSnapshot.protocolVersion) {
    throw new Error(
      `Replay protocol version mismatch: bundle=${bundle.protocolVersion} snapshot=${bundle.manifestSnapshot.protocolVersion}`,
    );
  }
  if (bundle.initialState.rng.seed !== bundle.seed) {
    throw new Error(`Replay seed mismatch: bundle=${bundle.seed} initialState=${bundle.initialState.rng.seed}`);
  }
  if (!Array.isArray(bundle.framedEvents)) {
    throw new Error('Replay bundle framedEvents must be an array');
  }
  assertReplayInitialState(bundle.initialState, bundle.manifestSnapshot);
}

function assertReplayInitialState(initialState: MatchState, manifest: Manifest): void {
  if (
    currentFrame(initialState) !== GENESIS_FRAME
    || initialState.timeline.scope !== null
  ) {
    throw new Error(
      `Replay initialState must be frame 0; received frame ${currentFrame(initialState)}`,
    );
  }
  for (const id of getAllCardIds(initialState)) {
    const card = getCardRuntime(initialState, id, manifest);
    if (!card) continue;
    const def = getCardTemplate(manifest, card.defId);
    if (!def) {
      throw new Error(`Replay initialState references missing card def "${card.defId}" for card ${card.id}`);
    }
    if (card.variantId !== undefined && !def.variantIds.includes(card.variantId)) {
      throw new Error(
        `Replay initialState references missing variant "${card.variantId}" for card ${card.id}`,
      );
    }
  }
  for (const location of getAllLocationStates(initialState)) {
    if (!getLocationTemplate(manifest, location.defId)) {
      throw new Error(
        `Replay initialState references missing location def "${location.defId}" for location ${location.id}`,
      );
    }
  }
}

export function validateReplayBundle(
  bundle: ReplayBundle,
  manifest: Manifest,
): ReplayValidationResult {
  const errors: string[] = [];

  const serializedVersion = (bundle as { readonly version: number }).version;
  if (serializedVersion !== 3) {
    errors.push(`Unsupported replay bundle version: ${serializedVersion}`);
  }
  if (bundle.manifestVersion !== manifest.version) {
    errors.push(
      `Manifest version mismatch: bundle=${bundle.manifestVersion} manifest=${manifest.version}`,
    );
  }
  if (bundle.protocolVersion !== manifest.protocolVersion) {
    errors.push(
      `Protocol version mismatch: bundle=${bundle.protocolVersion} manifest=${manifest.protocolVersion}`,
    );
  }
  if (!Array.isArray(bundle.framedEvents)) {
    errors.push('Replay bundle framedEvents must be an array');
  }
  if (!bundle.manifestSnapshot) {
    errors.push('Replay bundle is missing manifestSnapshot');
  }

  if (errors.length === 0) {
    replayMatch({
      seed: bundle.seed,
      manifest: bundle.manifestSnapshot,
      initialState: bundle.initialState,
      framedEvents: bundle.framedEvents,
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

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

export interface ReplayBundle {
  readonly version: 2;
  readonly manifestVersion: number;
  readonly protocolVersion: number;
  readonly seed: string;
  readonly manifestSnapshot: Manifest;
  readonly initialState?: MatchState;
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

export function replayMatch(opts: ReplayMatchOptions): ReplayResult {
  if (!opts.initialState) {
    throw new Error('replayMatch: initialState is required; refusing to rebuild replay state from seed');
  }
  if (opts.initialState.seed !== opts.seed) {
    throw new Error(`replayMatch: seed mismatch initialState=${opts.initialState.seed} replay=${opts.seed}`);
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
  state: MatchState,
  manifest: Manifest,
  extras: ReplayBundle['metadata'] | undefined,
  initialState: MatchState,
): ReplayBundle {
  if (!initialState) {
    throw new Error('exportReplayBundle: initialState is required');
  }
  if (initialState.seed !== state.seed) {
    throw new Error(`exportReplayBundle: seed mismatch initialState=${initialState.seed} state=${state.seed}`);
  }
  const framedEvents = state.log.map((entry) => ({
    frame: entry.frame,
    scope: entry.scope,
    event: entry.event as MatchEvent,
  }));
  for (const framedEvent of framedEvents) {
    assertProtocolPayload('FRAMED_EVENT', framedEvent);
  }
  return {
    version: 2,
    manifestVersion: manifest.version,
    protocolVersion: manifest.protocolVersion,
    seed: state.seed,
    manifestSnapshot: manifest,
    initialState,
    framedEvents,
    metadata: extras,
  };
}

export function replayBundle(bundle: ReplayBundle): ReplayResult {
  assertReplayBundle(bundle);
  return replayMatch({
    seed: bundle.seed,
    manifest: bundle.manifestSnapshot,
    initialState: bundle.initialState!,
    framedEvents: bundle.framedEvents,
  });
}

export function assertReplayBundle(bundle: ReplayBundle): void {
  const serializedVersion = (bundle as { readonly version: number }).version;
  if (serializedVersion !== 2) {
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
  if (!bundle.initialState) {
    throw new Error('Replay bundle is missing initialState');
  }
  if (bundle.initialState.seed !== bundle.seed) {
    throw new Error(`Replay seed mismatch: bundle=${bundle.seed} initialState=${bundle.initialState.seed}`);
  }
  if (!Array.isArray(bundle.framedEvents)) {
    throw new Error('Replay bundle framedEvents must be an array');
  }
  assertReplayInitialState(bundle.initialState, bundle.manifestSnapshot);
}

function assertReplayInitialState(initialState: MatchState, manifest: Manifest): void {
  if (currentFrame(initialState) !== GENESIS_FRAME || initialState.log.length !== 0) {
    throw new Error(
      `Replay initialState must be frame 0; received frame ${currentFrame(initialState)}`,
    );
  }
  for (const card of Object.values(initialState.cards)) {
    const def = manifest.cards[card.defId];
    if (!def) {
      throw new Error(`Replay initialState references missing card def "${card.defId}" for card ${card.id}`);
    }
    if (card.variantId !== undefined && !def.cosmetic.variants?.some(
      (variant) => variant.variantId === card.variantId,
    )) {
      throw new Error(
        `Replay initialState references missing variant "${card.variantId}" for card ${card.id}`,
      );
    }
  }
  for (const location of Object.values(initialState.locationCards)) {
    if (!manifest.locations[location.defId]) {
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
  if (serializedVersion !== 2) {
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
  if (!bundle.initialState) {
    errors.push('Replay bundle is missing initialState');
  }
  if (!bundle.manifestSnapshot) {
    errors.push('Replay bundle is missing manifestSnapshot');
  }

  if (errors.length === 0) {
    replayMatch({
      seed: bundle.seed,
      manifest: bundle.manifestSnapshot,
      initialState: bundle.initialState!,
      framedEvents: bundle.framedEvents,
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

import type { MatchEvent } from './types/events';
import type { Manifest } from './manifest/types';
import type { MatchState } from './types/state';
import { apply } from './apply';

export interface ReplayBundle {
  readonly version: 1;
  readonly manifestVersion: number;
  readonly protocolVersion: number;
  readonly seed: string;
  readonly manifestSnapshot: Manifest;
  readonly initialState?: MatchState;
  readonly events: readonly MatchEvent[];
  readonly metadata?: {
    readonly createdAt?: string;
    readonly localSeat?: 'P0' | 'P1';
    readonly notes?: string;
  };
}

export interface ReplayFrame {
  readonly index: number;
  readonly event: MatchEvent | null;
  readonly state: MatchState;
}

export interface ReplayResult {
  readonly initialState: MatchState;
  readonly finalState: MatchState;
  readonly frames: readonly ReplayFrame[];
}

export interface ReplayMatchOptions {
  readonly seed: string;
  readonly manifest: Manifest;
  readonly initialState: MatchState;
  readonly events: readonly MatchEvent[];
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
  const initialState = opts.initialState;
  const frames: ReplayFrame[] = [{ index: 0, event: null, state: initialState }];
  let state = initialState;

  for (let i = 0; i < opts.events.length; i++) {
    state = apply(state, opts.events[i], opts.manifest);
    frames.push({
      index: i + 1,
      event: opts.events[i],
      state,
    });
  }

  return {
    initialState,
    finalState: state,
    frames,
  };
}

export function exportReplayBundle(
  state: MatchState,
  manifest: Manifest,
  extras?: ReplayBundle['metadata'],
  initialState: MatchState,
): ReplayBundle {
  if (!initialState) {
    throw new Error('exportReplayBundle: initialState is required');
  }
  if (initialState.seed !== state.seed) {
    throw new Error(`exportReplayBundle: seed mismatch initialState=${initialState.seed} state=${state.seed}`);
  }
  return {
    version: 1,
    manifestVersion: manifest.version,
    protocolVersion: manifest.protocolVersion,
    seed: state.seed,
    manifestSnapshot: manifest,
    initialState,
    events: state.log.map((entry) => entry.event as MatchEvent),
    metadata: extras,
  };
}

export function replayBundle(bundle: ReplayBundle): ReplayResult {
  assertReplayBundle(bundle);
  return replayMatch({
    seed: bundle.seed,
    manifest: bundle.manifestSnapshot,
    initialState: bundle.initialState!,
    events: bundle.events,
  });
}

export function assertReplayBundle(bundle: ReplayBundle): void {
  if (bundle.version !== 1) {
    throw new Error(`Unsupported replay bundle version: ${bundle.version}`);
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
  if (!Array.isArray(bundle.events)) {
    throw new Error('Replay bundle events must be an array');
  }
  assertReplayInitialState(bundle.initialState, bundle.manifestSnapshot);
}

function assertReplayInitialState(initialState: MatchState, manifest: Manifest): void {
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
  for (const lane of initialState.lanes) {
    if (lane.location && !manifest.locations[lane.location.defId]) {
      throw new Error(`Replay initialState references missing location def "${lane.location.defId}" at lane ${lane.idx}`);
    }
  }
}

export function validateReplayBundle(
  bundle: ReplayBundle,
  manifest: Manifest,
): ReplayValidationResult {
  const errors: string[] = [];

  if (bundle.version !== 1) {
    errors.push(`Unsupported replay bundle version: ${bundle.version}`);
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
  if (!Array.isArray(bundle.events)) {
    errors.push('Replay bundle events must be an array');
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
      events: bundle.events,
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

import type { MatchEvent } from './types/events';
import type { Manifest } from './manifest/types';
import type { MatchState } from './types/state';
import { apply } from './apply';
import { createInitialMatchState } from './cli/initState';

export interface ReplayBundle {
  readonly version: 1;
  readonly manifestVersion: number;
  readonly protocolVersion: number;
  readonly seed: string;
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
  readonly events: readonly MatchEvent[];
}

export interface ReplayValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function replayMatch(opts: ReplayMatchOptions): ReplayResult {
  const initialState = createInitialMatchState(opts.seed, opts.manifest);
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
): ReplayBundle {
  return {
    version: 1,
    manifestVersion: manifest.version,
    protocolVersion: manifest.protocolVersion,
    seed: state.seed,
    events: state.log.map((entry) => entry.event as MatchEvent),
    metadata: extras,
  };
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

  if (errors.length === 0) {
    try {
      replayMatch({
        seed: bundle.seed,
        manifest,
        events: bundle.events,
      });
    } catch (err) {
      errors.push(
        `Replay execution failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

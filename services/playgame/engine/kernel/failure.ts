import type { KernelFailure } from './contracts';

/**
 * Runtime/session boundary error for an invariant failure inside the kernel.
 * It is intentionally distinct from player illegality and retains the typed
 * deterministic failure payload for diagnostics and retry handling.
 */
export class KernelInvariantError extends Error {
  readonly failure: KernelFailure;

  constructor(failure: KernelFailure) {
    super(failure.message);
    this.name = 'KernelInvariantError';
    this.failure = failure;
  }
}


import type { MatchClient } from '../client/matchClient';
import type { MatchBootstrap } from '../runtime/contracts';

export interface MatchAuthorityTestOptions {
  readonly developerAccess?: boolean;
}

/**
 * Test-only construction seam shared by every player-facing behavior suite.
 * A new authority implementation is not test-complete until it is registered
 * and passes the same contracts as every existing implementation.
 */
export interface MatchAuthorityTestDriver {
  readonly id: string;
  readonly boundary: 'IN_PROCESS' | 'SERIALIZED_LOOPBACK' | 'REMOTE';
  createClient(
    bootstrap: MatchBootstrap,
    options?: MatchAuthorityTestOptions,
  ): Promise<MatchClient>;
}

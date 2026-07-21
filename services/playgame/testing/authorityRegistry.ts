import { LocalMatchSessionAdapter } from '../runtime/localMatchSessionAdapter';
import { MatchSession } from '../runtime/matchSession';
import type { MatchAuthorityTestDriver } from './authorityTestDriver';
import { SerializedLoopbackMatchClient } from './serializedLoopbackMatchClient';

const localAuthority: MatchAuthorityTestDriver = Object.freeze({
  id: 'local-typescript',
  boundary: 'IN_PROCESS',
  createClient: async (bootstrap, options) => new LocalMatchSessionAdapter(
    MatchSession.fromBootstrap(bootstrap),
    { developerAccess: options?.developerAccess ?? false },
  ),
});

const serializedLoopbackAuthority: MatchAuthorityTestDriver = Object.freeze({
  id: 'serialized-loopback-typescript',
  boundary: 'SERIALIZED_LOOPBACK',
  createClient: async (bootstrap, options) => new SerializedLoopbackMatchClient(
    new LocalMatchSessionAdapter(
      MatchSession.fromBootstrap(bootstrap),
      { developerAccess: options?.developerAccess ?? false },
    ),
  ),
});

/**
 * The single authority-conformance registry. A future network TypeScript or
 * Rust authority must be added here; shared contracts automatically execute
 * against every entry.
 */
export const MATCH_AUTHORITY_TEST_DRIVERS: readonly MatchAuthorityTestDriver[] =
  Object.freeze([
    localAuthority,
    serializedLoopbackAuthority,
  ]);

import type { Owner } from './types/ids';

/**
 * One canonical encoding for owner-neutral and owner-scoped location counters.
 *
 * Callers must not construct scoped keys themselves. The location metadata
 * operation, reducer, transition semantics, and numeric projections all use
 * this function so reads and writes cannot drift.
 */
export function locationCounterKey(
  name: string,
  owner: Owner | null,
): string {
  return owner === null ? `neutral:${name}` : `owner:${owner}:${name}`;
}

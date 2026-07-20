import type { CardTag } from './types/state';

/** Exact runtime identity for tag payloads; removal remains kind-scoped. */
export function cardTagsEqual(left: CardTag, right: CardTag): boolean {
  if (left.kind !== right.kind) return false;
  if (
    left.kind === 'ONGOING_DISABLED'
    || left.kind === 'FROM_SPAWN'
  ) {
    return right.kind === left.kind && right.sourceId === left.sourceId;
  }
  return true;
}

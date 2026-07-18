import { afterEach, describe, expect, it } from 'vitest';
import type { CardId } from '../../engine/types/ids';
import { CanonicalVisibilityRegistry } from './canonicalVisibility';

afterEach(() => {
  document.body.replaceChildren();
});

describe('canonical card visibility leases', () => {
  it('restores the exact previous inline value and releases idempotently', () => {
    const registry = new CanonicalVisibilityRegistry();
    const element = document.createElement('div');
    element.style.visibility = 'collapse';
    document.body.append(element);

    const lease = registry.acquire('session-a', 'card-a' as CardId, element);
    expect(element.style.visibility).toBe('hidden');
    expect(registry.activeLeaseCount).toBe(1);

    lease.release();
    lease.release();
    expect(element.style.visibility).toBe('collapse');
    expect(registry.activeLeaseCount).toBe(0);
  });

  it('does not let a stale release overwrite a newer session', () => {
    const registry = new CanonicalVisibilityRegistry();
    const element = document.createElement('div');
    document.body.append(element);

    const oldLease = registry.acquire('session-old', 'card-a' as CardId, element);
    oldLease.release();
    const newLease = registry.acquire('session-new', 'card-a' as CardId, element);

    oldLease.release();
    expect(element.style.visibility).toBe('hidden');
    expect(element.dataset.cardMotionVisibilityOwner).toBe('session-new');

    newLease.release();
    expect(element.style.visibility).toBe('');
  });

  it('rejects overlapping structural owners for one card', () => {
    const registry = new CanonicalVisibilityRegistry();
    const first = document.createElement('div');
    const second = document.createElement('div');

    registry.acquire('session-a', 'card-a' as CardId, first);
    expect(() => registry.acquire('session-b', 'card-a' as CardId, second))
      .toThrow(/already owned/);
  });
});

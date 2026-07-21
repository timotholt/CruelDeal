import { describe, expect, it, vi } from 'vitest';

import { createCardVfxRegistry } from './registry';

const transient = (cardId: string) => ({
  cardId,
  eventType: 'CARD_POWER_CHANGED',
  channel: 'power-pulse' as const,
  effectKind: 'power-flash',
  className: 'power-flash',
  durationMs: 250,
});

describe('host-scoped card VFX registry', () => {
  it('isolates card layers and subscribers between host instances', () => {
    const first = createCardVfxRegistry();
    const second = createCardVfxRegistry();
    const firstChanged = vi.fn();
    const secondChanged = vi.fn();
    first.subscribe('shared-card', firstChanged);
    second.subscribe('shared-card', secondChanged);

    first.createTransient(transient('shared-card'));

    expect(first.getLayers('shared-card').transient).toHaveLength(1);
    expect(second.getLayers('shared-card').transient).toHaveLength(0);
    expect(firstChanged).toHaveBeenCalledTimes(1);
    expect(secondChanged).not.toHaveBeenCalled();

    second.reconcilePersistent('shared-card', [
      {
        id: 'status-1',
        sourceId: 'source-1',
        kind: 'glitch',
      },
    ]);

    expect(first.getLayers('shared-card').persistent).toHaveLength(0);
    expect(second.getLayers('shared-card').persistent).toHaveLength(1);
    expect(secondChanged).toHaveBeenCalledTimes(1);

    first.dispose();
    expect(second.getLayers('shared-card').persistent).toHaveLength(1);
    second.dispose();
  });

  it('rejects stale mutations after its owning host disposes it', () => {
    const registry = createCardVfxRegistry();
    const changed = vi.fn();
    registry.subscribe('card-1', changed);
    registry.dispose();

    expect(registry.createTransient(transient('card-1'))).toBeNull();
    registry.reconcilePersistent('card-1', [
      {
        id: 'status-1',
        sourceId: 'source-1',
        kind: 'glitch',
      },
    ]);

    expect(registry.getLayers('card-1')).toEqual({
      transient: [],
      persistent: [],
    });
    expect(changed).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { allocateBoundedSurfaceShell } from './surfaceShellAllocator';

describe('bounded surface shell allocator', () => {
  it('keeps the first exclusive paint on each host pseudo', () => {
    expect(allocateBoundedSurfaceShell([
      { layerId: 'border', preferredSlot: 'host::before' },
      { layerId: 'wear', preferredSlot: 'host::after' },
    ])).toEqual({
      ok: true,
      assignments: [
        { layerId: 'border', slot: 'host::before' },
        { layerId: 'wear', slot: 'host::after' },
      ],
      helpers: [],
    });
  });

  it('spills one collision into underlay and overlay without changing authored order', () => {
    expect(allocateBoundedSurfaceShell([
      { layerId: 'border', preferredSlot: 'host::before' },
      { layerId: 'fingerprint', preferredSlot: 'host::before' },
      { layerId: 'wear', preferredSlot: 'host::after' },
      { layerId: 'scan', preferredSlot: 'host::after' },
    ])).toEqual({
      ok: true,
      assignments: [
        { layerId: 'border', slot: 'host::before' },
        { layerId: 'fingerprint', slot: 'helper.underlay' },
        { layerId: 'wear', slot: 'host::after' },
        { layerId: 'scan', slot: 'helper.overlay' },
      ],
      helpers: ['helper.underlay', 'helper.overlay'],
    });
  });

  it('rejects a third exclusive operation instead of growing helper DOM', () => {
    const result = allocateBoundedSurfaceShell([
      { layerId: 'border', preferredSlot: 'host::before' },
      { layerId: 'fingerprint-primary', preferredSlot: 'host::before' },
      { layerId: 'fingerprint-secondary', preferredSlot: 'host::before' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({
        layerIds: ['border', 'fingerprint-primary', 'fingerprint-secondary'],
        preferredSlot: 'host::before',
        helperSlot: 'helper.underlay',
      }),
    ]);
  });
});

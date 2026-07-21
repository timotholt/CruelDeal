import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBoundedSurfaceEffect } from './boundedSurfaceEffect';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('mountBoundedSurfaceEffect', () => {
  it('terminates once on cancellation', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const terminal = vi.fn();
    const lease = mountBoundedSurfaceEffect(
      host,
      { kind: 'glitch', channel: 'above-chrome' },
      terminal,
    );

    lease.cancel();
    lease.cancel();

    expect(host.querySelector('[data-surface-vfx]')).toBeNull();
    expect(terminal).toHaveBeenCalledOnce();
  });

  it('has a bounded terminal condition when no animation event fires', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.append(host);
    const terminal = vi.fn();
    mountBoundedSurfaceEffect(host, { kind: 'reveal', channel: 'outside-surface' }, terminal);

    vi.advanceTimersByTime(1_500);

    expect(host.querySelector('[data-surface-vfx]')).toBeNull();
    expect(terminal).toHaveBeenCalledOnce();
  });
});

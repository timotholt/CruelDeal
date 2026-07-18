import { describe, expect, it } from 'vitest';
import { createPlayMotionSurface } from './playMotionSurface';

describe('PlayMotionSurface', () => {
  it('converts viewport geometry into the sole frame-relative coordinate system', () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    frame.getBoundingClientRect = () => new DOMRect(120, 40, 430, 764);

    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      zoneRefs: new Map(),
    });

    expect(surface.toLocalRect(new DOMRect(145, 100, 70, 98))).toEqual(
      new DOMRect(25, 60, 70, 98),
    );
  });

  it('owns temporary-node mounting and idempotent cleanup', () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      zoneRefs: new Map(),
    });
    const flyer = document.createElement('div');

    const cleanup = surface.mountTemporary(flyer);
    expect(flyer.parentElement).toBe(overlay);
    cleanup();
    cleanup();
    expect(flyer.isConnected).toBe(false);
  });
});

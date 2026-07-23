import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  disposeReflex,
  getReflexFpsCap,
  initReflex,
  setReflexFpsCap,
} from './reflexController';

describe('reflex controller budget', () => {
  afterEach(() => {
    disposeReflex();
    setReflexFpsCap(30);
    vi.unstubAllGlobals();
  });

  it('defaults to the phone-oriented 30 FPS cap', () => {
    expect(getReflexFpsCap()).toBe(30);
  });

  it('allows an explicit lower-power or high-refresh cap', () => {
    setReflexFpsCap(15);
    expect(getReflexFpsCap()).toBe(15);
    setReflexFpsCap(60);
    expect(getReflexFpsCap()).toBe(60);
  });

  it('publishes pointer motion only to reflective surfaces, not the document root', () => {
    const reflectiveSurface = document.createElement('span');
    reflectiveSurface.className = 'sheen-linear';
    const ordinarySurface = document.createElement('div');
    ordinarySurface.className = 'app-viewport text-white';
    document.body.append(reflectiveSurface, ordinarySurface);
    const rootXBefore = document.documentElement.style.getPropertyValue('--reflex-gx');
    const rootYBefore = document.documentElement.style.getPropertyValue('--reflex-gy');
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(1_000);
      return 1;
    });

    initReflex();
    window.dispatchEvent(new MouseEvent('pointermove', {
      clientX: 1,
      clientY: 1,
    }));

    expect(document.documentElement.style.getPropertyValue('--reflex-gx')).toBe(rootXBefore);
    expect(document.documentElement.style.getPropertyValue('--reflex-gy')).toBe(rootYBefore);

    expect(document.getElementById('reflex-runtime-direction')).toBeNull();
    expect(reflectiveSurface.style.getPropertyValue('--reflex-gx')).not.toBe('0');
    expect(reflectiveSurface.style.getPropertyValue('--reflex-gy')).not.toBe('0');
    expect(ordinarySurface.getAttribute('style')).toBeNull();
  });
});

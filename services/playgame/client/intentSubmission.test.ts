import { afterEach, describe, expect, it, vi } from 'vitest';

import { continueAfterIntentPendingPaint } from './intentSubmission';

describe('continueAfterIntentPendingPaint', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not resume authority work until after a frame and follow-up task', async () => {
    vi.useFakeTimers();
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1;
    }));
    let resumed = false;
    const pending = continueAfterIntentPendingPaint().then(() => {
      resumed = true;
    });

    expect(resumed).toBe(false);
    expect(frameCallback).not.toBeNull();

    frameCallback!(0);
    await Promise.resolve();
    expect(resumed).toBe(false);

    await vi.runOnlyPendingTimersAsync();
    await pending;
    expect(resumed).toBe(true);
  });
});

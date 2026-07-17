import { afterEach, describe, expect, it } from 'vitest';
import {
  getReflexFpsCap,
  setReflexFpsCap,
} from './reflexController';

describe('reflex controller budget', () => {
  afterEach(() => {
    setReflexFpsCap(30);
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
});

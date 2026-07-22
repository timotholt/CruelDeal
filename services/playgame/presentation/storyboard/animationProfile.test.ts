import { describe, expect, it } from 'vitest';
import {
  DEBUG_SLOW_ANIMATION_PROFILE,
  NORMAL_ANIMATION_PROFILE,
  PRESENTATION_ANIMATION_PROFILES,
  REDUCED_MOTION_ANIMATION_PROFILE,
  validateAnimationProfile,
} from './animationProfile';

describe('presentation animation profiles', () => {
  it('provides one immutable normal, reduced-motion, and debug-slow policy', () => {
    expect(Object.keys(PRESENTATION_ANIMATION_PROFILES).sort()).toEqual([
      'debug-slow', 'normal', 'reduced-motion',
    ]);
    expect(NORMAL_ANIMATION_PROFILE).toMatchObject({ playbackRate: 1, durationScale: 1 });
    expect(REDUCED_MOTION_ANIMATION_PROFILE.decorativeEffects).toBe('reduced');
    expect(DEBUG_SLOW_ANIMATION_PROFILE).toMatchObject({
      durationScale: 1,
      playbackRate: 0.25,
    });
    for (const profile of Object.values(PRESENTATION_ANIMATION_PROFILES)) {
      expect(() => validateAnimationProfile(profile)).not.toThrow();
      expect(Object.isFrozen(profile)).toBe(true);
    }
  });

  it('rejects invalid scales and playback rates', () => {
    expect(() => validateAnimationProfile({
      ...NORMAL_ANIMATION_PROFILE,
      durationScale: 0,
    })).toThrow(/duration scale/u);
    expect(() => validateAnimationProfile({
      ...NORMAL_ANIMATION_PROFILE,
      playbackRate: Infinity,
    })).toThrow(/playback rate/u);
  });
});

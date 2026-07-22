import { milliseconds, type PresentationAnimationProfile } from './contracts';

export const NORMAL_ANIMATION_PROFILE: PresentationAnimationProfile = Object.freeze({
  id: 'normal',
  durationScale: 1,
  structuralMinimumMs: milliseconds(1),
  decorativeEffects: 'full',
  playbackRate: 1,
  cueLatenessToleranceMs: milliseconds(100),
});

export const REDUCED_MOTION_ANIMATION_PROFILE: PresentationAnimationProfile = Object.freeze({
  id: 'reduced-motion',
  durationScale: 0.5,
  structuralMinimumMs: milliseconds(80),
  decorativeEffects: 'reduced',
  playbackRate: 1,
  cueLatenessToleranceMs: milliseconds(100),
});

export const DEBUG_SLOW_ANIMATION_PROFILE: PresentationAnimationProfile = Object.freeze({
  id: 'debug-slow',
  durationScale: 1,
  structuralMinimumMs: milliseconds(1),
  decorativeEffects: 'full',
  playbackRate: 0.25,
  cueLatenessToleranceMs: milliseconds(250),
});

export const PRESENTATION_ANIMATION_PROFILES = Object.freeze({
  normal: NORMAL_ANIMATION_PROFILE,
  'reduced-motion': REDUCED_MOTION_ANIMATION_PROFILE,
  'debug-slow': DEBUG_SLOW_ANIMATION_PROFILE,
} satisfies Readonly<Record<PresentationAnimationProfile['id'], PresentationAnimationProfile>>);

export function validateAnimationProfile(profile: PresentationAnimationProfile): void {
  if (!Number.isFinite(profile.durationScale) || profile.durationScale <= 0) {
    throw new Error(`Invalid duration scale for profile ${profile.id}`);
  }
  if (!Number.isFinite(profile.playbackRate) || profile.playbackRate <= 0) {
    throw new Error(`Invalid playback rate for profile ${profile.id}`);
  }
  milliseconds(profile.structuralMinimumMs);
  milliseconds(profile.cueLatenessToleranceMs);
}

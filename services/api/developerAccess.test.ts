import { afterEach, describe, expect, it, vi } from 'vitest';
import { getIdentityClaims } from './developerAccess';
import { persistUserProfile } from './mockDb';
import { profileService } from './profileService';

afterEach(() => {
  vi.useRealTimers();
});

describe('developer access claims', () => {
  it('authorizes only the fake-database developer account', () => {
    expect(getIdentityClaims('u1')).toEqual({
      email: 'timotholt@gmail.com',
      isDeveloper: true,
    });
    expect(getIdentityClaims('unknown-player')).toEqual({
      email: '',
      isDeveloper: false,
    });
  });

  it('overwrites browser-persisted privilege fields with server claims', async () => {
    persistUserProfile({
      id: 'u1',
      email: 'forged@example.com',
      isDeveloper: false,
    });
    vi.useFakeTimers();

    const profilePromise = profileService.getProfile('u1');
    await vi.runAllTimersAsync();
    const profile = await profilePromise;

    expect(profile.email).toBe('timotholt@gmail.com');
    expect(profile.isDeveloper).toBe(true);
  });

  it('does not let an unknown account persist itself as a developer', async () => {
    persistUserProfile({
      id: 'unknown-player',
      email: 'timotholt@gmail.com',
      isDeveloper: true,
    });
    vi.useFakeTimers();

    const profilePromise = profileService.getProfile('unknown-player');
    await vi.runAllTimersAsync();
    const profile = await profilePromise;

    expect(profile.email).toBe('');
    expect(profile.isDeveloper).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { NORMAL_ANIMATION_PROFILE } from './animationProfile';
import { compileStoryboard } from './compiler';
import { milliseconds, type StoryboardCue } from './contracts';
import { StoryboardRunner } from './runner';
import { FOUNDATION_TEST_BUDGET, step, storyboard } from './__tests__/fixtures';
import { FakeWaapiDriver } from './waapiDriver';

describe('master-clock storyboard runner', () => {
  it('starts every track at one origin and waits for master plus all tracks', async () => {
    const driver = new FakeWaapiDriver();
    const cleanup = vi.fn();
    const handoff = vi.fn();
    const runner = new StoryboardRunner(driver, { dispatch: () => undefined });
    const resultPromise = runner.run(twoTrackTimeline(), NORMAL_ANIMATION_PROFILE, {
      cleanup,
      handoff,
    });
    await Promise.resolve();
    const handles = [...driver.clocks, ...driver.animations];
    expect(new Set(handles.map(handle => handle.startOriginMs))).toEqual(new Set([1000]));

    driver.clocks[0]?.seek(100);
    driver.animations[0]?.seek(100);
    let settled = false;
    void resultPromise.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    driver.animations[1]?.seek(100);
    const result = await resultPromise;
    expect(result.outcome).toBe('COMPLETED');
    expect(handoff).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('dispatches crossed cues exactly once in stable order after a large jump', async () => {
    const driver = new FakeWaapiDriver();
    const seen: string[] = [];
    const runner = new StoryboardRunner(driver, {
      dispatch: cue => { seen.push(cue.id); },
    });
    const promise = runner.run(twoTrackTimeline(), NORMAL_ANIMATION_PROFILE);
    driver.advanceTo(100, 'COARSE');
    const result = await promise;
    driver.advanceTo(100);
    expect(seen).toEqual(['zero', 'first', 'second']);
    expect(result.cueRecords.map(record => record.cueId)).toEqual(seen);
    expect(result.cueRecords[1]).toMatchObject({
      dispatchedAtMasterTimeMs: 100,
      latenessMs: 75,
      wakeupKind: 'COARSE',
    });
  });

  it('pauses once and resumes every track from one new origin', async () => {
    const driver = new FakeWaapiDriver();
    const runner = new StoryboardRunner(driver, { dispatch: () => undefined });
    const promise = runner.run(twoTrackTimeline(), NORMAL_ANIMATION_PROFILE);
    driver.advanceTo(40);
    runner.pause();
    expect([...driver.clocks, ...driver.animations].every(handle => handle.state === 'PAUSED'))
      .toBe(true);
    runner.resume();
    expect(new Set([...driver.clocks, ...driver.animations].map(handle => handle.startOriginMs)))
      .toEqual(new Set([2000]));
    expect([...driver.clocks, ...driver.animations].every(handle => handle.currentTimeMs === 40))
      .toBe(true);
    driver.advanceTo(100);
    await expect(promise).resolves.toMatchObject({ outcome: 'COMPLETED' });
  });

  it('uses playback rate without changing authored offsets', async () => {
    const driver = new FakeWaapiDriver();
    const timeline = twoTrackTimeline();
    const runner = new StoryboardRunner(driver, { dispatch: () => undefined });
    const promise = runner.run(timeline, {
      ...NORMAL_ANIMATION_PROFILE,
      id: 'debug-slow',
      playbackRate: 0.25,
    });
    expect([...driver.clocks, ...driver.animations].every(handle => handle.playbackRate === 0.25))
      .toBe(true);
    expect(timeline.tracks.flatMap(track => track.keyframes.map(frame => frame.offset)))
      .toEqual(twoTrackTimeline().tracks.flatMap(track => track.keyframes.map(frame => frame.offset)));
    driver.advanceTo(100);
    await promise;
  });

  it('suppresses future cues and cleans up once when cancelled', async () => {
    const driver = new FakeWaapiDriver();
    const seen: string[] = [];
    const cleanup = vi.fn();
    const runner = new StoryboardRunner(driver, {
      dispatch: cue => { seen.push(cue.id); },
    });
    const promise = runner.run(twoTrackTimeline(), NORMAL_ANIMATION_PROFILE, { cleanup });
    driver.advanceTo(25);
    runner.cancel();
    const result = await promise;
    driver.advanceTo(100);
    expect(result.outcome).toBe('CANCELLED');
    expect(seen).toEqual(['zero', 'first']);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('turns track and cue failures into typed runner failures', async () => {
    const trackDriver = new FakeWaapiDriver();
    const trackRunner = new StoryboardRunner(trackDriver, { dispatch: () => undefined });
    const trackPromise = trackRunner.run(twoTrackTimeline(), NORMAL_ANIMATION_PROFILE);
    trackDriver.rejectTrack('alpha:opacity', new Error('track broke'));
    await expect(trackPromise).resolves.toMatchObject({
      outcome: 'FAILED',
      failure: { name: 'StoryboardRunnerFailure' },
    });

    const cueDriver = new FakeWaapiDriver();
    const cueRunner = new StoryboardRunner(cueDriver, {
      dispatch: cue => {
        if (cue.id === 'first') throw new Error('cue broke');
      },
    });
    const cuePromise = cueRunner.run(twoTrackTimeline(), NORMAL_ANIMATION_PROFILE);
    cueDriver.advanceTo(25);
    await expect(cuePromise).resolves.toMatchObject({
      outcome: 'FAILED',
      failure: { cause: { message: 'cue broke' } },
    });
  });

  it('completes a zero-duration cue-only timeline without a wall clock wait', async () => {
    const driver = new FakeWaapiDriver();
    const seen: string[] = [];
    const runner = new StoryboardRunner(driver, {
      dispatch: cue => { seen.push(cue.id); },
    });
    const timeline = compileStoryboard(storyboard([step('instant', 0, 0, {
      tracks: [],
      cues: [{ id: 'instant-cue', kind: 'DIAGNOSTIC', atMs: milliseconds(0), label: 'instant' }],
    })]), FOUNDATION_TEST_BUDGET);
    await expect(runner.run(timeline, NORMAL_ANIMATION_PROFILE)).resolves.toMatchObject({
      outcome: 'COMPLETED',
    });
    expect(seen).toEqual(['instant-cue']);
  });
});

function twoTrackTimeline() {
  const cues: StoryboardCue[] = [
    { id: 'zero', kind: 'DIAGNOSTIC', atMs: milliseconds(0), label: 'zero' },
    { id: 'first', kind: 'DIAGNOSTIC', atMs: milliseconds(25), label: 'first' },
    { id: 'second', kind: 'DIAGNOSTIC', atMs: milliseconds(50), label: 'second' },
  ];
  return compileStoryboard(storyboard([step('motion', 100, 100, {
    cues,
    tracks: [
      {
        kind: 'ELEMENT', id: 'alpha', target: { kind: 'PLAYFIELD' },
        channel: 'opacity', keyframes: [
          { atMs: milliseconds(0), styles: { opacity: 0 } },
          { atMs: milliseconds(100), styles: { opacity: 1 } },
        ],
      },
      {
        kind: 'ELEMENT', id: 'banner', target: { kind: 'TURN_BANNER' },
        channel: 'banner-pose', keyframes: [
          { atMs: milliseconds(0), styles: { transform: 'translateY(-10px)' } },
          { atMs: milliseconds(100), styles: { transform: 'translateY(0px)' } },
        ],
      },
    ],
  })]), FOUNDATION_TEST_BUDGET);
}

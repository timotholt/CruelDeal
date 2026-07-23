import {
  milliseconds,
  type CompiledTimeline,
  type PresentationAnimationProfile,
  type PresentationOutcome,
} from './contracts';
import { CueScheduler, type CueDispatchRecord, type StoryboardCuePort } from './cueScheduler';
import type {
  AnimationTimelineDriver,
  SuspendedTimeline,
  TimelineAnimation,
  TimelineClock,
} from './waapiDriver';

export class StoryboardRunnerFailure extends Error {
  readonly cause: unknown;

  constructor(storyboardId: string, cause: unknown) {
    super(`Storyboard ${storyboardId} failed`);
    this.name = 'StoryboardRunnerFailure';
    this.cause = cause;
  }
}

export interface StoryboardRunResult {
  readonly outcome: PresentationOutcome;
  readonly cueRecords: readonly CueDispatchRecord[];
  readonly failure: StoryboardRunnerFailure | null;
}

export interface StoryboardRunLifecycle {
  readonly handoff?: () => void;
  readonly cleanup?: () => void;
}

interface ActiveRun {
  readonly timeline: CompiledTimeline;
  readonly clock: TimelineClock;
  readonly animations: readonly TimelineAnimation[];
  readonly scheduler: CueScheduler;
  cancelled: boolean;
  suspended: SuspendedTimeline | null;
}

export class StoryboardRunner {
  readonly #driver: AnimationTimelineDriver;
  readonly #cuePort: StoryboardCuePort;
  #active: ActiveRun | null = null;

  constructor(driver: AnimationTimelineDriver, cuePort: StoryboardCuePort) {
    this.#driver = driver;
    this.#cuePort = cuePort;
  }

  get isRunning(): boolean { return this.#active !== null; }
  get currentTimeMs(): number { return this.#active?.clock.currentTimeMs ?? 0; }

  async run(
    timeline: CompiledTimeline,
    profile: PresentationAnimationProfile,
    lifecycle: StoryboardRunLifecycle = {},
  ): Promise<StoryboardRunResult> {
    if (this.#active) throw new Error('Storyboard runner already owns a timeline');
    const animations = timeline.tracks.map(track => this.#driver.compileTrack(track));
    const clock = this.#driver.createClock(timeline.totalDurationMs);
    let cueFailure: unknown = null;
    clock.setPlaybackRate(profile.playbackRate);
    for (const animation of animations) animation.setPlaybackRate(profile.playbackRate);
    const scheduler = new CueScheduler({
      storyboardId: timeline.storyboardId,
      clock,
      driver: this.#driver,
      cues: timeline.cues,
      port: this.#cuePort,
      toleranceMs: profile.cueLatenessToleranceMs,
      onFailure: cause => {
        cueFailure = cause;
        for (const animation of animations) animation.cancel();
        clock.cancel();
      },
    });
    const active: ActiveRun = {
      timeline,
      clock,
      animations,
      scheduler,
      cancelled: false,
      suspended: null,
    };
    this.#active = active;
    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      scheduler.stop(active.cancelled);
      lifecycle.cleanup?.();
      if (this.#active === active) this.#active = null;
    };

    try {
      const preparation = this.#driver.prepareTogether(clock, animations);
      if (preparation !== undefined) await preparation;
      if (active.cancelled) {
        cleanup();
        return { outcome: 'CANCELLED', cueRecords: scheduler.records, failure: null };
      }
      scheduler.start();
      this.#driver.startTogether(clock, animations);
      await Promise.all([clock.finished, ...animations.map(animation => animation.finished)]);
      if (active.cancelled) {
        cleanup();
        return { outcome: 'CANCELLED', cueRecords: scheduler.records, failure: null };
      }
      scheduler.drainFinal(timeline.totalDurationMs);
      lifecycle.handoff?.();
      for (const animation of animations) animation.cancel();
      clock.cancel();
      cleanup();
      return { outcome: 'COMPLETED', cueRecords: scheduler.records, failure: null };
    } catch (cause) {
      if (active.cancelled || (isCancellation(cause) && cueFailure === null)) {
        cleanup();
        return { outcome: 'CANCELLED', cueRecords: scheduler.records, failure: null };
      }
      active.cancelled = true;
      scheduler.stop(true);
      for (const animation of animations) animation.cancel();
      clock.cancel();
      const failure = new StoryboardRunnerFailure(
        timeline.storyboardId,
        cueFailure ?? cause,
      );
      cleanup();
      return { outcome: 'FAILED', cueRecords: scheduler.records, failure };
    }
  }

  pause(): void {
    const active = this.#active;
    if (!active || active.suspended) return;
    active.scheduler.pause();
    active.suspended = this.#driver.pauseTogether(active.clock, active.animations);
  }

  resume(): void {
    const active = this.#active;
    if (!active?.suspended) return;
    this.#driver.resumeTogether(
      active.suspended,
      active.clock,
      active.animations,
    );
    active.suspended = null;
    active.scheduler.resume();
  }

  cancel(): void {
    const active = this.#active;
    if (!active || active.cancelled) return;
    active.cancelled = true;
    active.scheduler.stop(true);
    for (const animation of active.animations) animation.cancel();
    active.clock.cancel();
  }
}

function isCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export const ZERO_RUNNER_TIME_MS = milliseconds(0);

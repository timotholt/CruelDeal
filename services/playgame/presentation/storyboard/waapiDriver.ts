import type { CompiledVisualTrack, Milliseconds } from './contracts';

export type TimelineWakeupKind = 'ANIMATION_FRAME' | 'COARSE';

export interface TimelineAnimation {
  readonly id: string;
  readonly finished: Promise<void>;
  readonly currentTimeMs: number;
  readonly startOriginMs: number | null;
  play(): void;
  pause(): void;
  cancel(): void;
  setPlaybackRate(rate: number): void;
}

export interface TimelineClock extends TimelineAnimation {}

export interface SuspendedTimeline {
  readonly masterCurrentTimeMs: Milliseconds;
}

export interface AnimationTimelineDriver {
  compileTrack(track: CompiledVisualTrack): TimelineAnimation;
  createClock(durationMs: Milliseconds): TimelineClock;
  startTogether(clock: TimelineClock, animations: readonly TimelineAnimation[]): void;
  pauseTogether(
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): SuspendedTimeline;
  resumeTogether(
    suspended: SuspendedTimeline,
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): void;
  subscribeWakeups(onWakeup: (kind: TimelineWakeupKind) => void): () => void;
}

interface NativeTimelineHandle extends TimelineAnimation {
  readonly native: Animation;
}

export type NativeTargetResolver = (targetKey: string) => Element;

export type TimelineDriverFactory = (
  targets: ReadonlyMap<string, Element>,
) => AnimationTimelineDriver;

export const createNativeTimelineDriverFactory = (
  document: Document,
  view: Window,
): TimelineDriverFactory => targets => new NativeWaapiDriver(document, targetKey => {
  const target = targets.get(targetKey);
  if (!target) throw new Error(`Compiled timeline target ${targetKey} is unavailable`);
  return target;
}, view);

export class NativeWaapiDriver implements AnimationTimelineDriver {
  readonly #document: Document;
  readonly #resolveTarget: NativeTargetResolver;
  readonly #view: Window;
  #lastStartOrigins: readonly number[] = [];

  constructor(document: Document, resolveTarget: NativeTargetResolver, view: Window) {
    if (document.defaultView !== view) {
      throw new Error('Native WAAPI driver requires a live document/window pair');
    }
    this.#document = document;
    this.#resolveTarget = resolveTarget;
    this.#view = view;
  }

  get lastStartOrigins(): readonly number[] { return this.#lastStartOrigins; }

  compileTrack(track: CompiledVisualTrack): TimelineAnimation {
    const target = this.#resolveTarget(track.targetKey);
    const keyframes: Keyframe[] = track.keyframes.map(keyframe => ({
      [track.property]: keyframe.value,
      offset: keyframe.offset,
      ...(keyframe.easing === undefined ? {} : { easing: keyframe.easing }),
    }));
    const effect = new KeyframeEffect(target, keyframes, {
      duration: track.totalDurationMs,
      fill: 'both',
    });
    return nativeHandle(track.id, new Animation(effect, this.#document.timeline));
  }

  createClock(durationMs: Milliseconds): TimelineClock {
    const effect = new KeyframeEffect(null, null, { duration: durationMs });
    return nativeHandle('__master_clock__', new Animation(effect, this.#document.timeline));
  }

  startTogether(clock: TimelineClock, animations: readonly TimelineAnimation[]): void {
    const handles = [clock, ...animations].map(asNativeHandle);
    const origin = Number(this.#document.timeline.currentTime ?? 0);
    for (const handle of handles) handle.native.play();
    for (const handle of handles) handle.native.startTime = origin;
    this.#lastStartOrigins = handles.map(handle => Number(handle.native.startTime));
  }

  pauseTogether(
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): SuspendedTimeline {
    const masterCurrentTimeMs = Math.max(0, Math.round(clock.currentTimeMs)) as Milliseconds;
    for (const handle of [clock, ...animations]) handle.pause();
    return { masterCurrentTimeMs };
  }

  resumeTogether(
    suspended: SuspendedTimeline,
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): void {
    const handles = [clock, ...animations].map(asNativeHandle);
    const now = Number(this.#document.timeline.currentTime ?? 0);
    for (const handle of handles) {
      handle.native.currentTime = suspended.masterCurrentTimeMs;
      handle.native.play();
    }
    for (const handle of handles) {
      const rate = handle.native.playbackRate || 1;
      handle.native.startTime = now - suspended.masterCurrentTimeMs / rate;
    }
  }

  subscribeWakeups(onWakeup: (kind: TimelineWakeupKind) => void): () => void {
    let active = true;
    let frame = 0;
    const tick = (): void => {
      if (!active) return;
      onWakeup('ANIMATION_FRAME');
      frame = this.#view.requestAnimationFrame(tick);
    };
    frame = this.#view.requestAnimationFrame(tick);
    const coarse = this.#view.setInterval(() => onWakeup('COARSE'), 100);
    return () => {
      active = false;
      this.#view.cancelAnimationFrame(frame);
      this.#view.clearInterval(coarse);
    };
  }
}

function nativeHandle(id: string, native: Animation): NativeTimelineHandle {
  return {
    id,
    native,
    get finished() {
      return native.finished.then(() => undefined);
    },
    get currentTimeMs() {
      return typeof native.currentTime === 'number' ? native.currentTime : 0;
    },
    get startOriginMs() {
      return typeof native.startTime === 'number' ? native.startTime : null;
    },
    play: () => native.play(),
    pause: () => native.pause(),
    cancel: () => native.cancel(),
    setPlaybackRate: rate => { native.playbackRate = rate; },
  };
}

function asNativeHandle(animation: TimelineAnimation): NativeTimelineHandle {
  if (!('native' in animation)) throw new Error('Mixed timeline-driver handles');
  return animation as NativeTimelineHandle;
}

export class FakeWaapiDriver implements AnimationTimelineDriver {
  readonly compiledTracks: CompiledVisualTrack[] = [];
  readonly animations: FakeTimelineHandle[] = [];
  readonly clocks: FakeTimelineHandle[] = [];
  readonly startOrigins: number[] = [];
  #wakeups = new Set<(kind: TimelineWakeupKind) => void>();
  #origin = 1000;

  compileTrack(track: CompiledVisualTrack): TimelineAnimation {
    this.compiledTracks.push(track);
    const handle = new FakeTimelineHandle(track.id, track.totalDurationMs);
    this.animations.push(handle);
    return handle;
  }

  createClock(durationMs: Milliseconds): TimelineClock {
    const handle = new FakeTimelineHandle('__master_clock__', durationMs);
    this.clocks.push(handle);
    return handle;
  }

  startTogether(clock: TimelineClock, animations: readonly TimelineAnimation[]): void {
    const origin = this.#origin;
    this.#origin += 1000;
    this.startOrigins.push(origin);
    for (const handle of [clock, ...animations]) {
      const fake = asFakeHandle(handle);
      fake.startAt(origin);
      fake.play();
    }
  }

  pauseTogether(
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): SuspendedTimeline {
    const current = Math.max(0, Math.round(clock.currentTimeMs)) as Milliseconds;
    for (const handle of [clock, ...animations]) handle.pause();
    return { masterCurrentTimeMs: current };
  }

  resumeTogether(
    suspended: SuspendedTimeline,
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): void {
    const origin = this.#origin;
    this.#origin += 1000;
    this.startOrigins.push(origin);
    for (const handle of [clock, ...animations]) {
      const fake = asFakeHandle(handle);
      fake.seek(suspended.masterCurrentTimeMs);
      fake.startAt(origin);
      fake.play();
    }
  }

  subscribeWakeups(onWakeup: (kind: TimelineWakeupKind) => void): () => void {
    this.#wakeups.add(onWakeup);
    return () => this.#wakeups.delete(onWakeup);
  }

  advanceTo(timeMs: number, kind: TimelineWakeupKind = 'ANIMATION_FRAME'): void {
    for (const handle of [...this.clocks, ...this.animations]) handle.seek(timeMs);
    for (const wakeup of this.#wakeups) wakeup(kind);
  }

  rejectTrack(id: string, error: Error): void {
    const track = this.animations.find(candidate => candidate.id === id);
    if (!track) throw new Error(`Unknown fake track ${id}`);
    track.reject(error);
  }
}

export class FakeTimelineHandle implements TimelineClock {
  readonly id: string;
  readonly durationMs: number;
  #currentTimeMs = 0;
  #startOriginMs: number | null = null;
  #playbackRate = 1;
  #state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'CANCELLED' = 'IDLE';
  #resolve!: () => void;
  #reject!: (error: unknown) => void;
  readonly finished: Promise<void>;

  constructor(id: string, durationMs: number) {
    this.id = id;
    this.durationMs = durationMs;
    this.finished = new Promise<void>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  get currentTimeMs(): number { return this.#currentTimeMs; }
  get startOriginMs(): number | null { return this.#startOriginMs; }
  get playbackRate(): number { return this.#playbackRate; }
  get state(): string { return this.#state; }

  play(): void {
    if (this.#state === 'CANCELLED') return;
    this.#state = 'RUNNING';
    if (this.durationMs === 0) this.seek(0);
  }

  pause(): void {
    if (this.#state === 'RUNNING') this.#state = 'PAUSED';
  }

  cancel(): void {
    if (this.#state === 'FINISHED' || this.#state === 'CANCELLED') return;
    this.#state = 'CANCELLED';
    this.#reject(new DOMException('Animation cancelled', 'AbortError'));
  }

  setPlaybackRate(rate: number): void { this.#playbackRate = rate; }
  startAt(originMs: number): void { this.#startOriginMs = originMs; }

  seek(timeMs: number): void {
    if (this.#state === 'CANCELLED' || this.#state === 'FINISHED') return;
    this.#currentTimeMs = Math.max(0, Math.min(timeMs, this.durationMs));
    if (this.#currentTimeMs >= this.durationMs) {
      this.#state = 'FINISHED';
      this.#resolve();
    }
  }

  reject(error: Error): void {
    if (this.#state === 'FINISHED' || this.#state === 'CANCELLED') return;
    this.#state = 'CANCELLED';
    this.#reject(error);
  }
}

function asFakeHandle(animation: TimelineAnimation): FakeTimelineHandle {
  if (!(animation instanceof FakeTimelineHandle)) {
    throw new Error('Mixed timeline-driver handles');
  }
  return animation;
}

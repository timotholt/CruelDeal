import {
  milliseconds,
  type CompiledStoryboardCue,
  type Milliseconds,
  type StoryboardCue,
} from './contracts';
import type {
  AnimationTimelineDriver,
  TimelineClock,
  TimelineWakeupKind,
} from './waapiDriver';

export interface CueDispatchMetadata {
  readonly storyboardId: string;
  readonly dispatchedAtMasterTimeMs: Milliseconds;
  readonly latenessMs: Milliseconds;
  readonly wakeupKind: TimelineWakeupKind | 'INITIAL' | 'FINAL';
}

export interface StoryboardCuePort {
  dispatch(cue: StoryboardCue, metadata: CueDispatchMetadata): void;
}

export interface CueDispatchRecord extends CueDispatchMetadata {
  readonly cueId: string;
  readonly cueKind: StoryboardCue['kind'];
  readonly scheduledAtMs: Milliseconds;
  readonly exceededTolerance: boolean;
}

export class CueScheduler {
  readonly #storyboardId: string;
  readonly #clock: TimelineClock;
  readonly #driver: AnimationTimelineDriver;
  readonly #cues: readonly CompiledStoryboardCue[];
  readonly #port: StoryboardCuePort;
  readonly #toleranceMs: Milliseconds;
  readonly #onFailure: (cause: unknown) => void;
  readonly #dispatched = new Set<string>();
  readonly #records: CueDispatchRecord[] = [];
  #unsubscribe: (() => void) | null = null;
  #cancelled = false;

  constructor(options: {
    readonly storyboardId: string;
    readonly clock: TimelineClock;
    readonly driver: AnimationTimelineDriver;
    readonly cues: readonly CompiledStoryboardCue[];
    readonly port: StoryboardCuePort;
    readonly toleranceMs: Milliseconds;
    readonly onFailure?: (cause: unknown) => void;
  }) {
    this.#storyboardId = options.storyboardId;
    this.#clock = options.clock;
    this.#driver = options.driver;
    this.#cues = options.cues;
    this.#port = options.port;
    this.#toleranceMs = options.toleranceMs;
    this.#onFailure = options.onFailure ?? (() => undefined);
  }

  get records(): readonly CueDispatchRecord[] { return this.#records; }

  start(): void {
    if (this.#unsubscribe) throw new Error('Cue scheduler already started');
    this.drainAt(milliseconds(0), 'INITIAL');
    this.#unsubscribe = this.#driver.subscribeWakeups(kind => {
      this.drainAt(toMasterMilliseconds(this.#clock.currentTimeMs), kind);
    });
  }

  drainFinal(totalDurationMs: Milliseconds): void {
    this.drainAt(totalDurationMs, 'FINAL');
  }

  pause(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  resume(): void {
    if (this.#cancelled || this.#unsubscribe) return;
    this.#unsubscribe = this.#driver.subscribeWakeups(kind => {
      this.drainAt(toMasterMilliseconds(this.#clock.currentTimeMs), kind);
    });
  }

  stop(cancelled = false): void {
    if (cancelled) this.#cancelled = true;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  private drainAt(
    currentTimeMs: Milliseconds,
    wakeupKind: CueDispatchMetadata['wakeupKind'],
  ): void {
    if (this.#cancelled) return;
    for (const compiled of this.#cues) {
      if (compiled.absoluteTimeMs > currentTimeMs) break;
      if (this.#dispatched.has(compiled.cue.id)) continue;
      this.#dispatched.add(compiled.cue.id);
      const latenessMs = milliseconds(currentTimeMs - compiled.absoluteTimeMs);
      const metadata: CueDispatchMetadata = {
        storyboardId: this.#storyboardId,
        dispatchedAtMasterTimeMs: currentTimeMs,
        latenessMs,
        wakeupKind,
      };
      this.#records.push({
        ...metadata,
        cueId: compiled.cue.id,
        cueKind: compiled.cue.kind,
        scheduledAtMs: compiled.absoluteTimeMs,
        exceededTolerance: latenessMs > this.#toleranceMs,
      });
      try {
        const result: unknown = this.#port.dispatch(compiled.cue, metadata);
        if (isPromiseLike(result)) {
          throw new Error(`Cue ${compiled.cue.id} returned a promise`);
        }
      } catch (cause) {
        this.stop(true);
        this.#onFailure(cause);
        return;
      }
    }
  }
}

function toMasterMilliseconds(value: number): Milliseconds {
  if (!Number.isFinite(value)) throw new Error('Master clock returned non-finite time');
  return milliseconds(Math.max(0, Math.round(value)));
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value;
}

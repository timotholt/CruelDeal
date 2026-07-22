import type { TimelineDriverFactory } from './waapiDriver';
import {
  FakeTimelineHandle,
  FakeWaapiDriver,
  type TimelineAnimation,
  type TimelineClock,
} from './waapiDriver';

/**
 * Deterministic test clock for presentation integration tests. Production
 * always supplies the native browser timeline; tests opt into this clock
 * explicitly so missing browser animation globals cannot silently change the
 * runtime mechanism under test.
 */
export class AutoAdvancingFakeWaapiDriver extends FakeWaapiDriver {
  override startTogether(
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): void {
    super.startTogether(clock, animations);
    const fakeClock = clock as FakeTimelineHandle;
    setTimeout(() => this.advanceTo(fakeClock.durationMs), fakeClock.durationMs);
  }
}

export const createAutoAdvancingTestTimelineDriverFactory = (): TimelineDriverFactory => (
  () => new AutoAdvancingFakeWaapiDriver()
);

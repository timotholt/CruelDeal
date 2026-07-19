import { describe, expect, it } from 'vitest';

import {
  REVEAL_CINEMATIC_TOTAL_MS,
  REVEAL_CINEMATIC_TIMING,
} from './timing';

describe('play presentation timing policy', () => {
  it('reports the configured reveal time including motion completion guards', () => {
    expect(REVEAL_CINEMATIC_TIMING.enterMs).toBeGreaterThan(0);
    expect(REVEAL_CINEMATIC_TIMING.holdMs).toBeGreaterThan(0);
    expect(REVEAL_CINEMATIC_TIMING.returnMs).toBeGreaterThan(0);
    expect(REVEAL_CINEMATIC_TOTAL_MS).toBe(
      REVEAL_CINEMATIC_TIMING.enterMs
      + REVEAL_CINEMATIC_TIMING.holdMs
      + REVEAL_CINEMATIC_TIMING.returnMs
      + 60,
    );
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));

describe('compiled timeline architecture fences', () => {
  it('keeps compiler and schedule pure from DOM and engine imports', () => {
    for (const file of ['compiler.ts', 'schedule.ts']) {
      const source = readFileSync(join(directory, file), 'utf8');
      expect(source).not.toMatch(/from ['"][^'"]*engine/u);
      expect(source).not.toMatch(/\b(?:document|window|HTMLElement|Element\.animate)\b/u);
    }
  });

  it('keeps runner completion independent of wall-clock timers', () => {
    const source = readFileSync(join(directory, 'runner.ts'), 'utf8');
    expect(source).not.toMatch(/setTimeout|setInterval|transitionend/u);
    expect(source).toContain('Promise.all');
  });

  it('contains all native WAAPI construction in the driver', () => {
    const files = [
      'animationProfile.ts', 'builder.ts', 'compiler.ts', 'contracts.ts',
      'cueScheduler.ts', 'diagnostics.ts', 'expand.ts', 'nodes.ts',
      'routineRegistry.ts', 'runner.ts', 'schedule.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(directory, file), 'utf8');
      expect(source).not.toMatch(/new Animation|new KeyframeEffect|\.animate\(/u);
    }
    const driver = readFileSync(join(directory, 'waapiDriver.ts'), 'utf8');
    expect(driver).toContain('new Animation');
    expect(driver).toContain('new KeyframeEffect');
  });

  it('uses a projector-generated closed event payload union and exhaustive policy', () => {
    const projection = readFileSync(join(directory, '../../runtime/projection.ts'), 'utf8');
    const choreography = readFileSync(join(directory, '../choreography.ts'), 'utf8');
    expect(projection).toContain('ReturnType<typeof projectAnimationEventForSeat>');
    expect(projection).not.toMatch(/interface SeatAnimationEvent[\s\S]{0,200}Record<string, JsonValue>/u);
    expect(choreography).toContain("satisfies Record<\n  MatchEvent['type']");
  });
});

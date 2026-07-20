import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const engineRoot = resolve(import.meta.dirname, '..');
const playgameRoot = resolve(engineRoot, '..');

function source(relativePath: string): string {
  return readFileSync(resolve(playgameRoot, relativePath), 'utf8');
}

describe('C5A-6 match-lifecycle architecture fences', () => {
  it('keeps all five boundary event constructors in one owning operation', () => {
    const eventPattern =
      /type:\s*'(?:MATCH_SETUP_COMPLETED|TURN_RESOLUTION_STARTED|TURN_ENDED|TURN_STARTED|MATCH_ENDED)'/g;
    const owner = source('engine/kernel/operations/matchLifecycle.ts');
    expect(owner.match(eventPattern)).toHaveLength(5);

    for (const path of [
      'engine/resolve.ts',
      'engine/locationSetup.ts',
      'engine/opening.ts',
      'runtime/matchRuntime.ts',
    ]) {
      expect(source(path).match(eventPattern) ?? []).toEqual([]);
    }
  });

  it('makes resolver and setup callers command clients rather than reducers', () => {
    for (const path of [
      'engine/resolve.ts',
      'engine/locationSetup.ts',
      'engine/opening.ts',
    ]) {
      const file = source(path);
      expect(file).not.toMatch(/from\s+['"].*\/apply['"]/);
      expect(file).not.toMatch(/\bapply\s*\(/);
    }
  });

  it('does not let callers inject turns, priority results, or terminal score objects', () => {
    const types = source('engine/kernel/types.ts');
    const start = types.indexOf('export interface CompleteSetupCommand');
    const end = types.indexOf('export interface StagePlayCommand');
    const lifecycleCommands = types.slice(start, end);

    expect(lifecycleCommands).not.toMatch(/readonly\s+turn:/);
    expect(lifecycleCommands).not.toMatch(/readonly\s+result:/);
    expect(lifecycleCommands).not.toMatch(/readonly\s+winner:/);
    expect(lifecycleCommands).not.toMatch(/readonly\s+lanesWon:/);
    expect(lifecycleCommands).not.toMatch(/readonly\s+totalPower:/);
  });

  it('removes the runtime-owned opening implementation instead of retaining an adapter', () => {
    expect(existsSync(resolve(playgameRoot, 'runtime/opening.ts'))).toBe(false);
    expect(existsSync(resolve(playgameRoot, 'engine/opening.ts'))).toBe(true);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 7 match setup architecture', () => {
  it('keeps the debug picker behind the development route boundary', () => {
    const router = source('../../../router.tsx');
    const screen = source('../ClassicPlayScreen.tsx');

    expect(router).toContain('allowDebugSetup={import.meta.env.DEV}');
    expect(screen).toContain('import.meta.env.DEV && props.allowDebugSetup === true');
    expect(screen).toContain("await import('@/services/playgame/debug/DebugDeckPicker')");
    expect(screen).not.toContain("import { DebugDeckPicker }");
    expect(router).not.toContain('path: "/play/legacy"');
  });

  it('has no wall-clock or ambient random source in debug match setup', () => {
    const picker = source('../../../services/playgame/debug/DebugDeckPicker.tsx');
    const setup = source('../../../services/playgame/debug/debugMatchSetup.ts');

    for (const implementation of [picker, setup]) {
      expect(implementation).not.toContain('Math.random');
      expect(implementation).not.toContain('Date.now');
    }
    expect(setup).toContain('createRng(normalizeDebugMatchSeed(seed))');
    expect(picker).toContain('buildDebugMatchBootstrap(p, o, normalizeDebugMatchSeed(seed()))');
  });
});

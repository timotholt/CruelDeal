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

describe('Phase 7 CSS isolation architecture', () => {
  it('scopes generic playgame rules and preserves scoped portal rendering', () => {
    const css = source('../../../src/styles/playgame.css');
    const overlays = source('./PlayOverlays.tsx');
    const replay = source('./ReplayDrawer.tsx');

    expect(css).toContain('@scope (.playgame-root)');
    expect(css).toContain('.playgame-root.playgame-portal-root');
    expect(css).toContain(':scope.playfield-hidden');
    expect(overlays.match(/playgame-root playgame-portal-root/g)).toHaveLength(3);
    expect(replay).toContain('playgame-root playgame-portal-root');
  });

  it('does not restore stale global selectors or duplicate keyframes', () => {
    const css = source('../../../src/styles/playgame.css');

    expect(css).not.toMatch(/^\s*:root\s*\{/m);
    expect(css).not.toMatch(/^\s*\*\s*\{/m);
    expect(css).not.toContain('.inspect-overlay');
    expect(css).not.toContain('.dev-panel-toggle');
    expect(css.match(/@keyframes vfxHalo/g)).toHaveLength(1);
    expect(css).not.toContain('@keyframes fadeIn');
  });
});

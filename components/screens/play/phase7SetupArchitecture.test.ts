import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const playgameCssFiles = [
  'tokens-and-sizing.css',
  'board-layout.css',
  'overlays-and-replay.css',
  'cards.css',
  'hud-and-controls.css',
  'vfx.css',
  'responsive.css',
] as const;

const allPlaygameCss = (): string => playgameCssFiles
  .map(file => source(`../../../src/styles/playgame/${file}`))
  .join('\n');

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
    const tokensCss = source('../../../src/styles/playgame/tokens-and-sizing.css');
    const responsiveCss = source('../../../src/styles/playgame/responsive.css');
    const vfxCss = source('../../../src/styles/playgame/vfx.css');
    const overlays = source('./PlayOverlays.tsx');
    const replay = source('./ReplayDrawer.tsx');

    expect(tokensCss).toContain('.playgame-root.playgame-portal-root');
    expect(responsiveCss).toContain('@scope (.playgame-root)');
    expect(responsiveCss).toContain(':scope.playfield-hidden');
    expect(vfxCss).toContain('@scope (.playgame-root)');
    expect(overlays.match(/playgame-root playgame-portal-root/g)).toHaveLength(3);
    expect(replay).toContain('playgame-root playgame-portal-root');
  });

  it('does not restore stale global selectors or duplicate keyframes', () => {
    const allPlayCss = allPlaygameCss();

    expect(allPlayCss).not.toMatch(/^\s*:root\s*\{/m);
    expect(allPlayCss).not.toMatch(/^\s*\*\s*\{/m);
    expect(allPlayCss).not.toContain('.inspect-overlay');
    expect(allPlayCss).not.toContain('.dev-panel-toggle');
    expect(allPlayCss.match(/@keyframes vfxHalo/g)).toHaveLength(1);
    expect(allPlayCss).not.toContain('@keyframes fadeIn');
  });

  it('keeps VFX selectors and keyframes in their owned stylesheet', () => {
    const css = source('../../../src/styles/playgame.css');
    const vfxCss = source('../../../src/styles/playgame/vfx.css');

    expect(css).not.toContain('.card-vfx-overlay');
    expect(css).not.toContain('@keyframes vfx-burst-anim');
    expect(vfxCss).toContain('.card-vfx-overlay');
    expect(vfxCss).toContain('@keyframes vfx-burst-anim');
  });

  it('splits playgame CSS into explicit responsibility-owned modules', () => {
    const entry = source('../../../src/styles/playgame.css');
    for (const file of playgameCssFiles) {
      expect(entry).toContain(`@import './playgame/${file}';`);
      expect(source(`../../../src/styles/playgame/${file}`)).not.toHaveLength(0);
    }
    expect(entry.trim().split('\n')).toHaveLength(playgameCssFiles.length);
  });
});

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '..');

function productionFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const absolute = resolve(root, entry.name);
    if (entry.isDirectory()) return productionFiles(absolute);
    if (
      (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx'))
      || entry.name.includes('.test.')
    ) {
      return [];
    }
    return [absolute];
  });
}

const componentRoots = [
  resolve(repositoryRoot, 'components/screens/play'),
  resolve(repositoryRoot, 'contexts'),
];

const boundaryFiles = [
  ...componentRoots.flatMap(productionFiles),
  ...[
    'components/screens/CityMapScreen.tsx',
    'components/screens/ClassicPlayScreen.tsx',
    'components/screens/LanePowerPanel.tsx',
    'components/screens/StatLogPanel.tsx',
    'components/screens/ZoomInspector.tsx',
  ].map(path => resolve(repositoryRoot, path)),
];

const pathOf = (absolute: string): string =>
  relative(repositoryRoot, absolute);

describe('Phase 2 provider boundary architecture', () => {
  it('has one split provider contract and no compatibility provider', () => {
    expect(existsSync(resolve(
      repositoryRoot,
      'contexts/PlayGameContext.tsx',
    ))).toBe(false);
    expect(existsSync(resolve(
      repositoryRoot,
      'contexts/PlayGameContext.test.tsx',
    ))).toBe(false);

    for (const screen of [
      'components/screens/CityMapScreen.tsx',
      'components/screens/ClassicPlayScreen.tsx',
    ]) {
      expect(readFileSync(resolve(repositoryRoot, screen), 'utf8'))
        .toContain('<PlayProviders');
    }
  });

  it('keeps overlays provider-scoped and replay behind development authority', () => {
    const uiContext = readFileSync(resolve(
      repositoryRoot,
      'contexts/PlayUiContext.tsx',
    ), 'utf8');
    const inspector = readFileSync(resolve(
      repositoryRoot,
      'components/screens/play/inspector.ts',
    ), 'utf8');
    const matchContext = readFileSync(resolve(
      repositoryRoot,
      'contexts/MatchSessionContext.tsx',
    ), 'utf8');
    const playBoard = readFileSync(resolve(
      repositoryRoot,
      'components/screens/play/PlayBoard.tsx',
    ), 'utf8');
    expect(uiContext).toContain('createSignal<InspectTarget | null>');
    expect(uiContext).toContain('createSignal<OpenPile | null>');
    expect(inspector).not.toContain('createSignal');
    expect(matchContext).toContain('readonly debug:');
    expect(matchContext).toContain('debug: debugEnabled');
    expect(playBoard).not.toContain('createSignal');
  });

  it('keeps canonical authority types outside contexts and play components', () => {
    const forbidden = [
      /\bPlayGameContext\b/,
      /\busePlayGame\b/,
      /\bEngineMatchState\b/,
      /\bEventTransition\b/,
      /\bCommittedTransactionTimeline\b/,
      /\bMatchState\b/,
      /\bCardId\b/,
    ];
    const violations = boundaryFiles.flatMap(file => {
      const source = readFileSync(file, 'utf8');
      return forbidden
        .filter(pattern => pattern.test(source))
        .map(pattern => `${pathOf(file)}: ${pattern.source}`);
    });
    expect(violations).toEqual([]);
  });

  it('keeps engine policy and the trusted adapter out of presentation consumers', () => {
    const allowedTrustedFiles = new Set([
      'contexts/MatchSessionContext.tsx',
      'contexts/PlayProviders.tsx',
      'components/screens/CityMapScreen.tsx',
      'components/screens/ClassicPlayScreen.tsx',
    ]);
    const violations: string[] = [];
    for (const file of boundaryFiles) {
      const path = pathOf(file);
      const source = readFileSync(file, 'utf8');
      if (
        /engine\/kernel|reactionDispatcher|capabilityRegistry/.test(source)
      ) {
        violations.push(`${path}: imports engine policy`);
      }
      if (
        /runtime\/(?:localMatchSessionAdapter|matchSession)/.test(source)
        && !allowedTrustedFiles.has(path)
      ) {
        violations.push(`${path}: imports trusted runtime authority`);
      }
    }
    expect(violations).toEqual([]);
  });
});

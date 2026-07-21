import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(import.meta.dirname, '../..');
const filesUnder = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const path = join(directory, entry);
  return statSync(path).isDirectory() ? filesUnder(path) : [path];
});
const source = (path: string): string => readFileSync(path, 'utf8');

describe('game surface architecture fences', () => {
  it('keeps surface rendering independent from playgame and UI state', () => {
    const forbidden = [
      '@/services/playgame/engine',
      '@/services/playgame/runtime',
      '@/services/playgame/view',
      '@/services/playgame/presentation',
      '@/contexts/MatchSessionContext',
      '@/contexts/PlayUiContext',
    ];
    for (const file of filesUnder(import.meta.dirname).filter(
      path => /\.(ts|tsx)$/.test(path) && !path.includes('.test.'),
    )) {
      const contents = source(file);
      for (const importPath of forbidden) expect(contents, file).not.toContain(importPath);
    }
  });

  it('keeps engine and runtime independent from surface rendering', () => {
    for (const relative of ['services/playgame/engine', 'services/playgame/runtime']) {
      for (const file of filesUnder(join(repositoryRoot, relative)).filter(path => /\.(ts|tsx)$/.test(path))) {
        expect(source(file), file).not.toContain('components/game-surfaces');
      }
    }
  });

  it('confines seat-safe view adaptation to pure appearance mappers', () => {
    const cardRenderer = source(join(repositoryRoot, 'components/screens/play/rendering/CardRenderer.tsx'));
    const locationRenderer = source(join(repositoryRoot, 'components/screens/play/rendering/LocationRenderer.tsx'));
    expect(cardRenderer).not.toContain('ResolvedCard');
    expect(locationRenderer).not.toContain('ResolvedLocation');
    expect(cardRenderer).toContain('CardSurfaceModel');
    expect(locationRenderer).toContain('LaneVisualModel');
    expect(source(join(repositoryRoot, 'services/playgame/presentation/appearance/cardAppearance.ts')))
      .toContain('ResolvedCard');
    expect(source(join(repositoryRoot, 'services/playgame/presentation/appearance/locationAppearance.ts')))
      .toContain('ResolvedLocation');
  });

  it('has no visual DOM cloning in active play surfaces', () => {
    const roots = [
      'components/screens/ZoomInspector.tsx',
      'components/screens/play',
      'services/playgame/presentation',
    ];
    for (const relative of roots) {
      const path = join(repositoryRoot, relative);
      const files = statSync(path).isDirectory() ? filesUnder(path) : [path];
      for (const file of files.filter(candidate => /\.(ts|tsx)$/.test(candidate) && !candidate.includes('.test.'))) {
        expect(source(file), file).not.toContain('cloneNode(');
      }
    }
  });

  it('contains no superseded render-plan or face implementation', () => {
    const superseded = [
      'components/screens/play/rendering/renderCache.ts',
      'components/screens/play/rendering/renderModels.ts',
      'components/screens/play/card-faces/RegularCardFace.tsx',
      'components/screens/play/card-faces/SpellCardFace.tsx',
    ];
    const activeFiles = new Set(filesUnder(join(repositoryRoot, 'components')));
    for (const relative of superseded) expect(activeFiles.has(join(repositoryRoot, relative))).toBe(false);
  });
});

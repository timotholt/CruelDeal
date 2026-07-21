import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const deprecatedLegacyRoot = resolve(repositoryRoot, 'deprecated/legacy-game');

const retiredActiveTargets = [
  'services/api/matchService',
  'services/engine',
  'services/ai',
  'services/planning',
  'services/effects',
  'services/triggers',
  'services/statSystem',
  'services/mutations',
  'services/ongoingEffects',
  'services/queries',
  'services/selectors',
  'services/factories',
  'services/statHelpers',
  'services/effectUtils',
  'cards',
].map(path => resolve(repositoryRoot, path));

const excludedDirectories = new Set([
  '.git',
  'deprecated',
  'dist',
  'migrated_prompt_history',
  'node_modules',
]);

const activeTypeScriptFiles = (directory: string): string[] => (
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) return [];
      return activeTypeScriptFiles(resolve(directory, entry.name));
    }

    return /\.(?:ts|tsx|mts|cts)$/.test(entry.name)
      ? [resolve(directory, entry.name)]
      : [];
  })
);

const moduleSpecifiers = (path: string): string[] => {
  const source = readFileSync(path, 'utf8');
  return ts.preProcessFile(source, true, true).importedFiles.map(
    imported => imported.fileName,
  );
};

const withoutTypeScriptExtension = (path: string): string => (
  path.replace(/\.(?:ts|tsx|mts|cts)$/, '')
);

const targetsRetiredGraph = (importingFile: string, specifier: string): boolean => {
  const repositorySpecifier = specifier.startsWith('@/')
    ? specifier.slice(2)
    : specifier;
  const normalizedSpecifier = repositorySpecifier.split('/').join(sep);
  const target = specifier.startsWith('.')
    ? resolve(dirname(importingFile), normalizedSpecifier)
    : resolve(repositoryRoot, normalizedSpecifier);
  const normalizedTarget = withoutTypeScriptExtension(target);

  if (
    normalizedTarget === deprecatedLegacyRoot
    || normalizedTarget.startsWith(`${deprecatedLegacyRoot}${sep}`)
  ) {
    return true;
  }

  return retiredActiveTargets.some(retiredTarget => (
    normalizedTarget === retiredTarget
    || normalizedTarget.startsWith(`${retiredTarget}${sep}`)
  ));
};

describe('retired legacy-game architecture fences', () => {
  it('keeps the retired match graph out of active source', () => {
    const violations = activeTypeScriptFiles(repositoryRoot).flatMap(path => (
      moduleSpecifiers(path)
        .filter(specifier => targetsRetiredGraph(path, specifier))
        .map(specifier => `${relative(repositoryRoot, path)} -> ${specifier}`)
    ));

    expect(violations).toEqual([]);
  });

  it('does not recreate legacy gameplay modules at their former active paths', () => {
    const existingTargets = retiredActiveTargets
      .filter(existsSync)
      .map(path => relative(repositoryRoot, path));

    expect(existingTargets).toEqual([]);
  });

  it('does not expose the retired mock match API', () => {
    const apiPath = resolve(repositoryRoot, 'services/api.ts');
    const sourceFile = ts.createSourceFile(
      apiPath,
      readFileSync(apiPath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    let matchPropertyFound = false;

    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.name.text === 'api'
        && node.initializer
        && ts.isObjectLiteralExpression(node.initializer)
      ) {
        matchPropertyFound = node.initializer.properties.some(property => (
          (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
          && property.name.getText(sourceFile).replace(/["']/g, '') === 'match'
        ));
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    expect(matchPropertyFound).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playgameRoot = resolve(engineRoot, '..');

function productionTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const repositoryPath = relative(playgameRoot, path);
      if (entry.isDirectory()) {
        if (
          entry.name === '__tests__'
          || entry.name === 'testkit'
          || repositoryPath.includes('/deprecated')
        ) {
          continue;
        }
        visit(path);
      } else if (
        entry.name.endsWith('.ts')
        && !entry.name.endsWith('.test.ts')
      ) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

const productionFiles = productionTypeScriptFiles(playgameRoot);

function violations(
  pattern: RegExp,
  allowedRepositoryPaths: ReadonlySet<string>,
): string[] {
  const found: string[] = [];
  for (const path of productionFiles) {
    const repositoryPath = relative(playgameRoot, path);
    if (allowedRepositoryPaths.has(repositoryPath)) continue;
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, index) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        found.push(`${repositoryPath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return found;
}

function declaration(source: string, interfaceName: string): string {
  const start = source.indexOf(`interface ${interfaceName}`);
  const end = source.indexOf('\n}', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 2);
}

describe('C5A-5 staged-play architecture fences', () => {
  it('keeps staged placement and reveal scheduling inside their sole owning operations', () => {
    expect(violations(
      /type:\s*'CARD_STAGED'/,
      new Set([
        'engine/kernel/operations/stagedPlay.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
    expect(violations(
      /type:\s*'CARD_REVEAL_SCHEDULED'/,
      new Set([
        'engine/kernel/operations/revealTiming.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
  });

  it('removes CARD_UNSTAGED from the complete active production alphabet', () => {
    expect(violations(/\bCARD_UNSTAGED\b/, new Set())).toEqual([]);
  });

  it('prevents callers from supplying payment through STAGE_PLAY', () => {
    const commandSource = readFileSync(
      resolve(engineRoot, 'kernel/types.ts'),
      'utf8',
    );
    const stageCommand = declaration(commandSource, 'StagePlayCommand');
    expect(stageCommand).toContain("readonly type: 'STAGE_PLAY'");
    expect(stageCommand).toMatch(/readonly owner:\s*Owner/);
    expect(stageCommand).toMatch(/readonly cardId:\s*CardId/);
    expect(stageCommand).toMatch(/readonly lane:\s*LaneId/);
    expect(stageCommand).not.toMatch(/\b(?:energyPaid|cost|timing)\b/);
  });

  it('keeps CARD_STAGED free of implicit reveal-timing mutation', () => {
    const applySource = readFileSync(resolve(engineRoot, 'apply.ts'), 'utf8');
    const stageStart = applySource.indexOf("case 'CARD_STAGED':");
    const nextCase = applySource.indexOf("\n    case '", stageStart + 1);
    expect(stageStart).toBeGreaterThanOrEqual(0);
    expect(nextCase).toBeGreaterThan(stageStart);
    const stageReducer = applySource.slice(stageStart, nextCase);
    expect(stageReducer).toMatch(/revealTiming:\s*null/);
    expect(stageReducer).not.toMatch(/revealTiming:\s*\{\s*kind:/);
  });

  it('keeps the intent resolver as a command client instead of a stage-event producer', () => {
    const resolverSource = readFileSync(resolve(engineRoot, 'resolve.ts'), 'utf8');
    expect(resolverSource).toContain("type: 'STAGE_PLAY'");
    expect(resolverSource).not.toContain("type: 'CARD_STAGED'");
    expect(resolverSource).not.toContain("type: 'CARD_REVEAL_SCHEDULED'");
    expect(resolverSource).not.toMatch(/function\s+resolveUnstage\s*\(/);
    expect(resolverSource).not.toMatch(/function\s+resolveUndoTurn\s*\(/);
  });

  it('stores private stage intents rather than cached event batches', () => {
    const runtimeSource = readFileSync(
      resolve(playgameRoot, 'runtime/matchRuntime.ts'),
      'utf8',
    );
    const planningDeclaration = runtimeSource.match(
      /(?:interface|type)\s+PlannedStage[\s\S]*?\n\}/,
    )?.[0] ?? '';
    expect(planningDeclaration).toContain('intent');
    expect(planningDeclaration).not.toMatch(/\bevents\b/);
    expect(runtimeSource).toMatch(/\bfoldPlannedSequence\b/);
  });
});

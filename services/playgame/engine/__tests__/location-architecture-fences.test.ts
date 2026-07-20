import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playgameRoot = resolve(engineRoot, '..');
const runtimeRoot = resolve(playgameRoot, 'runtime');

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

const productionFiles = [
  ...productionTypeScriptFiles(engineRoot),
  ...productionTypeScriptFiles(runtimeRoot),
];

function violations(
  files: readonly string[],
  pattern: RegExp,
  allowedRepositoryPaths: ReadonlySet<string>,
): string[] {
  const found: string[] = [];
  for (const path of files) {
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

describe('Phase 1.2 location architecture fences', () => {
  it('keeps canonical event history out of MatchState and all state consumers', () => {
    expect(violations(
      productionFiles,
      /\b(?!console\b)[A-Za-z_$][\w$]*\.log\b/,
      new Set(),
    )).toEqual([]);
    expect(readFileSync(resolve(engineRoot, 'types/state.ts'), 'utf8'))
      .not.toMatch(/readonly\s+log\s*:/);
  });

  it('keeps lifecycle event production inside the governed operation modules', () => {
    const eventNames = [
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      'LOCATION_REVEALED',
      'LOCATION_TURNED_FACE_DOWN',
      'LOCATION_SHOWN_TO_SEATS',
      'LOCATION_REPLACED',
      'LOCATIONS_SWAPPED',
      'LOCATION_MOVED',
      'LOCATION_REMOVED_FROM_LANE',
      'LOCATION_RETURNED_TO_DECK',
      'LOCATION_TAG_ADDED',
      'LOCATION_TAG_REMOVED',
      'LOCATION_COUNTER_CHANGED',
      'LANE_DESTRUCTION_STARTED',
      'LANE_DESTROYED',
      'LANE_CREATION_STARTED',
      'LANE_CREATED',
    ].join('|');
    expect(violations(
      productionFiles,
      new RegExp(`type:\\s*'(${eventNames})'`),
      new Set([
        'engine/kernel/operations/locationMetadata.ts',
        'engine/locationLifecycle.ts',
        'engine/locationSetup.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
  });

  it('keeps location metadata stable-ID only and removes lifecycle wrappers', () => {
    const eventSource = readFileSync(
      resolve(engineRoot, 'types/events.ts'),
      'utf8',
    );
    for (const eventType of [
      'LOCATION_TAG_ADDED',
      'LOCATION_TAG_REMOVED',
      'LOCATION_COUNTER_CHANGED',
    ]) {
      const start = eventSource.indexOf(`type: '${eventType}'`);
      const next = eventSource.indexOf("\n  | {", start + 1);
      const declaration = eventSource.slice(
        start,
        next < 0 ? undefined : next,
      );
      expect(declaration).toMatch(/locationId:\s*LocationCardInstanceId/);
      expect(declaration).not.toMatch(/\blane:\s*LaneId/);
    }
    expect(violations(
      productionFiles,
      /\b(?:addLocationTag|removeLocationTag|changeLocationCounter)\b/,
      new Set(),
    )).toEqual([]);
  });

  it('keeps active topology and lane-status writes inside genesis and reducers', () => {
    expect(violations(
      productionFiles,
      /^\s*(?:readonly\s+)?activeLaneOrder\s*:/,
      new Set([
        'engine/apply.ts',
        'engine/cli/initState.ts',
        'engine/types/state.ts',
      ]),
    )).toEqual([]);
    expect(violations(
      productionFiles,
      /^\s*status:\s*'(?:ACTIVE|CREATING|DESTROYING|DESTROYED)'/,
      new Set(['engine/apply.ts']),
    )).toEqual([]);
  });

  it('keeps manifest enumeration in bootstrap-producing adapters only', () => {
    expect(violations(
      productionFiles,
      /Object\.(?:values|keys|entries)\(manifest\.locations\)/,
      new Set([
        'engine/manifest/implementationAudit.ts',
        'engine/projections/locationTemplate.ts',
      ]),
    )).toEqual([]);
  });

  it('keeps runtime/bootstrap adapters out of the simulation core', () => {
    expect(violations(
      productionTypeScriptFiles(engineRoot),
      /from\s+['"][^'"]*\/runtime\//,
      new Set([
        'engine/cli/main.ts',
        'engine/cli/runMatch.ts',
      ]),
    )).toEqual([]);
  });

  it('forbids positional lane aliases in canonical state and event contracts', () => {
    const contracts = [
      resolve(engineRoot, 'types/events.ts'),
      resolve(engineRoot, 'types/state.ts'),
    ];
    expect(violations(
      contracts,
      /\blane(?:Index|Idx)\b/,
      new Set(),
    )).toEqual([]);
  });

  it('requires callers to supply a complete location deck to setup helpers', () => {
    const source = readFileSync(resolve(engineRoot, 'cli/initState.ts'), 'utf8');
    expect(source).not.toContain('pickLocationDeck');
    expect(source).not.toContain('weightedPickN');
    expect(source).not.toMatch(/locationDeck\s*\?/);
    expect(source).not.toMatch(/locationDeck\s*=\s*/);
    expect(source).not.toMatch(/Object\.(?:values|keys|entries)\(manifest\.locations\)/);
  });
});

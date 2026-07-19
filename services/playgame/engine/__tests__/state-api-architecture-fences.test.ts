import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playgameRoot = resolve(engineRoot, '..');

function productionFiles(directory = playgameRoot): string[] {
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === '__tests__'
          || entry.name === 'testkit'
          || entry.name === 'deprecated'
          || entry.name === 'city-map'
        ) continue;
        visit(path);
      } else if (
        entry.name.endsWith('.ts')
        && !entry.name.endsWith('.test.ts')
      ) {
        files.push(path);
      }
    }
  };
  visit(directory);
  return files;
}

function violations(
  pattern: RegExp,
  allowed: ReadonlySet<string>,
): string[] {
  const results: string[] = [];
  for (const path of productionFiles()) {
    const repositoryPath = relative(playgameRoot, path);
    if (allowed.has(repositoryPath)) continue;
    readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        results.push(`${repositoryPath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return results;
}

describe('opaque card and location state architecture', () => {
  it('permanently removes the superseded public record type names', () => {
    expect(violations(
      /\b(?:CardInstance|LocationCardInstance)\b/,
      new Set(),
    )).toEqual([]);
  });

  it('keeps opaque stores and their internal helpers behind reducer/projection boundaries', () => {
    const allowed = new Set([
      'engine/apply.ts',
      'engine/cli/initState.ts',
      'engine/internal/cardStore.ts',
      'engine/internal/locationStore.ts',
      'engine/projections/cardRuntime.ts',
      'engine/projections/locationRuntime.ts',
      'engine/types/state.ts',
    ]);
    expect(violations(
      /\b(?:cardStore|locationStore)\b|internal\/(?:cardStore|locationStore)/,
      allowed,
    )).toEqual([]);
  });

  it('allows raw manifest definition access only inside template and audit modules', () => {
    expect(violations(
      /manifest\.(?:cards|locations)\b/,
      new Set([
        'engine/manifest/implementationAudit.ts',
        'engine/projections/cardTemplate.ts',
        'engine/projections/locationTemplate.ts',
      ]),
    )).toEqual([]);
  });

  it('keeps governed card mutation event construction inside operation modules', () => {
    const mutationEvents = [
      'CARD_POWER_CHANGED',
      'CARD_COST_CHANGED',
      'CARD_TAG_ADDED',
      'CARD_TAG_REMOVED',
      'CARD_TEXT_OVERRIDDEN',
      'CARD_COUNTER_CHANGED',
    ].join('|');
    expect(violations(
      new RegExp(`type:\\s*'(?:${mutationEvents})'`),
      new Set([
        'engine/operations/cardMutations.ts',
        'engine/operations/power.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
  });

  it('uses normalized card IDs in deck and hand zones', () => {
    const stateSource = readFileSync(resolve(engineRoot, 'types/state.ts'), 'utf8');
    expect(stateSource).toContain(
      'readonly deck: Readonly<Record<Owner, readonly CardId[]>>',
    );
    expect(stateSource).toContain(
      'readonly hand: Readonly<Record<Owner, readonly CardId[]>>',
    );
    expect(stateSource).not.toMatch(
      /readonly (?:deck|hand):[^\n]*InternalCardRecord/,
    );
  });
});

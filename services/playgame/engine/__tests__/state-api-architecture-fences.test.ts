import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

function violationsInFiles(
  repositoryPaths: readonly string[],
  pattern: RegExp,
): string[] {
  const results: string[] = [];
  for (const repositoryPath of repositoryPaths) {
    const path = resolve(playgameRoot, repositoryPath);
    readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        results.push(`${repositoryPath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return results;
}

function productionRepositoryPaths(): string[] {
  return productionFiles().map(path => relative(playgameRoot, path));
}

function reducerCaseSource(eventType: string): string {
  const source = readFileSync(resolve(engineRoot, 'apply.ts'), 'utf8');
  const start = source.indexOf(`case '${eventType}'`);
  if (start < 0) throw new Error(`Reducer case ${eventType} is missing.`);
  const nextCase = source.indexOf("\n    case '", start + 1);
  return source.slice(start, nextCase < 0 ? undefined : nextCase);
}

function reducerCases(): ReadonlyMap<string, string> {
  const source = readFileSync(resolve(engineRoot, 'apply.ts'), 'utf8');
  const reducerStart = source.indexOf('\nfunction applyEventBody(');
  const reducerEnd = source.indexOf('\n// ---- Structural helpers');
  if (reducerStart < 0 || reducerEnd <= reducerStart) {
    throw new Error('applyEventBody reducer boundary is missing.');
  }
  const reducer = source.slice(reducerStart, reducerEnd);
  const matches = [...reducer.matchAll(/\n    case '([^']+)'/g)];
  return new Map(matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? reducer.length;
    return [match[1], reducer.slice(start, end)];
  }));
}

describe('opaque card and location state architecture', () => {
  it('permanently removes the superseded public record type names', () => {
    expect(violations(
      /\b(?:CardInstance|LocationCardInstance)\b/,
      new Set(),
    )).toEqual([]);
  });

  it('permanently removes ID-only and scalar staged-payment compatibility state', () => {
    expect(violations(
      /\b(?:stagingOrder|stagedEnergyCost)\b/,
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
        'engine/kernel/operations/cost.ts',
        'engine/kernel/operations/cardMetadata.ts',
        'engine/kernel/operations/power.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
  });

  it('keeps raw stored-power construction solely in the kernel operation', () => {
    expect(violations(
      /type:\s*'CARD_POWER_CHANGED'/,
      new Set([
        'engine/kernel/operations/power.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
    expect(existsSync(resolve(engineRoot, 'operations/power.ts'))).toBe(false);
    expect(violations(/\bresolveCardPower[A-Za-z0-9_]*\b/, new Set()))
      .toEqual([]);
  });

  it('keeps raw permanent-cost construction solely in the kernel operation', () => {
    expect(violations(
      /type:\s*'CARD_COST_CHANGED'/,
      new Set([
        'engine/kernel/operations/cost.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
    expect(violations(
      /\b(?:adjustCardCost|setCardCost)\b/,
      new Set(),
    )).toEqual([]);
  });

  it('keeps raw Energy construction solely in the kernel operation', () => {
    expect(violations(
      /type:\s*'(?:ENERGY_CHANGED|MAX_ENERGY_CHANGED|NEXT_TURN_ENERGY_BONUS_CHANGED)'/,
      new Set([
        'engine/kernel/operations/energy.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
  });

  it('keeps raw card-metadata construction solely in the kernel operation', () => {
    expect(violations(
      /type:\s*'(?:CARD_TAG_ADDED|CARD_TAG_REMOVED|CARD_COUNTER_CHANGED|CARD_TEXT_OVERRIDDEN)'/,
      new Set([
        'engine/kernel/operations/cardMetadata.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
    expect(existsSync(resolve(engineRoot, 'operations/cardMutations.ts')))
      .toBe(false);
  });

  it('keeps raw location-metadata construction solely in the kernel operation', () => {
    expect(violations(
      /type:\s*'(?:LOCATION_TAG_ADDED|LOCATION_TAG_REMOVED|LOCATION_COUNTER_CHANGED)'/,
      new Set([
        'engine/kernel/operations/locationMetadata.ts',
        'engine/types/events.ts',
      ]),
    )).toEqual([]);
    expect(violations(
      /\b(?:addLocationTag|removeLocationTag|changeLocationCounter)\b/,
      new Set(),
    )).toEqual([]);
  });

  it('keeps live card-tag writes inside metadata reduction or transform reset', () => {
    const tagPatchCases = [...reducerCases()]
      .filter(([, source]) =>
        source.includes('patchCard(') && /\btags\s*:/.test(source))
      .map(([eventType]) => eventType);

    expect(tagPatchCases).toEqual([
      'CARD_TRANSFORMED',
      'CARD_TAG_ADDED',
      'CARD_TAG_REMOVED',
    ]);
  });

  it('keeps engine lifecycle markers out of authored card metadata types', () => {
    const stateTypes = readFileSync(
      resolve(engineRoot, 'types/state.ts'),
      'utf8',
    );
    const abilityTypes = readFileSync(
      resolve(engineRoot, 'types/ability.ts'),
      'utf8',
    );
    const cardTagBlock = stateTypes.slice(
      stateTypes.indexOf('export type CardTag ='),
      stateTypes.indexOf('export type CardLifecycleMarker ='),
    );
    const cardTagSpecBlock = abilityTypes.slice(
      abilityTypes.indexOf('export type CardTagSpec ='),
      abilityTypes.indexOf('export type LaneTagSpec ='),
    );

    for (const marker of [
      'PLAYED_THIS_TURN',
      'MOVED_THIS_TURN',
      'DESTROYED_THIS_TURN',
      'EVER_MOVED',
    ]) {
      expect(cardTagBlock).not.toContain(marker);
      expect(cardTagSpecBlock).not.toContain(marker);
    }
  });

  it('keeps kernel operations and policies pure proposal producers', () => {
    const governedFiles = productionRepositoryPaths().filter(path =>
      path.startsWith('engine/kernel/operations/')
      || path.startsWith('engine/kernel/policies/')
    );
    expect(violationsInFiles(
      governedFiles,
      /from\s*['"][^'"]*\/apply['"]|\bapply(?:Framed)?\s*\(/,
    )).toEqual([]);
  });

  it('keeps live power-ledger writes in CARD_POWER_CHANGED only', () => {
    const transformedReducer = reducerCaseSource('CARD_TRANSFORMED');
    const powerReducer = reducerCaseSource('CARD_POWER_CHANGED');
    const applySource = readFileSync(resolve(engineRoot, 'apply.ts'), 'utf8');
    const liveLedgerAppends = applySource.match(
      /powerLedger:\s*\[\s*\.\.\.[^\]]*powerLedger[^\]]*\]/g,
    ) ?? [];

    expect(transformedReducer).not.toMatch(/\bpowerLedger\b/);
    expect(powerReducer).toMatch(
      /powerLedger:\s*\[\s*\.\.\.card\.powerLedger,\s*entry\s*\]/,
    );
    expect(liveLedgerAppends).toHaveLength(1);
  });

  it('keeps replay and presentation paths from invoking the kernel', () => {
    const presentationFiles = productionRepositoryPaths().filter(path =>
      path === 'engine/replay.ts'
      || path.startsWith('debug/')
      || path.startsWith('presentation/')
    );
    expect(violationsInFiles(
      presentationFiles,
      /from\s*['"][^'"]*\/kernel(?:\/[^'"]*)?['"]|\b(?:resolveKernelTransaction|changeStoredPower|planStoredPowerCommand|dispatchKernelReactions|runKernel)\s*\(/,
    )).toEqual([]);
  });

  it('keeps Frame and RNG authority outside the kernel implementation', () => {
    const kernelFiles = productionRepositoryPaths().filter(path =>
      path.startsWith('engine/kernel/')
    );
    expect(violationsInFiles(
      kernelFiles,
      /from\s*['"][^'"]*\/(?:timeline|transactionTimeline|rng)['"]|\b(?:frameAndFoldEvents|frameSingleEvent|advanceGameplayRng|createRng|nextFrame)\s*\(|\breadonly\s+(?:frame|rng)\s*:/,
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

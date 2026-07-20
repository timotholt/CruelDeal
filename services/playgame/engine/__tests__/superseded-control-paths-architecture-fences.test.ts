import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const engineRoot = resolve(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(resolve(engineRoot, relativePath), 'utf8');
}

function productionTypeScriptFiles(directory = engineRoot): string[] {
  return readdirSync(directory).flatMap(entry => {
    const absolute = resolve(directory, entry);
    if (statSync(absolute).isDirectory()) {
      if (entry === '__tests__' || entry === 'testkit') return [];
      return productionTypeScriptFiles(absolute);
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return [];
    return [absolute];
  });
}

describe('C5B superseded-control-path architecture fences', () => {
  it('deletes the legacy evaluator and imperative builtin registry', () => {
    expect(existsSync(resolve(engineRoot, 'effects/evaluator.ts'))).toBe(false);
    expect(existsSync(resolve(engineRoot, 'effects/builtins.ts'))).toBe(false);
  });

  it('keeps the rules transaction as the only simulation reducer client', () => {
    const violations = productionTypeScriptFiles(
      resolve(engineRoot, 'kernel'),
    ).flatMap(path => {
      const callsApply = /\bapply\s*\(/.test(readFileSync(path, 'utf8'));
      const allowed = path === resolve(
        engineRoot,
        'kernel/rulesTransaction.ts',
      );
      return callsApply && !allowed ? [relative(engineRoot, path)] : [];
    });

    expect(violations).toEqual([]);
  });

  it('does not restore per-domain transaction executors or manual triggers', () => {
    const forbidden =
      /\b(?:evalEffect|revealPlayedCard|triggerOnReveal|executeHandCommands|executePlacementCommands|executePowerCommands|executeReactionCommands|executeRevealCommands|resolveCardMetadataTransaction|resolveCostTransaction|resolveEnergyTransaction|resolveHandTransaction|resolveDestructionLifecycleTransaction|resolveLocationMetadataTransaction|resolvePendingEffectTransaction|resolvePlacementTransaction|resolveStoredPowerTransaction|resolveRevealTransaction|resolveTransformTransaction)\b/;
    const violations = productionTypeScriptFiles().flatMap(path => {
      const match = readFileSync(path, 'utf8').match(forbidden);
      return match
        ? [`${relative(engineRoot, path)}: ${match[0]}`]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it('keeps builtin planning pure and command-only', () => {
    const planner = source('effects/builtinCommandPlanner.ts');

    expect(planner).not.toMatch(/from\s+['"].*\/apply['"]/);
    expect(planner).not.toMatch(/from\s+['"].*types\/events['"]/);
    expect(planner).not.toMatch(/\bapply\s*\(/);
    expect(planner).not.toMatch(/\bresolve[A-Za-z]+Transaction\s*\(/);
  });
});

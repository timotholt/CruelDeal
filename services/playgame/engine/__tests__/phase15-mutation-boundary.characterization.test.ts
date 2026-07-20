import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');
const PRODUCTION_ROOTS = [
  'services/playgame/engine',
  'services/playgame/runtime',
  'services/playgame/script',
] as const;
const EVENT_DECLARATIONS = 'services/playgame/engine/types/events.ts';
const NON_MUTATING_EVENTS = new Set([
  'OR_WINDOW_OPEN',
  'OR_WINDOW_CLOSE',
  'RECURSION_LIMIT_HIT',
  'INTENT_REJECTED',
]);
const MANUAL_REACTION_CALLS = new Set([
  'applyHandEntryDebuffs',
  'fireCardTrigger',
  'fireLocationTrigger',
  'fireOnAnyCardPlayedHere',
  'hasPowerGainDrawTrigger',
]);

type CountInventory = Readonly<Record<string, Readonly<Record<string, number>>>>;

const EXPECTED_MUTATION_CONSTRUCTION_SURFACES: CountInventory = {
  'services/playgame/engine/effects/builtins.ts': {
    CARD_TRANSFORMED: 1,
    PENDING_EFFECT_ADDED: 2,
  },
  'services/playgame/engine/effects/evaluator.ts': {
    CARD_REVEAL_SCHEDULED: 1,
    CARD_TRANSFORMED: 1,
    ENERGY_CHANGED: 1,
    MAX_ENERGY_CHANGED: 1,
    NEXT_TURN_ENERGY_BONUS_CHANGED: 1,
    PENDING_EFFECT_ADDED: 1,
  },
  'services/playgame/engine/locationLifecycle.ts': {
    LANE_CREATED: 1,
    LANE_CREATION_STARTED: 1,
    LANE_DESTROYED: 1,
    LANE_DESTRUCTION_STARTED: 1,
    LOCATION_CARD_CREATED: 1,
    LOCATION_CARD_PLAYED: 1,
    LOCATION_COUNTER_CHANGED: 1,
    LOCATION_MOVED: 1,
    LOCATION_REMOVED_FROM_LANE: 1,
    LOCATION_REPLACED: 1,
    LOCATION_RETURNED_TO_DECK: 1,
    LOCATION_REVEALED: 2,
    LOCATION_SHOWN_TO_SEATS: 1,
    LOCATION_SLOT_REVEAL_SCHEDULED: 1,
    LOCATION_TAG_ADDED: 1,
    LOCATION_TAG_REMOVED: 1,
    LOCATION_TURNED_FACE_DOWN: 1,
    LOCATIONS_SWAPPED: 1,
  },
  'services/playgame/engine/locationSetup.ts': {
    LANE_CREATED: 1,
    LANE_CREATION_STARTED: 1,
    LOCATION_CARD_DRAWN: 1,
    LOCATION_CARD_PLAYED: 1,
    LOCATION_DECK_INITIALIZED: 1,
    LOCATION_SLOT_REVEAL_SCHEDULED: 1,
    MATCH_SETUP_COMPLETED: 1,
  },
  'services/playgame/engine/operations/cardMutations.ts': {
    CARD_COST_CHANGED: 1,
    CARD_COUNTER_CHANGED: 1,
    CARD_TAG_ADDED: 1,
    CARD_TAG_REMOVED: 1,
    CARD_TEXT_OVERRIDDEN: 1,
  },
  'services/playgame/engine/kernel/operations/power.ts': {
    CARD_POWER_CHANGED: 1,
  },
  'services/playgame/engine/kernel/operations/hand.ts': {
    CARD_DISCARDED: 1,
    CARD_DRAWN: 1,
  },
  'services/playgame/engine/kernel/revealTransaction.ts': {
    CARD_PLAY_COMPLETED: 1,
    CARD_REVEALED: 1,
  },
  'services/playgame/engine/kernel/operations/lifecycle.ts': {
    CARD_BANISHED: 1,
    CARD_DESTROYED: 1,
  },
  'services/playgame/engine/kernel/operations/placement.ts': {
    CARD_CREATED: 1,
    CARD_MOVED: 1,
    CARD_RETURNED_TO_LANE: 1,
    CARD_ZONE_CHANGED: 1,
  },
  'services/playgame/engine/resolve.ts': {
    CARD_REVEAL_SCHEDULED: 1,
    CARD_STAGED: 1,
    CARD_UNSTAGED: 2,
    ENERGY_CHANGED: 4,
    MATCH_ENDED: 2,
    MAX_ENERGY_CHANGED: 1,
    NEXT_TURN_ENERGY_BONUS_CHANGED: 1,
    PENDING_EFFECT_REMOVED: 2,
    TURN_ENDED: 1,
    TURN_RESOLUTION_STARTED: 1,
    TURN_STARTED: 1,
  },
  'services/playgame/engine/rng/transaction.ts': {
    GAMEPLAY_RNG_ADVANCED: 1,
  },
};

const EXPECTED_MANUAL_REACTION_CALL_SURFACES: CountInventory = {};

function productionTypeScriptFiles(): string[] {
  const files: string[] = [];
  const visit = (relativePath: string): void => {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    for (const entry of readdirSync(absolutePath)) {
      const child = path.posix.join(relativePath, entry);
      const childAbsolute = path.join(REPO_ROOT, child);
      if (statSync(childAbsolute).isDirectory()) {
        if (entry === '__tests__' || child.includes('/deprecated/')) continue;
        visit(child);
      } else if (
        entry.endsWith('.ts')
        && !entry.endsWith('.test.ts')
        && child !== EVENT_DECLARATIONS
      ) {
        files.push(child);
      }
    }
  };
  PRODUCTION_ROOTS.forEach(visit);
  return files.sort();
}

function matchEventDiscriminants(): Set<string> {
  const source = readFileSync(path.join(REPO_ROOT, EVENT_DECLARATIONS), 'utf8');
  return new Set(
    [...source.matchAll(/\btype:\s*'([A-Z_]+)'/g)]
      .map(match => match[1])
      .filter(type => !NON_MUTATING_EVENTS.has(type)),
  );
}

function propertyName(node: ts.PropertyName): string | null {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}

function increment(
  inventory: Record<string, Record<string, number>>,
  file: string,
  key: string,
): void {
  const fileInventory = inventory[file] ?? {};
  fileInventory[key] = (fileInventory[key] ?? 0) + 1;
  inventory[file] = fileInventory;
}

function collectCurrentInventory(): {
  readonly mutationConstructions: CountInventory;
  readonly manualReactionCalls: CountInventory;
} {
  const mutationConstructions: Record<string, Record<string, number>> = {};
  const manualReactionCalls: Record<string, Record<string, number>> = {};
  const mutationEvents = matchEventDiscriminants();

  for (const file of productionTypeScriptFiles()) {
    const sourceText = readFileSync(path.join(REPO_ROOT, file), 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
          if (
            ts.isPropertyAssignment(property)
            && propertyName(property.name) === 'type'
            && ts.isStringLiteral(property.initializer)
            && mutationEvents.has(property.initializer.text)
          ) {
            increment(mutationConstructions, file, property.initializer.text);
          }
        }
      }
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && MANUAL_REACTION_CALLS.has(node.expression.text)
      ) {
        increment(manualReactionCalls, file, node.expression.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return { mutationConstructions, manualReactionCalls };
}

function logicalConstructionSurface(file: string): string {
  return file === 'services/playgame/engine/locationLifecycle.ts'
    || file === 'services/playgame/engine/locationSetup.ts'
    ? 'services/playgame/engine/location-domain'
    : file;
}

describe('Phase 1.5 checkpoint 1 mutation-boundary characterization', () => {
  it('locks the nine governed logical production mutation-construction surfaces', () => {
    const { mutationConstructions } = collectCurrentInventory();

    expect(mutationConstructions).toEqual(EXPECTED_MUTATION_CONSTRUCTION_SURFACES);
    expect(new Set(Object.keys(mutationConstructions).map(logicalConstructionSurface)).size)
      .toBe(11);
  });

  it('locks every existing manual reaction call surface until the dispatcher replaces them', () => {
    const { manualReactionCalls } = collectCurrentInventory();

    expect(manualReactionCalls).toEqual(EXPECTED_MANUAL_REACTION_CALL_SURFACES);
  });
});

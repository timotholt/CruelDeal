import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const playgameRoot = resolve(repositoryRoot, 'services/playgame');
const engineRoot = resolve(playgameRoot, 'engine');

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function productionTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const absolute = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__'
        || entry.name === 'testkit'
        || entry.name === 'deprecated'
        || entry.name === 'city-map'
      ) {
        return [];
      }
      return productionTypeScriptFiles(absolute);
    }
    if (
      !entry.name.endsWith('.ts')
      && !entry.name.endsWith('.tsx')
    ) {
      return [];
    }
    if (entry.name.endsWith('.test.ts')) return [];
    return [absolute];
  });
}

function repositoryPath(path: string): string {
  return relative(repositoryRoot, path);
}

function parsed(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function visit(node: ts.Node, callback: (candidate: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, child => visit(child, callback));
}

function moduleSpecifiers(path: string): string[] {
  const modules: string[] = [];
  visit(parsed(path), node => {
    if (
      (
        ts.isImportDeclaration(node)
        || ts.isExportDeclaration(node)
      )
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      modules.push(node.moduleSpecifier.text);
    }
  });
  return modules;
}

const eventOwner = {
  GAMEPLAY_RNG_ADVANCED: 'services/playgame/engine/rng/transaction.ts',
  CARD_STAGED: 'services/playgame/engine/kernel/operations/stagedPlay.ts',
  ENERGY_CHANGED: 'services/playgame/engine/kernel/operations/energy.ts',
  MAX_ENERGY_CHANGED: 'services/playgame/engine/kernel/operations/energy.ts',
  NEXT_TURN_ENERGY_BONUS_CHANGED:
    'services/playgame/engine/kernel/operations/energy.ts',
  CARD_REVEAL_SCHEDULED:
    'services/playgame/engine/kernel/operations/revealTiming.ts',
  CARD_REVEALED: 'services/playgame/engine/kernel/revealTransaction.ts',
  CARD_PLAY_COMPLETED: 'services/playgame/engine/kernel/revealTransaction.ts',
  OR_WINDOW_OPEN: 'services/playgame/engine/kernel/revealTransaction.ts',
  OR_WINDOW_CLOSE: 'services/playgame/engine/kernel/revealTransaction.ts',
  CARD_POWER_CHANGED: 'services/playgame/engine/kernel/operations/power.ts',
  CARD_COST_CHANGED: 'services/playgame/engine/kernel/operations/cost.ts',
  CARD_DESTROYED: 'services/playgame/engine/kernel/operations/lifecycle.ts',
  CARD_DISCARDED: 'services/playgame/engine/kernel/operations/hand.ts',
  CARD_BANISHED: 'services/playgame/engine/kernel/operations/lifecycle.ts',
  CARD_MOVED: 'services/playgame/engine/kernel/operations/placement.ts',
  CARD_RETURNED_TO_LANE:
    'services/playgame/engine/kernel/operations/placement.ts',
  CARD_TRANSFORMED: 'services/playgame/engine/kernel/operations/transform.ts',
  CARD_TAG_ADDED: 'services/playgame/engine/kernel/operations/cardMetadata.ts',
  CARD_TAG_REMOVED:
    'services/playgame/engine/kernel/operations/cardMetadata.ts',
  CARD_TEXT_OVERRIDDEN:
    'services/playgame/engine/kernel/operations/cardMetadata.ts',
  CARD_COUNTER_CHANGED:
    'services/playgame/engine/kernel/operations/cardMetadata.ts',
  CARD_DRAWN: 'services/playgame/engine/kernel/operations/hand.ts',
  CARD_CREATED: 'services/playgame/engine/kernel/operations/placement.ts',
  CARD_ZONE_CHANGED: 'services/playgame/engine/kernel/operations/placement.ts',
  PENDING_EFFECT_SCHEDULED:
    'services/playgame/engine/kernel/operations/pendingEffect.ts',
  PENDING_EFFECT_CONSUMED:
    'services/playgame/engine/kernel/operations/pendingEffect.ts',
  LOCATION_DECK_INITIALIZED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_CARD_CREATED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_CARD_DRAWN:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_CARD_PLAYED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_SLOT_REVEAL_SCHEDULED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_REVEALED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_TURNED_FACE_DOWN:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_SHOWN_TO_SEATS:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_REPLACED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATIONS_SWAPPED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_MOVED:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_REMOVED_FROM_LANE:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_RETURNED_TO_DECK:
    'services/playgame/engine/kernel/operations/locationLifecycle.ts',
  LOCATION_TAG_ADDED:
    'services/playgame/engine/kernel/operations/locationMetadata.ts',
  LOCATION_TAG_REMOVED:
    'services/playgame/engine/kernel/operations/locationMetadata.ts',
  LOCATION_COUNTER_CHANGED:
    'services/playgame/engine/kernel/operations/locationMetadata.ts',
  LANE_DESTRUCTION_STARTED:
    'services/playgame/engine/kernel/operations/laneTopology.ts',
  LANE_DESTROYED:
    'services/playgame/engine/kernel/operations/laneTopology.ts',
  LANE_CREATION_STARTED:
    'services/playgame/engine/kernel/operations/laneTopology.ts',
  LANE_CREATED: 'services/playgame/engine/kernel/operations/laneTopology.ts',
  MATCH_SETUP_COMPLETED:
    'services/playgame/engine/kernel/operations/matchLifecycle.ts',
  TURN_RESOLUTION_STARTED:
    'services/playgame/engine/kernel/operations/matchLifecycle.ts',
  TURN_STARTED:
    'services/playgame/engine/kernel/operations/matchLifecycle.ts',
  TURN_ENDED:
    'services/playgame/engine/kernel/operations/matchLifecycle.ts',
  MATCH_ENDED:
    'services/playgame/engine/kernel/operations/matchLifecycle.ts',
  INTENT_REJECTED: 'services/playgame/engine/resolve.ts',
} as const;

const intentionallyDormantEvents = new Set([
  'DECK_SHUFFLED',
  'RECURSION_LIMIT_HIT',
]);

describe('C5C permanent Phase 1.5 architecture gates', () => {
  it('assigns every event variant to one owning constructor or dormant status', () => {
    const eventTypes = new Set(
      [...source('services/playgame/engine/types/events.ts')
        .matchAll(/type:\s*'([A-Z][A-Z0-9_]*)'/g)]
        .map(match => match[1]),
    );
    expect(new Set([
      ...Object.keys(eventOwner),
      ...intentionallyDormantEvents,
    ])).toEqual(eventTypes);

    const violations: string[] = [];
    const observed = new Set<string>();
    for (const path of productionTypeScriptFiles(engineRoot)) {
      const ownerPath = repositoryPath(path);
      visit(parsed(path), node => {
        if (
          !ts.isPropertyAssignment(node)
          || !ts.isIdentifier(node.name)
          || node.name.text !== 'type'
          || !ts.isStringLiteral(node.initializer)
        ) {
          return;
        }
        const eventType = node.initializer.text;
        if (!eventTypes.has(eventType)) return;
        observed.add(eventType);
        const expected = eventOwner[eventType as keyof typeof eventOwner];
        if (expected !== ownerPath) {
          violations.push(`${eventType}: ${ownerPath} (expected ${expected})`);
        }
      });
    }

    expect(violations).toEqual([]);
    expect(new Set([...observed].filter(type =>
      !intentionallyDormantEvents.has(type)
    ))).toEqual(new Set(Object.keys(eventOwner)));
  });

  it('enforces the direct reducer allowlist across production playgame code', () => {
    const allowedImports = new Set([
      'services/playgame/engine/index.ts',
      'services/playgame/engine/kernel/rulesTransaction.ts',
      'services/playgame/engine/transactionTimeline.ts',
      'services/playgame/runtime/matchRuntime.ts',
    ]);
    const allowedCalls = new Set([
      'services/playgame/engine/apply.ts',
      'services/playgame/engine/kernel/rulesTransaction.ts',
      'services/playgame/engine/transactionTimeline.ts',
      'services/playgame/runtime/matchRuntime.ts',
    ]);
    const violations: string[] = [];

    for (const path of productionTypeScriptFiles(playgameRoot)) {
      const current = repositoryPath(path);
      if (
        moduleSpecifiers(path).some(specifier =>
          /(?:^|\/)apply$/.test(specifier)
        )
        && !allowedImports.has(current)
      ) {
        violations.push(`${current}: imports reducer`);
      }
      visit(parsed(path), node => {
        if (
          ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && (
            node.expression.text === 'apply'
            || node.expression.text === 'applyFramed'
          )
          && !allowedCalls.has(current)
        ) {
          violations.push(`${current}: calls ${node.expression.text}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('keeps committed reaction invocation inside the canonical dispatcher', () => {
    const violations: string[] = [];
    for (const path of productionTypeScriptFiles(engineRoot)) {
      const current = repositoryPath(path);
      visit(parsed(path), node => {
        if (
          ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && /^collect[A-Za-z]+Reactions$/.test(node.expression.text)
          && current !==
            'services/playgame/engine/kernel/rulesTransaction.ts'
        ) {
          violations.push(`${current}: ${node.expression.text}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it('keeps active content dependent on schema/data rather than engine capabilities', () => {
    const activeContent = [
      ...productionTypeScriptFiles(resolve(
        engineRoot,
        'manifest/card-sets/core-v1',
      )),
      ...productionTypeScriptFiles(resolve(
        engineRoot,
        'manifest/location-sets/core-v1',
      )),
    ];
    const violations = activeContent.flatMap(path =>
      moduleSpecifiers(path)
        .filter(specifier =>
          /(?:kernel|effects|apply|resolve|runtime|presentation)/.test(
            specifier,
          )
        )
        .map(specifier => `${repositoryPath(path)}: ${specifier}`)
    );
    expect(violations).toEqual([]);
  });

  it('keeps providers and presentation code capability-free', () => {
    const boundaryRoots = [
      resolve(repositoryRoot, 'components'),
      resolve(repositoryRoot, 'contexts'),
      resolve(playgameRoot, 'presentation'),
      resolve(playgameRoot, 'debug'),
    ];
    const violations = boundaryRoots.flatMap(root =>
      productionTypeScriptFiles(root).flatMap(path => {
        const capabilityImports = moduleSpecifiers(path).filter(specifier =>
          /engine\/(?:kernel|effects\/rulesInterpreter)/.test(specifier)
        );
        const capabilityCalls: string[] = [];
        visit(parsed(path), node => {
          if (
            ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && /^(?:executeRulesCommands|resolveRulesTransaction|resolveKernelTransaction)$/
              .test(node.expression.text)
          ) {
            capabilityCalls.push(node.expression.text);
          }
        });
        return [
          ...capabilityImports.map(value =>
            `${repositoryPath(path)}: imports ${value}`
          ),
          ...capabilityCalls.map(value =>
            `${repositoryPath(path)}: calls ${value}`
          ),
        ];
      })
    );
    expect(violations).toEqual([]);
  });

  it('forbids unscoped randomness in simulation and runtime authority', () => {
    const violations: string[] = [];
    for (const root of [engineRoot, resolve(playgameRoot, 'runtime')]) {
      for (const path of productionTypeScriptFiles(root)) {
        visit(parsed(path), node => {
          if (
            ts.isCallExpression(node)
            && ts.isPropertyAccessExpression(node.expression)
            && ts.isIdentifier(node.expression.expression)
            && node.expression.expression.text === 'Math'
            && node.expression.name.text === 'random'
          ) {
            violations.push(repositoryPath(path));
          }
        });
      }
    }
    expect(violations).toEqual([]);
  });

  it('requires semantic-envelope routing for every canonical event', () => {
    const eventTypes = [
      ...source('services/playgame/engine/types/events.ts')
        .matchAll(/type:\s*'([A-Z][A-Z0-9_]*)'/g),
    ].map(match => match[1]);
    const rulesSource = source(
      'services/playgame/engine/kernel/rulesTransaction.ts',
    );
    const start = rulesSource.indexOf('function isMatchLifecycleEvent(');
    const end = rulesSource.indexOf('\nfunction collectReactions(', start);
    const captureSource = rulesSource.slice(start, end);
    const routed = new Set(
      [...captureSource.matchAll(/'([A-Z][A-Z0-9_]*)'/g)]
        .map(match => match[1]),
    );
    const externallyFolded = new Set([
      'GAMEPLAY_RNG_ADVANCED',
      'DECK_SHUFFLED',
    ]);

    expect(eventTypes.filter(type =>
      !routed.has(type) && !externallyFolded.has(type)
    )).toEqual([]);
    expect(captureSource).toContain(
      'Canonical rules transaction cannot capture ${event.type}.',
    );

    const kernelSource = source(
      'services/playgame/engine/kernel/kernel.ts',
    );
    const captureAt = kernelSource.indexOf(
      'handlers.captureSemantics(before, item.event, after)',
    );
    const collectAt = kernelSource.indexOf(
      'handlers.collectReactions(before, after, transition)',
    );
    expect(captureAt).toBeGreaterThan(0);
    expect(collectAt).toBeGreaterThan(captureAt);
  });

  it('keeps each active card and location locally authored and generated', () => {
    const authoringContracts = [
      {
        root: resolve(
          engineRoot,
          'manifest/card-sets/core-v1/cards',
        ),
        definition: 'card.json',
        generated: source(
          'services/playgame/engine/manifest/card-sets/core-v1/cards.generated.ts',
        ),
        importPrefix: './cards',
      },
      {
        root: resolve(
          engineRoot,
          'manifest/location-sets/core-v1/locations',
        ),
        definition: 'location.json',
        generated: source(
          'services/playgame/engine/manifest/location-sets/core-v1/locations.generated.ts',
        ),
        importPrefix: './locations',
      },
    ] as const;

    for (const contract of authoringContracts) {
      const folders = readdirSync(contract.root, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(folder => existsSync(resolve(
          contract.root,
          folder,
          contract.definition,
        )))
        .sort();
      expect(folders.length).toBeGreaterThan(0);
      for (const folder of folders) {
        expect(contract.generated).toContain(
          `${contract.importPrefix}/${folder}/${contract.definition}`,
        );
      }
    }
  });

  it('keeps reducers and projections policy-blind and mutation-free', () => {
    const reducerImports = moduleSpecifiers(
      resolve(engineRoot, 'apply.ts'),
    );
    expect(reducerImports.filter(specifier =>
      /(?:^|\/)(?:kernel|effects)(?:\/|$)/.test(specifier)
    )).toEqual([]);

    const violations: string[] = [];
    for (const path of productionTypeScriptFiles(resolve(
      engineRoot,
      'projections',
    ))) {
      const current = repositoryPath(path);
      for (const specifier of moduleSpecifiers(path)) {
        if (
          /(?:^|\/)(?:apply|kernel|effects\/rulesInterpreter)$/.test(
            specifier,
          )
        ) {
          violations.push(`${current}: imports ${specifier}`);
        }
      }
      visit(parsed(path), node => {
        if (
          ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && /^(?:apply|applyFramed|executeRulesCommands|resolveRulesTransaction|resolveKernelTransaction)$/
            .test(node.expression.text)
        ) {
          violations.push(`${current}: calls ${node.expression.text}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it('restricts exceptional builtins to queries, command data, and scoped RNG', () => {
    const builtinPath = resolve(
      engineRoot,
      'effects/builtinCommandPlanner.ts',
    );
    const allowedImports = new Set([
      '../manifest/types',
      '../projections/cost',
      '../projections/cardRuntime',
      '../projections/cardTemplate',
      '../projections/power',
      '../projections/power-bearing',
      '../laneTopology',
      '../powerLedger',
      '../types/ids',
      '../types/state',
      '../kernel/types',
      './rulesInterpreter',
    ]);
    expect(moduleSpecifiers(builtinPath).filter(specifier =>
      !allowedImports.has(specifier)
    )).toEqual([]);

    const forbiddenCalls: string[] = [];
    visit(parsed(builtinPath), node => {
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && /^(?:apply|applyFramed|executeRulesCommands|resolveRulesTransaction|resolveKernelTransaction)$/
          .test(node.expression.text)
      ) {
        forbiddenCalls.push(node.expression.text);
      }
    });
    expect(forbiddenCalls).toEqual([]);
  });

  it('forbids mutable rule subscriptions and deleted parallel routes', () => {
    const violations: string[] = [];
    for (const root of [
      resolve(engineRoot, 'kernel'),
      resolve(engineRoot, 'effects'),
    ]) {
      for (const path of productionTypeScriptFiles(root)) {
        const current = repositoryPath(path);
        visit(parsed(path), node => {
          if (!ts.isCallExpression(node)) return;
          const calledName = ts.isIdentifier(node.expression)
            ? node.expression.text
            : ts.isPropertyAccessExpression(node.expression)
              ? node.expression.name.text
              : null;
          if (
            calledName
            && /^(?:subscribe|unsubscribe|register|unregister|addListener|removeListener)$/
              .test(calledName)
          ) {
            violations.push(`${current}: calls ${calledName}`);
          }
        });
      }
    }

    const deletedEntrypoints = [
      'evalEffect',
      'revealPlayedCard',
      'triggerOnReveal',
      'planEnemyTurnFromPool',
    ];
    const activeSources = productionTypeScriptFiles(playgameRoot)
      .map(path => readFileSync(path, 'utf8'))
      .join('\n');
    for (const entrypoint of deletedEntrypoints) {
      if (new RegExp(`\\b${entrypoint}\\b`).test(activeSources)) {
        violations.push(`deleted entrypoint returned: ${entrypoint}`);
      }
    }
    expect(existsSync(resolve(engineRoot, 'effects/evaluator.ts'))).toBe(false);
    expect(existsSync(resolve(engineRoot, 'effects/builtins.ts'))).toBe(false);
    expect(violations).toEqual([]);
  });
});

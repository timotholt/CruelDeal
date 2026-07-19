import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { Manifest, MatchRuleset } from '../engine/manifest/types';
import type {
  MatchBootstrap,
  MatchBootstrapValidationIssue,
  MatchRuntimeReplayExport,
  ValidatedMatchBootstrap,
} from './contracts';
import { validateMatchBootstrap } from './bootstrapValidation';
import { createMatchRuntime, type MatchRuntime } from './matchRuntime';
import { MatchPerformanceTelemetry } from './performanceTelemetry';

export class MatchSessionSetupError extends Error {
  readonly issues: readonly MatchBootstrapValidationIssue[];

  constructor(issues: readonly MatchBootstrapValidationIssue[]) {
    super(issues.map((issue) => issue.message).join('\n'));
    this.name = 'MatchSessionSetupError';
    this.issues = issues;
  }
}

/**
 * Local Phase 1 session owner. It retains descriptive bootstrap metadata while
 * MatchRuntime remains the only gameplay authority.
 */
export class MatchSession {
  readonly bootstrap: ValidatedMatchBootstrap;
  readonly manifest: Manifest;
  readonly ruleset: MatchRuleset;
  readonly runtime: MatchRuntime;
  readonly performanceTelemetry: MatchPerformanceTelemetry;

  private constructor(bootstrap: ValidatedMatchBootstrap, manifest: Manifest) {
    const ruleset = manifest.rulesets[bootstrap.rulesetId];
    if (!ruleset) throw new Error(`MatchSession: unresolved ruleset "${bootstrap.rulesetId}"`);
    this.bootstrap = bootstrap;
    this.manifest = manifest;
    this.ruleset = ruleset;
    this.performanceTelemetry = new MatchPerformanceTelemetry();
    this.runtime = createMatchRuntime({
      matchId: bootstrap.matchId,
      seed: bootstrap.seed,
      rulesetId: bootstrap.rulesetId,
      manifestVersion: bootstrap.manifestVersion,
      viewerSeat: bootstrap.viewerSeat,
      controllers: {
        P0: bootstrap.participants.P0.controller,
        P1: bootstrap.participants.P1.controller,
      },
      decks: {
        P0: bootstrap.decks.P0.entries,
        P1: bootstrap.decks.P1.entries,
      },
      locationDeck: bootstrap.decks.LOCATIONS.entries,
      debugDeterminism: bootstrap.mode === 'DEBUG',
      performanceTelemetry: this.performanceTelemetry,
    });
    Object.freeze(this);
  }

  static fromBootstrap(input: MatchBootstrap | unknown): MatchSession {
    const validation = validateMatchBootstrap(input, BOOTSTRAP_MANIFEST);
    if (!validation.ok) throw new MatchSessionSetupError(validation.issues);
    return new MatchSession(validation.value, BOOTSTRAP_MANIFEST);
  }

  exportReplay = (): MatchRuntimeReplayExport => Object.freeze({
    ...this.runtime.exportReplay(),
    bootstrap: this.bootstrap,
  });
}

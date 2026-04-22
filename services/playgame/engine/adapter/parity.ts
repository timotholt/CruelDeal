/**
 * Structural parity assertions between the UI's old MatchState and the
 * engine's shadow state. Dev-only (no-op in production builds).
 *
 * These checks don't compare BYTE-exact state — the two models have
 * different shapes. They compare STRUCTURAL INVARIANTS that should hold
 * no matter which codepath drove the mutation:
 *
 *   - turn number agrees
 *   - energy agrees
 *   - hand / lane sizes agree
 *   - priority agrees
 *   - per-lane power totals agree
 *
 * Any mismatch is a genuine bug in the engine's resolve/apply/projection.
 *
 * @migrate:step-8b — When the engine becomes authoritative, these
 * checks migrate into reverse-direction "UI reflects engine" assertions.
 */

import type { MatchState as OldMatchState } from '../../types';
import type { MatchState as EngineMatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import { getLanePower } from '../projections';

export interface ParityMismatch {
  readonly field: string;
  readonly old: unknown;
  readonly engine: unknown;
}

export interface ParityReport {
  readonly ok: boolean;
  readonly mismatches: readonly ParityMismatch[];
}

export function checkParity(
  oldState: OldMatchState,
  engineState: EngineMatchState,
  manifest: Manifest,
): ParityReport {
  const mismatches: ParityMismatch[] = [];
  const diff = (field: string, o: unknown, e: unknown) => {
    if (JSON.stringify(o) !== JSON.stringify(e)) {
      mismatches.push({ field, old: o, engine: e });
    }
  };

  diff('turn',      oldState.turn,           engineState.turn);
  diff('energy',    oldState.energy,         engineState.energy.PLAYER);
  diff('energyMax', oldState.energyMax,      engineState.maxEnergy);
  diff(
    'priority',
    oldState.playerHasPriority ? 'PLAYER' : 'OPP',
    engineState.priority,
  );
  diff('hand.length', oldState.hand.length,  engineState.hand.PLAYER.length);

  for (let i = 0; i < 3; i++) {
    const lane = i as 0 | 1 | 2;
    diff(
      `lanes[${i}].PLAYER.length`,
      oldState.lanes[i].length,
      engineState.lanes[i].cards.PLAYER.length,
    );
    diff(
      `lanes[${i}].OPP.length`,
      oldState.enemyLanes[i].length,
      engineState.lanes[i].cards.OPP.length,
    );

    // Power totals: sum revealed cards on each side. The old model has
    // no Ongoing concept so its "power" is the raw per-card stat. The
    // engine adds Ongoing buffs on top, so equality holds ONLY when no
    // Ongoings are active. We lift this assertion once Step 8b kicks in.
    const oldP = sumRevealedPower(oldState.lanes[i], oldState.pending);
    const oldO = sumRevealedPower(oldState.enemyLanes[i], oldState.pending);
    const engP = getLanePower(engineState, lane, 'PLAYER', manifest);
    const engO = getLanePower(engineState, lane, 'OPP', manifest);
    // Only flag DIVERGENCES, not engine-exceeds-old (engine applies
    // Ongoings; old doesn't; engine should be >= old).
    if (engP < oldP) {
      mismatches.push({ field: `lanes[${i}].PLAYER.power`, old: oldP, engine: engP });
    }
    if (engO < oldO) {
      mismatches.push({ field: `lanes[${i}].OPP.power`, old: oldO, engine: engO });
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

function sumRevealedPower(
  lane: readonly { id: string; power: number }[],
  pending: readonly string[],
): number {
  const pendSet = new Set(pending);
  let sum = 0;
  for (const c of lane) {
    if (!pendSet.has(c.id)) sum += c.power;
  }
  return sum;
}

/** Log a mismatch to console.warn in dev builds; no-op in production. */
export function reportParity(report: ParityReport, label: string): void {
  if (report.ok) return;
  // `import.meta.env` is a Vite-ism — undefined under Node test runners.
  // Fall back to a safe "dev default" when unavailable.
  const isDev =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { DEV?: boolean } }).env?.DEV !== false;
  if (!isDev) return;
  console.warn(
    `[engine-bridge] parity mismatch @ ${label}:`,
    report.mismatches,
  );
}

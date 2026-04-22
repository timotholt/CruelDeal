/**
 * Engine bridge (Step 8a) — runs the pure engine in a SHADOW alongside
 * the UI's existing MatchState, driving it via the same high-level
 * user actions (stage / unstage / end-turn) that the UI performs.
 *
 * The bridge does NOT replace the old flow. It observes.
 *
 * Lifecycle:
 *   1. `mountBridge(oldState, manifest, seed)` — constructs a bridge from
 *      the initial old state. Returns null if translation failed (unknown
 *      card defIds); bridge becomes a no-op in that case.
 *   2. Each UI action calls the matching bridge method:
 *        - `stage(cardId, lane, owner)`
 *        - `unstage(cardId, owner)`
 *        - `endTurn()`
 *   3. After each UI mutation, caller invokes `assertParity(oldState)`.
 *
 * @migrate:step-8b Promote the bridge from shadow to authoritative.
 * @migrate:step-8c Delete the old MatchState; bridge becomes the store.
 */

import type { MatchState as OldMatchState } from '../../types';
import type { MatchEvent } from '../types/events';
import type { MatchState as EngineMatchState } from '../types/state';
import type { CardId, LaneIdx, Owner } from '../types/ids';
import type { Manifest } from '../manifest/types';
import type { Rng } from '../rng';
import { createRng } from '../rng';
import { apply } from '../apply';
import { resolve, resolveTurn } from '../resolve';
import { liftMatchState, nameToDefId } from './translate';
import { checkParity, reportParity } from './parity';

export interface Bridge {
  /** Current engine state. Read-only. */
  getState(): EngineMatchState;
  /** Shadow-apply a STAGE_CARD. */
  stage(cardId: string, lane: LaneIdx, owner?: Owner): readonly MatchEvent[];
  /** Shadow-apply an UNSTAGE_CARD. */
  unstage(cardId: string, owner?: Owner): readonly MatchEvent[];
  /** Shadow-apply an END_TURN cascade. */
  endTurn(): readonly MatchEvent[];
  /** Validate structural invariants against the UI's old state. */
  assertParity(oldState: OldMatchState, label: string): void;
  /** Forcibly re-seed the engine state from a fresh old state. */
  reset(oldState: OldMatchState): boolean;
  /** Register a card in hand (used when UI draws without going through a
   *  deck the engine can see). Emits CARD_ADDED_TO_HAND as a synthetic
   *  event so projections and provenance stay consistent. */
  syncHandCard(cardId: string, defIdOrName: string, owner: Owner): void;
  /** True when the bridge is active; false when translation failed at
   *  mount and everything became a no-op. */
  readonly active: boolean;
}

export interface BridgeOptions {
  /** Required. The engine is pure and disallows wallclock time — callers
   *  outside the engine boundary must supply a seed (typically derived
   *  from a session id or match id on the client). */
  readonly seed: string;
  readonly onEvents?: (events: readonly MatchEvent[], label: string) => void;
}

let intentCounter = 0;
const nextIntentId = () => `bridge-${++intentCounter}`;

/**
 * Construct a bridge. Returns a no-op bridge if the old state can't be
 * translated — callers can safely invoke methods in either case.
 */
export function mountBridge(
  oldState: OldMatchState,
  manifest: Manifest,
  options: BridgeOptions,
): Bridge {
  const seed = options.seed;
  const rngRoot: Rng = createRng(seed);
  let engineState: EngineMatchState | null = liftMatchState(oldState, manifest, seed);
  const active = engineState !== null;

  if (!active) {
    // Return a stub bridge that silently skips every call. Keeps
    // callers from needing if-checks at every site.
    return makeInactiveBridge();
  }

  const getState = (): EngineMatchState => {
    if (!engineState) throw new Error('bridge: engineState null after active check');
    return engineState;
  };

  const fire = (
    events: readonly MatchEvent[],
    label: string,
  ): readonly MatchEvent[] => {
    for (const e of events) {
      engineState = apply(engineState!, e, manifest);
    }
    options.onEvents?.(events, label);
    return events;
  };

  const stage = (cardId: string, lane: LaneIdx, owner: Owner = 'PLAYER'): readonly MatchEvent[] => {
    const events = resolve(
      engineState!,
      { type: 'STAGE_CARD', intentId: nextIntentId(), owner, cardId: cardId as CardId, lane },
      rngRoot,
      manifest,
    );
    return fire(events, `stage(${cardId}, lane ${lane})`);
  };

  const unstage = (cardId: string, owner: Owner = 'PLAYER'): readonly MatchEvent[] => {
    const events = resolve(
      engineState!,
      { type: 'UNSTAGE_CARD', intentId: nextIntentId(), owner, cardId: cardId as CardId },
      rngRoot,
      manifest,
    );
    return fire(events, `unstage(${cardId})`);
  };

  const endTurn = (): readonly MatchEvent[] => {
    const { events, state: next } = resolveTurn(
      engineState!,
      manifest,
      rngRoot.fork(`turn:${engineState!.turn}`),
    );
    engineState = next;
    options.onEvents?.(events, 'endTurn');
    return events;
  };

  const assertParity = (old: OldMatchState, label: string): void => {
    const report = checkParity(old, engineState!, manifest);
    reportParity(report, label);
  };

  const reset = (old: OldMatchState): boolean => {
    const next = liftMatchState(old, manifest, seed);
    if (!next) return false;
    engineState = next;
    return true;
  };

  const syncHandCard = (cardId: string, defIdOrName: string, owner: Owner): void => {
    if (!engineState) return;
    const defId = manifest.cards[defIdOrName] ? defIdOrName : nameToDefId(defIdOrName);
    if (!manifest.cards[defId]) {
      // Unknown to engine — soft-warn but don't break the UI.
      if (typeof console !== 'undefined') console.warn(`[engine-bridge] syncHandCard: unknown defId "${defIdOrName}"`);
      return;
    }
    const event: MatchEvent = {
      type: 'CARD_ADDED_TO_HAND',
      owner,
      cardId: cardId as CardId,
      defId,
      spawnSource: { kind: 'DECK_CREATION' },
    };
    engineState = apply(engineState, event, manifest);
    options.onEvents?.([event], `syncHandCard(${cardId})`);
  };

  return {
    get active() { return true; },
    getState,
    stage,
    unstage,
    endTurn,
    assertParity,
    reset,
    syncHandCard,
  };
}

function makeInactiveBridge(): Bridge {
  const noEvents: readonly MatchEvent[] = [];
  return {
    active: false,
    getState: () => {
      throw new Error('bridge: inactive (state translation failed at mount)');
    },
    stage: () => noEvents,
    unstage: () => noEvents,
    endTurn: () => noEvents,
    assertParity: () => { /* no-op */ },
    reset: () => false,
    syncHandCard: () => { /* no-op */ },
  };
}

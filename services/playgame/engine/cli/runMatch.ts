/**
 * Headless match driver — Step 9.
 *
 * Runs a full match end-to-end with no DOM, no Solid, no script engine.
 * Both sides play through the deterministic AI in `./ai.ts`. Every event
 * funnels through the same `apply()` reducer the UI uses, so this is a
 * faithful replay of what a real client session would produce given the
 * same seed.
 *
 * Success criterion (see ROADMAP step 9): "A Node CLI can run a full
 * match end-to-end with zero browser."
 */

import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';
import type { CanonicalFrame, TimelinePhase } from '../types/timeline';
import type { Manifest } from '../manifest/types';
import type { Owner } from '../types/ids';
import { resolve, type ResolveResult } from '../resolve';
import { createRng, type Rng } from '../rng';
import { appendGameplayRngResolution } from '../rng/transaction';
import {
  createSetupMatch,
  type InitialLocationDeck,
} from './initState';
import { planEnemyTurnFromHand } from '../ai';
import { frameAndFoldResolution } from '../transactionTimeline';

export interface RunMatchOptions {
  readonly seed: string;
  readonly manifest: Manifest;
  /** Complete ordered third-deck input; the engine never selects locations. */
  readonly locationDeck: InitialLocationDeck;
  /** Optional observer invoked for every emitted event, in order. */
  readonly onEvent?: (event: MatchEvent, state: MatchState) => void;
  /** Hard safety cap: abort if we somehow loop past this many turns. */
  readonly maxTurns?: number;
}

export interface RunMatchResult {
  readonly finalState: MatchState;
  readonly events: readonly MatchEvent[];
  readonly frames: readonly CanonicalFrame[];
  readonly turnsPlayed: number;
}

function commitBatch(
  transactionId: string,
  state: MatchState,
  resolution: ResolveResult,
  manifest: Manifest,
  onEvent: (e: MatchEvent, s: MatchState) => void,
  allEvents: MatchEvent[],
  allCanonicalFrames: CanonicalFrame[],
  initialPhase?: TimelinePhase,
  rng?: Rng,
): MatchState {
  const committed = rng
    ? appendGameplayRngResolution(state, rng, resolution)
    : resolution;
  if (committed.events.length === 0 && committed.resolutionSteps.length === 0) {
    return state;
  }
  const transaction = frameAndFoldResolution({
    transactionId,
    initialState: state,
    events: committed.events,
    resolutionSteps: committed.resolutionSteps,
    manifest,
    ...(initialPhase === undefined ? {} : { initialPhase }),
  });
  for (const transition of transaction.transitions) {
    allCanonicalFrames.push(transition.canonicalFrame);
    if (transition.event !== null) {
      allEvents.push(transition.event);
      onEvent(transition.event, transition.before);
    }
  }
  return transaction.finalState;
}

/** Drive one turn: both sides stage via AI, then END_TURN cascades. */
function runOneTurn(
  state: MatchState,
  manifest: Manifest,
  rng: Rng,
  onEvent: (e: MatchEvent, s: MatchState) => void,
  allEvents: MatchEvent[],
  allCanonicalFrames: CanonicalFrame[],
): MatchState {
  let s = state;

  // Priority owner stages first — purely cosmetic here (resolveTurn decides
  // the reveal order independently) but keeps the event timeline readable.
  const first: Owner = s.priority;
  const second: Owner = first === 'P0' ? 'P1' : 'P0';

  for (const owner of [first, second] as const) {
    const plan = planEnemyTurnFromHand(s, owner, manifest, rng, {
      forkTag: `plan:${owner}:${s.turn}`,
    });
    for (const step of plan) {
      const resolution = resolve(
        s,
        {
          type: 'STAGE_CARD',
          intentId: `${owner}-${step.cardId}-t${s.turn}`,
          owner,
          cardId: step.cardId,
          lane: step.lane,
        },
        rng.scope(`stage:${owner}:${step.cardId}`),
        manifest,
      );
      if (
        resolution.events.length
        && resolution.events[0].type === 'INTENT_REJECTED'
      ) {
        // AI emitted an invalid plan. Retain the diagnostic in canonical
        // history without mutating mechanics beyond the timeline coordinate.
        s = commitBatch(
          `cli:stage-rejected:${owner}:${step.cardId}:turn:${s.turn}`,
          s,
          {
            events: [resolution.events[0]],
            resolutionSteps: [{ transitionIndex: 0, effect: null }],
          },
          manifest,
          onEvent,
          allEvents,
          allCanonicalFrames,
          undefined,
          rng,
        );
        continue;
      }
      s = commitBatch(
        `cli:stage:${owner}:${step.cardId}:turn:${s.turn}`,
        s,
        resolution,
        manifest,
        onEvent,
        allEvents,
        allCanonicalFrames,
        undefined,
        rng,
      );
    }
  }

  // END_TURN — runs the full resolveTurn cascade (reveals, draws, energy,
  // next-turn priority). `resolve` returns its events; we apply them all.
  const endResolution = resolve(
    s,
    { type: 'END_TURN', intentId: `end-t${s.turn}`, owner: s.priority },
    rng.scope(`endturn:${s.turn}`),
    manifest,
  );
  return commitBatch(
    `cli:end-turn:${s.turn}`,
    s,
    endResolution,
    manifest,
    onEvent,
    allEvents,
    allCanonicalFrames,
    undefined,
    rng,
  );
}

/**
 * Run a full match. Returns the final state, complete raw/framed events, and
 * the number of turns actually played (may be less than the manifest's
 * turn limit if one side concedes — though the AI never concedes yet).
 */
export function runMatch(opts: RunMatchOptions): RunMatchResult {
  const { seed, manifest, locationDeck } = opts;
  const cap = opts.maxTurns ?? manifest.constants.turnLimit + 2;
  const events: MatchEvent[] = [];
  const frames: CanonicalFrame[] = [];
  const onEvent = opts.onEvent ?? ((): void => undefined);

  const setup = createSetupMatch(seed, manifest, {}, locationDeck);
  for (const transaction of [setup.locationSetup, setup.opening]) {
    for (const transition of transaction.transitions) {
      frames.push(transition.canonicalFrame);
      if (transition.event !== null) {
        events.push(transition.event);
        onEvent(transition.event, transition.before);
      }
    }
  }
  let state = setup.state;
  const rng = createRng(state.rng);

  let turnsPlayed = 0;
  while (state.result === null && state.phase !== 'ENDED' && turnsPlayed < cap) {
    const startTurn = state.turn;
    state = runOneTurn(
      state,
      manifest,
      rng,
      onEvent,
      events,
      frames,
    );
    turnsPlayed += 1;
    // Safety: if the turn counter failed to advance and the match didn't
    // end, bail out to avoid an infinite loop.
    if (state.turn === startTurn && state.result === null) break;
  }

  return { finalState: state, events, frames, turnsPlayed };
}

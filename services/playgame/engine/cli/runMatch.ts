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
import type { Manifest } from '../manifest/types';
import type { Owner } from '../types/ids';
import { apply } from '../apply';
import { resolve } from '../resolve';
import { createRng, type Rng } from '../rng';
import { createInitialMatchState } from './initState';
import { planEnemyTurnFromHand } from '../ai';

export interface RunMatchOptions {
  readonly seed: string;
  readonly manifest: Manifest;
  /** Optional observer invoked for every emitted event, in order. */
  readonly onEvent?: (event: MatchEvent, state: MatchState) => void;
  /** Hard safety cap: abort if we somehow loop past this many turns. */
  readonly maxTurns?: number;
}

export interface RunMatchResult {
  readonly finalState: MatchState;
  readonly events: readonly MatchEvent[];
  readonly turnsPlayed: number;
}

/** Drive one turn: both sides stage via AI, then END_TURN cascades. */
function runOneTurn(
  state: MatchState,
  manifest: Manifest,
  rng: Rng,
  onEvent: (e: MatchEvent, s: MatchState) => void,
  allEvents: MatchEvent[],
): MatchState {
  let s = state;

  // Priority owner stages first — purely cosmetic here (resolveTurn decides
  // the reveal order independently) but keeps the event log readable.
  const first: Owner = s.priority;
  const second: Owner = first === 'P0' ? 'P1' : 'P0';

  for (const owner of [first, second] as const) {
    const plan = planEnemyTurnFromHand(s, owner, manifest, rng, {
      forkTag: `plan:${owner}:${s.turn}`,
    });
    for (const step of plan) {
      const events = resolve(
        s,
        {
          type: 'STAGE_CARD',
          intentId: `${owner}-${step.cardId}-t${s.turn}`,
          owner,
          cardId: step.cardId,
          lane: step.lane,
        },
        rng.fork(`stage:${owner}:${step.cardId}`),
        manifest,
      );
      if (events.length && events[0].type === 'INTENT_REJECTED') {
        // AI emitted an invalid plan — skip and log; the match keeps moving.
        allEvents.push(events[0]);
        onEvent(events[0], s);
        continue;
      }
      for (const e of events) {
        allEvents.push(e);
        onEvent(e, s);
        s = apply(s, e, manifest);
      }
    }
  }

  // END_TURN — runs the full resolveTurn cascade (reveals, draws, energy,
  // next-turn priority). `resolve` returns its events; we apply them all.
  const endEvents = resolve(
    s,
    { type: 'END_TURN', intentId: `end-t${s.turn}`, owner: s.priority },
    rng.fork(`endturn:${s.turn}`),
    manifest,
  );
  for (const e of endEvents) {
    allEvents.push(e);
    onEvent(e, s);
    s = apply(s, e, manifest);
  }
  return s;
}

/**
 * Run a full match. Returns the final state, the complete event log, and
 * the number of turns actually played (may be less than the manifest's
 * turn limit if one side concedes — though the AI never concedes yet).
 */
export function runMatch(opts: RunMatchOptions): RunMatchResult {
  const { seed, manifest } = opts;
  const cap = opts.maxTurns ?? manifest.constants.turnLimit + 2;
  const rng = createRng(seed);
  const events: MatchEvent[] = [];
  const onEvent = opts.onEvent ?? ((): void => undefined);

  let state = createInitialMatchState(seed, manifest);

  // Opening draws — `manifest.constants` doesn't define a starting hand
  // size yet, so just draw 3 per side via the normal CARD_DRAWN pipeline.
  // Pull off each deck's top without going through `resolve` (no intent
  // exists for initial draws).
  const OPENING_DRAW = 3;
  for (const owner of ['P0', 'P1'] as const) {
    for (let i = 0; i < OPENING_DRAW; i++) {
      const top = state.deck[owner][0];
      if (!top) break;
      const drawEvt: MatchEvent = { type: 'CARD_DRAWN', owner, cardId: top.id, toHand: true };
      events.push(drawEvt);
      onEvent(drawEvt, state);
      state = apply(state, drawEvt, manifest);
    }
  }

  let turnsPlayed = 0;
  while (state.result === null && state.phase !== 'ENDED' && turnsPlayed < cap) {
    const startTurn = state.turn;
    state = runOneTurn(state, manifest, rng, onEvent, events);
    turnsPlayed += 1;
    // Safety: if the turn counter failed to advance and the match didn't
    // end, bail out to avoid an infinite loop.
    if (state.turn === startTurn && state.result === null) break;
  }

  return { finalState: state, events, turnsPlayed };
}

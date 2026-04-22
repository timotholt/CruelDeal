/**
 * resolve(state, intent, rng, manifest) → MatchEvent[]
 * resolveTurn(state, manifest, rng) → { events, state }
 *
 * Two entry points of the engine's authoritative step:
 *
 *   - `resolve` is the intent validator + translator: stage/unstage/undo/
 *     concede/end-turn intents become event streams, or yield a single
 *     `INTENT_REJECTED` entry when the intent is invalid.
 *   - `resolveTurn` is the full turn-end cascade: flip priority-ordered
 *     reveals, run OR evaluators, reveal next location, refill energy,
 *     draw, and emit `TURN_ENDED`/`TURN_STARTED` bookends. At turn 6 it
 *     emits `MATCH_ENDED` instead of restarting.
 *
 * See spec §7 and §6.1.
 */

import type { MatchEvent } from './types/events';
import type { MatchIntent } from './types/intents';
import type { CardInstance, MatchResult, MatchState } from './types/state';
import type { LaneIdx, Owner } from './types/ids';
import type { Manifest } from './manifest/types';
import type { Rng } from './rng';
import { apply } from './apply';
import { revealCard } from './effects/evaluator';
import { getLanePower } from './projections/power';

// ============================================================================
// resolve — intent → events
// ============================================================================

export function resolve(
  state: MatchState,
  intent: MatchIntent,
  rng: Rng,
  manifest: Manifest,
): MatchEvent[] {
  switch (intent.type) {
    case 'STAGE_CARD':   return resolveStage(state, intent, manifest);
    case 'UNSTAGE_CARD': return resolveUnstage(state, intent, manifest);
    case 'UNDO_TURN':    return resolveUndoTurn(state, intent, manifest);
    case 'END_TURN':     return resolveTurn(state, manifest, rng.fork(`turn:${state.turn}`)).events as MatchEvent[];
    case 'CONCEDE':      return resolveConcede(state, intent);
  }
}

function reject(intentId: string, reason: string): MatchEvent[] {
  return [{ type: 'INTENT_REJECTED', intentId, reason }];
}

function resolveStage(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'STAGE_CARD' }>,
  manifest: Manifest,
): MatchEvent[] {
  const card = state.cards[intent.cardId];
  if (!card) return reject(intent.intentId, `unknown card ${intent.cardId}`);
  if (card.owner !== intent.owner) return reject(intent.intentId, 'card owner mismatch');
  if (card.zone !== 'HAND') return reject(intent.intentId, 'card not in hand');
  const def = manifest.cards[card.defId];
  if (!def) return reject(intent.intentId, `unknown defId ${card.defId}`);

  const lane = state.lanes[intent.lane];
  if (lane.cards[intent.owner].length >= manifest.constants.laneCapacity) {
    return reject(intent.intentId, 'lane full');
  }
  if (state.energy[intent.owner] < def.cost) {
    return reject(intent.intentId, 'insufficient energy');
  }

  return [
    {
      type: 'CARD_STAGED',
      intentId: intent.intentId,
      cardId: intent.cardId,
      lane: intent.lane,
      owner: intent.owner,
      cost: def.cost,
    },
    {
      type: 'ENERGY_CHANGED',
      owner: intent.owner,
      delta: -def.cost,
      reason: 'CARD_PLAYED',
    },
  ];
}

function resolveUnstage(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'UNSTAGE_CARD' }>,
  manifest: Manifest,
): MatchEvent[] {
  const card = state.cards[intent.cardId];
  if (!card) return reject(intent.intentId, `unknown card ${intent.cardId}`);
  if (card.owner !== intent.owner) return reject(intent.intentId, 'card owner mismatch');
  if (card.revealed) return reject(intent.intentId, 'cannot unstage a revealed card');
  if (!state.stagingOrder.includes(intent.cardId)) {
    return reject(intent.intentId, 'card not in staging order');
  }
  const def = manifest.cards[card.defId];
  const refund = def?.cost ?? 0;

  return [
    { type: 'CARD_UNSTAGED', intentId: intent.intentId, cardId: intent.cardId },
    { type: 'ENERGY_CHANGED', owner: intent.owner, delta: refund, reason: 'CARD_UNSTAGED' },
  ];
}

function resolveUndoTurn(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'UNDO_TURN' }>,
  manifest: Manifest,
): MatchEvent[] {
  // Iterate in REVERSE stage order so each unstage's lane-capacity
  // precondition stays satisfied during replay.
  const mine = state.stagingOrder
    .filter(id => state.cards[id]?.owner === intent.owner)
    .slice()
    .reverse();
  const events: MatchEvent[] = [];
  for (const id of mine) {
    const card = state.cards[id];
    if (!card) continue;
    const def = manifest.cards[card.defId];
    events.push({ type: 'CARD_UNSTAGED', intentId: intent.intentId, cardId: id });
    events.push({
      type: 'ENERGY_CHANGED',
      owner: intent.owner,
      delta: def?.cost ?? 0,
      reason: 'CARD_UNSTAGED',
    });
  }
  return events;
}

function resolveConcede(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'CONCEDE' }>,
): MatchEvent[] {
  const winner: Owner = intent.owner === 'PLAYER' ? 'OPP' : 'PLAYER';
  return [
    {
      type: 'MATCH_ENDED',
      result: {
        winner,
        lanesWon: { PLAYER: 0, OPP: 0 } as Record<Owner, number>,
        totalPower: { PLAYER: 0, OPP: 0 } as Record<Owner, number>,
      },
    },
  ];
}

// ============================================================================
// resolveTurn — full turn cascade
// ============================================================================

export interface ResolveTurnResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

export function resolveTurn(
  state: MatchState,
  manifest: Manifest,
  rng: Rng,
): ResolveTurnResult {
  const events: MatchEvent[] = [];
  let s = state;

  // Phase 1: Flip and reveal all staged cards in priority order.
  const priorityOwner = s.priority;
  const order: Owner[] = priorityOwner === 'PLAYER' ? ['PLAYER', 'OPP'] : ['OPP', 'PLAYER'];
  for (const owner of order) {
    const mine = s.stagingOrder.filter(id => s.cards[id]?.owner === owner);
    for (const cardId of mine) {
      const subRng = rng.fork(`reveal:${owner}:${cardId}`);
      const res = revealCard(s, cardId, manifest, subRng);
      events.push(...res.events);
      s = res.state;
    }
  }

  // Phase 2: Match end?
  if (s.turn >= manifest.constants.turnLimit) {
    const result = computeMatchResult(s, manifest);
    const endEvt: MatchEvent = { type: 'MATCH_ENDED', result };
    events.push(endEvt);
    s = apply(s, endEvt, manifest);
    return { events, state: s };
  }

  // Phase 3: End the current turn (clears transient tags + stagingOrder).
  const turnEnded: MatchEvent = { type: 'TURN_ENDED', turn: s.turn };
  events.push(turnEnded);
  s = apply(s, turnEnded, manifest);

  const nextTurn = s.turn + 1;

  // Phase 4: Reveal the location for the upcoming turn (turns 1-3 only).
  if (nextTurn <= 3) {
    const laneIdx = (nextTurn - 1) as LaneIdx;
    const loc = s.lanes[laneIdx].location;
    if (loc && !s.lanes[laneIdx].locationRevealed) {
      const revealEvt: MatchEvent = {
        type: 'LOCATION_REVEALED',
        lane: laneIdx,
        locationId: loc.id,
      };
      events.push(revealEvt);
      s = apply(s, revealEvt, manifest);
    }
  }

  // Phase 5: Draws (1 per owner per turn, hand-cap permitting).
  for (const owner of ['PLAYER', 'OPP'] as const) {
    const draws = drawStep(s, owner, 1, manifest);
    for (const e of draws) {
      events.push(e);
      s = apply(s, e, manifest);
    }
  }

  // Phase 6: Refill energy to nextTurn's curve value.
  const curve = manifest.constants.energyCurve;
  const target = curve[Math.min(nextTurn, curve.length) - 1] ?? nextTurn;
  for (const owner of ['PLAYER', 'OPP'] as const) {
    const delta = target - s.energy[owner];
    if (delta === 0) continue;
    const e: MatchEvent = { type: 'ENERGY_CHANGED', owner, delta, reason: 'TURN_START' };
    events.push(e);
    s = apply(s, e, manifest);
  }

  // Phase 7: Compute priority for the upcoming turn, then TURN_STARTED.
  // Using the projected state AFTER draws/energy — priority reads board
  // power only, which draws can't change, but we keep the order
  // consistent with spec §5.
  const newPriority = computePriorityForNextTurn(s, manifest, rng.fork(`priority:${nextTurn}`));
  const started: MatchEvent = {
    type: 'TURN_STARTED',
    turn: nextTurn,
    priority: newPriority.owner,
    priorityReason: newPriority.reason,
  };
  events.push(started);
  s = apply(s, started, manifest);

  return { events, state: s };
}

// ============================================================================
// Helpers
// ============================================================================

function drawStep(
  state: MatchState,
  owner: Owner,
  count: number,
  manifest: Manifest,
): MatchEvent[] {
  const events: MatchEvent[] = [];
  let deckLen = state.deck[owner].length;
  let handLen = state.hand[owner].length;
  let idx = 0;
  while (idx < count && deckLen > 0 && handLen < manifest.constants.handCap) {
    const top = state.deck[owner][idx] as CardInstance | undefined;
    if (!top) break;
    events.push({ type: 'CARD_DRAWN', owner, cardId: top.id, toHand: true });
    idx++;
    deckLen--;
    handLen++;
  }
  return events;
}

function computeMatchResult(state: MatchState, manifest: Manifest): MatchResult {
  let lanesP = 0;
  let lanesO = 0;
  let totP = 0;
  let totO = 0;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIdx;
    const p = getLanePower(state, lane, 'PLAYER', manifest);
    const o = getLanePower(state, lane, 'OPP', manifest);
    totP += p;
    totO += o;
    if (p > o) lanesP++;
    else if (o > p) lanesO++;
  }
  const winner: Owner | 'DRAW' =
      lanesP > lanesO ? 'PLAYER'
    : lanesO > lanesP ? 'OPP'
    : totP > totO     ? 'PLAYER'
    : totO > totP     ? 'OPP'
    :                   'DRAW';
  return {
    winner,
    lanesWon:   { PLAYER: lanesP, OPP: lanesO } as Record<Owner, number>,
    totalPower: { PLAYER: totP,   OPP: totO   } as Record<Owner, number>,
  };
}

function computePriorityForNextTurn(
  state: MatchState,
  manifest: Manifest,
  rng: Rng,
): { owner: Owner; reason: 'MORE_LANES' | 'MORE_POWER' | 'COIN_FLIP' } {
  let lanesP = 0;
  let lanesO = 0;
  let totP = 0;
  let totO = 0;
  for (let i = 0; i < 3; i++) {
    const lane = i as LaneIdx;
    const p = getLanePower(state, lane, 'PLAYER', manifest);
    const o = getLanePower(state, lane, 'OPP', manifest);
    totP += p;
    totO += o;
    if (p > o) lanesP++;
    else if (o > p) lanesO++;
  }
  if (lanesP !== lanesO) {
    return { owner: lanesP > lanesO ? 'PLAYER' : 'OPP', reason: 'MORE_LANES' };
  }
  if (totP !== totO) {
    return { owner: totP > totO ? 'PLAYER' : 'OPP', reason: 'MORE_POWER' };
  }
  return { owner: rng.int(0, 1) === 0 ? 'PLAYER' : 'OPP', reason: 'COIN_FLIP' };
}

// Re-exports for Step 8+ wiring convenience.
export type { Rng };

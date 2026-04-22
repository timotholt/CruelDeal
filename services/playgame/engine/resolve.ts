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
import type { CardInstance, MatchResult, MatchState, PendingEffect } from './types/state';
import type { CardId, LaneIdx, Owner } from './types/ids';
import type { Manifest } from './manifest/types';
import type { Rng } from './rng';
import { apply } from './apply';
import { revealCard, evalEffect, type EffectCtx } from './effects/evaluator';
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

  // ─── Phase 1  Reveals (priority-ordered) ─────────────────────────────────
  // Priority holder's cards flip first, in stage order; then the other side.
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

  // ─── END-OF-TURN BOOKKEEPING ─────────────────────────────────────────────
  // Finish the current turn BEFORE checking for a winner. End-of-turn
  // location effects (Rickety Bridge destroying the lane, Death's Domain
  // killing drawn cards, etc.) fire while cleanup runs, so their side-
  // effects count toward the final board state.
  //
  // Phase 1.9  `onEndOfTurn` card triggers. Fixed iteration order:
  //            lane 0 → 1 → 2, within each lane PLAYER cards first (in
  //            stage order), then OPP cards. Only revealed cards fire;
  //            pending (face-down) cards do not. Each trigger runs with
  //            the card as SELF and a forked RNG keyed on cardId + exprIdx.
  {
    const triggerFires: { cardId: CardId; effects: readonly import('./types/ability').EffectExpr[] }[] = [];
    for (let lane = 0 as LaneIdx; lane <= 2; lane = (lane + 1) as LaneIdx) {
      for (const owner of ['PLAYER', 'OPP'] as const) {
        const ids = s.lanes[lane].cards[owner];
        for (const id of ids) {
          const card = s.cards[id];
          if (!card || !card.revealed) continue;
          const def = manifest.cards[card.defId];
          const effs = def?.abilities.onEndOfTurn;
          if (!effs || effs.length === 0) continue;
          triggerFires.push({ cardId: id, effects: effs });
        }
      }
    }
    for (let i = 0; i < triggerFires.length; i++) {
      const { cardId, effects: effs } = triggerFires[i];
      for (let j = 0; j < effs.length; j++) {
        const card = s.cards[cardId];
        if (!card) break; // destroyed by a previous trigger this phase
        const subCtx: EffectCtx = {
          state: s,
          manifest,
          self: cardId,
          selfKind: 'card',
          selfLane: card.lane,
          selfOwner: card.owner,
          rng: rng.fork(`eot:${cardId}:${j}`),
          source: { sourceId: cardId, effectKind: 'ON_REVEAL', exprIdx: j },
          depth: 0,
        };
        const res = evalEffect(s, effs[j], subCtx, manifest);
        events.push(...res.events);
        s = res.state;
      }
    }
  }

  // Phase 2  TURN_ENDED — clears transient tags (DESTROYED_THIS_TURN,
  //          MOVED_THIS_TURN) + stagingOrder. `@migrate:atTurnEnd` is where
  //          location `atTurnEnd` abilities will be dispatched in a later
  //          tier; they must run BEFORE this cleanup event.
  const turnEnded: MatchEvent = { type: 'TURN_ENDED', turn: s.turn };
  events.push(turnEnded);
  s = apply(s, turnEnded, manifest);

  // Phase 3  Winner check — only after all end-of-turn bookkeeping has
  //          settled. If the last turn just finished, the match ends here
  //          and NO start-of-turn bookkeeping runs.
  if (s.turn >= manifest.constants.turnLimit) {
    const result = computeMatchResult(s, manifest);
    const endEvt: MatchEvent = { type: 'MATCH_ENDED', result };
    events.push(endEvt);
    s = apply(s, endEvt, manifest);
    return { events, state: s };
  }

  // ─── START-OF-TURN BOOKKEEPING ───────────────────────────────────────────
  // Deliberate order: energy → priority → draw → location reveal.
  //
  //   Energy first so "+N energy next turn" effects (Psylocke, Electra,
  //   etc.) resolve before anything consumes or displays the new pool.
  //
  //   Priority next so it's decided on the clean post-TURN_ENDED board —
  //   no drawn cards, no newly-revealed location in the picture.
  //
  //   Draws run after priority because drawing can't change priority
  //   (hand contents don't feed the priority computation) but effects
  //   that react to "card drawn" expect the priority holder for this
  //   turn to already be known.
  //
  //   Location reveal is last — it's a player-facing cinematic, and any
  //   Ongoing effect tied to the location should kick in after draws and
  //   energy are already settled.
  const nextTurn = s.turn + 1;

  // Phase 4  Ramp `maxEnergy` (+1 per owner), refill `energy` to
  //          `maxEnergy + nextTurnEnergyBonus`, then consume the bonus.
  //          Event order per owner:
  //            1. MAX_ENERGY_CHANGED  (ramp ceiling by +1)
  //            2. ENERGY_CHANGED      (refill current to new ceiling + bonus)
  //            3. NEXT_TURN_ENERGY_BONUS_CHANGED (zero the one-shot bonus)
  //          Mirrors: `currentEnergy = maxEnergy + energyEarnedLastTurn`.
  for (const owner of ['PLAYER', 'OPP'] as const) {
    const ramp: MatchEvent = {
      type: 'MAX_ENERGY_CHANGED',
      owner,
      delta: 1,
      reason: 'TURN_START',
    };
    events.push(ramp);
    s = apply(s, ramp, manifest);

    const bonus = s.nextTurnEnergyBonus[owner];
    const target = s.maxEnergy[owner] + bonus;
    const refillDelta = target - s.energy[owner];
    if (refillDelta !== 0) {
      const refill: MatchEvent = {
        type: 'ENERGY_CHANGED',
        owner,
        delta: refillDelta,
        reason: 'TURN_START',
      };
      events.push(refill);
      s = apply(s, refill, manifest);
    }

    if (bonus !== 0) {
      const consume: MatchEvent = {
        type: 'NEXT_TURN_ENERGY_BONUS_CHANGED',
        owner,
        delta: -bonus,
      };
      events.push(consume);
      s = apply(s, consume, manifest);
    }
  }

  // Phase 5  Priority for nextTurn + TURN_STARTED.
  //          `TURN_STARTED` advances `state.turn` to `nextTurn` via apply().
  const newPriority = computePriorityForNextTurn(s, manifest, rng.fork(`priority:${nextTurn}`));
  const started: MatchEvent = {
    type: 'TURN_STARTED',
    turn: nextTurn,
    priority: newPriority.owner,
    priorityReason: newPriority.reason,
  };
  events.push(started);
  s = apply(s, started, manifest);

  // Phase 5.5  Fire any SCHEDULED pending effects with when='START_OF_NEXT_TURN'.
  //            These are the generic DSL counterpart to named pending
  //            kinds (SHURI/EGO/…) and let cards schedule arbitrary
  //            EffectExprs to run at the top of the next turn. Remove
  //            each one as we fire it via PENDING_EFFECT_REMOVED.
  {
    const scheduled = s.pendingEffects.filter(
      (p): p is Extract<PendingEffect, { kind: 'SCHEDULED' }> =>
        p.kind === 'SCHEDULED' && p.when === 'START_OF_NEXT_TURN',
    );
    for (let i = 0; i < scheduled.length; i++) {
      const pe = scheduled[i];
      const subCtx: EffectCtx = {
        state: s,
        manifest,
        self: pe.sourceId,
        selfKind: 'card',
        selfLane: pe.sourceLane,
        selfOwner: pe.sourceOwner,
        rng: rng.fork(`scheduled:${pe.sourceId}:${i}`),
        source: { sourceId: pe.sourceId, effectKind: 'ON_REVEAL' },
        depth: 0,
      };
      const res = evalEffect(s, pe.effect, subCtx, manifest);
      events.push(...res.events);
      s = res.state;
      // Remove the pending after it fires. Uses structural equality in apply.ts.
      const remove: MatchEvent = { type: 'PENDING_EFFECT_REMOVED', effect: pe };
      events.push(remove);
      s = apply(s, remove, manifest);
    }
  }

  // Phase 6  Draws (1 per owner, hand-cap permitting).
  for (const owner of ['PLAYER', 'OPP'] as const) {
    const draws = drawStep(s, owner, 1, manifest);
    for (const e of draws) {
      events.push(e);
      s = apply(s, e, manifest);
    }
  }

  // Phase 7  Reveal the location for the upcoming turn (turns 2–3).
  //          `s.turn === nextTurn` now, so the lane index is `turn - 1`.
  if (s.turn <= 3) {
    const laneIdx = (s.turn - 1) as LaneIdx;
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

export function computeMatchResult(state: MatchState, manifest: Manifest): MatchResult {
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

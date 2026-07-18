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
import type { MatchResult, MatchState, PendingEffect } from './types/state';
import type { CardId, LaneId, Owner } from './types/ids';
import type { Manifest } from './manifest/types';
import type { Rng } from './rng';
import { apply } from './apply';
import { revealPlayedCard, forceRevealPlayedCard, evalEffect, fireLocationTrigger, applyHandEntryDebuffs, type EffectCtx } from './effects/evaluator';
import { getCardCost } from './projections/cost';
import { getLanePower } from './projections/power';
import { isRevealDelayed } from './projections/reveal';
import { collectAllOngoings, sourceCtx } from './projections/ongoing';
import { evalPredicate, select, selectLanes, ownerMatches } from './projections/select';
import { buildCardDrawEvents } from './draw';
import { activeLaneIds, isActiveLane } from './laneTopology';

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
    case 'STAGE_CARD':   return resolveStage(state, intent, rng, manifest);
    case 'UNSTAGE_CARD': return resolveUnstage(state, intent, manifest);
    case 'UNDO_TURN':    return resolveUndoTurn(state, intent, manifest);
    case 'END_TURN': {
      const started: MatchEvent = { type: 'TURN_RESOLUTION_STARTED', turn: state.turn };
      const resolvingState = apply(state, started, manifest);
      return [
        started,
        ...resolveTurn(resolvingState, manifest, rng.fork(`turn:${state.turn}`)).events,
      ];
    }
    case 'CONCEDE':      return resolveConcede(state, intent);
  }
}

function reject(intentId: string, reason: string): MatchEvent[] {
  return [{ type: 'INTENT_REJECTED', intentId, reason }];
}

function resolveStage(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'STAGE_CARD' }>,
  rng: Rng,
  manifest: Manifest,
): MatchEvent[] {
  const card = state.cards[intent.cardId];
  if (!card) return reject(intent.intentId, `unknown card ${intent.cardId}`);
  if (card.owner !== intent.owner) return reject(intent.intentId, 'card owner mismatch');
  if (card.zone !== 'HAND') return reject(intent.intentId, 'card not in hand');
  const def = manifest.cards[card.defId];
  if (!def) return reject(intent.intentId, `unknown defId ${card.defId}`);

  const lane = state.lanes[intent.lane];
  if (!lane || !isActiveLane(state, intent.lane)) {
    return reject(intent.intentId, 'lane is not active');
  }
  if (lane.cards[intent.owner].length >= manifest.constants.laneCapacity) {
    return reject(intent.intentId, 'lane full');
  }
  const cost = getCardCost(state, intent.cardId, manifest);
  if (state.energy[intent.owner] < cost) {
    return reject(intent.intentId, 'insufficient energy');
  }
  if (isPlayBlocked(state, intent.cardId, intent.lane, intent.owner, manifest)) {
    return reject(intent.intentId, 'location blocks play');
  }

  const events: MatchEvent[] = [];
  let s = state;
  const staged: MatchEvent = {
      type: 'CARD_STAGED',
      intentId: intent.intentId,
      cardId: intent.cardId,
      lane: intent.lane,
      owner: intent.owner,
      cost,
  };
  events.push(staged);
  s = apply(s, staged, manifest);
  const spent: MatchEvent = {
    type: 'ENERGY_CHANGED',
    owner: intent.owner,
    delta: -cost,
    reason: 'CARD_PLAYED',
  };
  events.push(spent);
  s = apply(s, spent, manifest);

  const locTrig = fireLocationTrigger(
    s,
    intent.lane,
    'onCardEnteredHere',
    rng.fork(`stage-enter:${intent.cardId}`),
    manifest,
    intent.cardId,
    intent.owner,
  );
  events.push(...locTrig.events);
  return events;
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
  const refund = getCardCost(state, intent.cardId, manifest);

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
    events.push({ type: 'CARD_UNSTAGED', intentId: intent.intentId, cardId: id });
    events.push({
      type: 'ENERGY_CHANGED',
      owner: intent.owner,
      delta: getCardCost(state, id, manifest),
      reason: 'CARD_UNSTAGED',
    });
  }
  return events;
}

function resolveConcede(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'CONCEDE' }>,
): MatchEvent[] {
  const winner: Owner = intent.owner === 'P0' ? 'P1' : 'P0';
  return [
    {
      type: 'MATCH_ENDED',
      result: {
        winner,
        lanesWon: { P0: 0, P1: 0 } as Record<Owner, number>,
        totalPower: { P0: 0, P1: 0 } as Record<Owner, number>,
      },
    },
  ];
}

// ============================================================================
// resolveTurn — full turn cascade
// ============================================================================

function hasPowerGainDrawTrigger(def: { abilities: import('./manifest/types').CardAbilities } | null | undefined): boolean {
  if (!def) return false;
  const has = (list: readonly import('./types/ability').EffectExpr[] | undefined) =>
    (list ?? []).some(e => (e as any).kind === 'CALL_BUILTIN' && (e as any).fn === 'DRAW_ON_POWER_GAIN');
  return has(def.abilities.onReveal)
    || has(def.abilities.onEndOfTurn)
    || has(def.abilities.onTurnStart)
    || has(def.abilities.onDestroyed)
    || has(def.abilities.onMove)
    || has(def.abilities.onDiscarded)
    || has(def.abilities.onAnyCardPlayedHere);
}

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
  const order: Owner[] = priorityOwner === 'P0' ? ['P0', 'P1'] : ['P1', 'P0'];
  for (const owner of order) {
    const mine = s.stagingOrder.filter(id => s.cards[id]?.owner === owner);
    for (const cardId of mine) {
      const card = s.cards[cardId];
      if (
        !card
        || card.zone !== 'LANE'
        || card.lane === null
        || !isActiveLane(s, card.lane)
      ) {
        continue;
      }
      const subRng = rng.fork(`reveal:${owner}:${cardId}`);
      const res = revealPlayedCard(s, cardId, manifest, subRng);
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
  //            lane 0 → 1 → 2, within each lane P0 cards first (in
  //            stage order), then P1 cards. Only revealed cards fire;
  //            pending (face-down) cards do not. Each trigger runs with
  //            the card as SELF and a forked RNG keyed on cardId + exprIdx.
  {
    const triggerFires: { cardId: CardId; effects: readonly import('./types/ability').EffectExpr[] }[] = [];
    for (const lane of activeLaneIds(s)) {
      for (const owner of ['P0', 'P1'] as const) {
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

  // Phase 1.92  Location end-of-turn triggers. These run after card EOT
  // triggers and before TURN_ENDED cleanup clears transient play/move tags.
  {
    for (const lane of activeLaneIds(s)) {
      const trig = fireLocationTrigger(
        s,
        lane,
        'atTurnEnd',
        rng.fork(`loc-eot:${lane}`),
        manifest,
      );
      events.push(...trig.events);
      s = trig.state;
    }
  }

  // Phase 1.93  Fire SCHEDULED END_OF_NEXT_TURN effects whose target turn
  // has arrived. These run after normal EOT triggers and before TURN_ENDED
  // clears transient tags/staging order.
  {
    const scheduled = s.pendingEffects.filter(
      (p): p is Extract<PendingEffect, { kind: 'SCHEDULED' }> =>
        p.kind === 'SCHEDULED' &&
        p.when === 'END_OF_NEXT_TURN' &&
        ((p.fireTurn ?? s.turn) <= s.turn),
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
        rng: rng.fork(`scheduled-end:${pe.sourceId}:${i}`),
        source: { sourceId: pe.sourceId, effectKind: 'ON_REVEAL' },
        depth: 0,
      };
      const res = evalEffect(s, pe.effect, subCtx, manifest);
      events.push(...res.events);
      s = res.state;
      const remove: MatchEvent = { type: 'PENDING_EFFECT_REMOVED', effect: pe };
      events.push(remove);
      s = apply(s, remove, manifest);
    }
  }

  // Phase 1.95  DRAW_ON_POWER_GAIN — scan all reveal+EOT events for positive
  //             power changes on cards that have the reactive draw trigger.
  {
    const snapshot = [...events];
    for (const e of snapshot) {
      if (e.type !== 'CARD_POWER_CHANGED' || e.delta <= 0) continue;
      const card = s.cards[e.cardId];
      if (!card || !card.revealed) continue;
      const def = manifest.cards[card.defId];
      if (!hasPowerGainDrawTrigger(def)) continue;
      const draws = buildCardDrawEvents(s, card.owner, 1, manifest);
      for (const drawEvt of draws) {
        events.push(drawEvt);
        s = apply(s, drawEvt, manifest);
        const debuff = applyHandEntryDebuffs(s, drawEvt.cardId, drawEvt.owner, rng.fork(`pgdebuff:${drawEvt.cardId}`), manifest);
        events.push(...debuff.events);
        s = debuff.state;
      }
    }
  }

  // Phase 2  TURN_ENDED — clears transient tags (DESTROYED_THIS_TURN,
  //          MOVED_THIS_TURN) + stagingOrder. `@migrate:atTurnEnd` is where
  //          location `atTurnEnd` abilities will be dispatched in a later
  //          tier; they must run BEFORE this cleanup event.
  // Capture stagingOrder BEFORE TURN_ENDED clears it — needed for end-game
  // ordered reveal of face-down cards.
  const preCleanupStagingOrder = [...s.stagingOrder];
  const turnEnded: MatchEvent = { type: 'TURN_ENDED', turn: s.turn };
  events.push(turnEnded);
  s = apply(s, turnEnded, manifest);

  // Phase 3  Winner check — only after all end-of-turn bookkeeping has
  //          settled. If the last turn just finished, the match ends here
  //          and NO start-of-turn bookkeeping runs.
  if (s.turn >= manifest.constants.turnLimit) {
    const delayed = revealDelayedCardsAtEndOfGame(s, manifest, rng.fork('endgame-reveal'), preCleanupStagingOrder);
    events.push(...delayed.events);
    s = delayed.state;
    const result = computeMatchResult(s, manifest);
    const endEvt: MatchEvent = { type: 'MATCH_ENDED', result };
    events.push(endEvt);
    s = apply(s, endEvt, manifest);
    return { events, state: s };
  }

  // ─── START-OF-TURN BOOKKEEPING ───────────────────────────────────────────
  // Deliberate order: turn boundary → energy → draw → location reveal.
  //
  //   TURN_STARTED is the canonical boundary: its frame changes `state.turn`
  //   and is the first frame owned by the new turn. Priority is computed on
  //   the clean post-TURN_ENDED board before that boundary is emitted.
  //
  //   Energy follows the boundary so "+N energy next turn" effects resolve
  //   before anything consumes or displays the new pool.
  //
  //   Draws run after energy because drawing can't change priority
  //   (hand contents don't feed the priority computation) but effects
  //   that react to "card drawn" expect the priority holder for this
  //   turn to already be known.
  //
  //   Location reveal is last — it's a player-facing cinematic, and any
  //   Ongoing effect tied to the location should kick in after draws and
  //   energy are already settled.
  const nextTurn = s.turn + 1;

  // Phase 4  Compute priority, then emit the canonical turn boundary.
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

  // Phase 5  Ramp `maxEnergy` (+1 per owner), refill `energy` to
  //          `maxEnergy + nextTurnEnergyBonus`, then consume the bonus.
  //          Event order per owner:
  //            1. MAX_ENERGY_CHANGED  (ramp ceiling by +1)
  //            2. ENERGY_CHANGED      (refill current to new ceiling + bonus)
  //            3. NEXT_TURN_ENERGY_BONUS_CHANGED (zero the one-shot bonus)
  //          Mirrors: `currentEnergy = maxEnergy + energyEarnedLastTurn`.
  for (const owner of ['P0', 'P1'] as const) {
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

  // Phase 5.5  Fire any SCHEDULED pending effects with when='START_OF_NEXT_TURN'.
  //            These are the generic DSL counterpart to named pending
  //            kinds (SHURI/EGO/…) and let cards schedule arbitrary
  //            EffectExprs to run at the top of the next turn. Remove
  //            each one as we fire it via PENDING_EFFECT_REMOVED.
  {
    const scheduled = s.pendingEffects.filter(
      (p): p is Extract<PendingEffect, { kind: 'SCHEDULED' }> =>
        p.kind === 'SCHEDULED' &&
        p.when === 'START_OF_NEXT_TURN' &&
        ((p.fireTurn ?? s.turn) <= s.turn),
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

  // Phase 5.6  Card start-of-turn triggers, after TURN_STARTED and scheduled
  // start effects, before location triggers and normal draws.
  {
    const triggerFires: { cardId: CardId; effects: readonly import('./types/ability').EffectExpr[] }[] = [];
    for (const lane of activeLaneIds(s)) {
      for (const owner of ['P0', 'P1'] as const) {
        const ids = s.lanes[lane].cards[owner];
        for (const id of ids) {
          const card = s.cards[id];
          if (!card || !card.revealed) continue;
          const def = manifest.cards[card.defId];
          const effs = def?.abilities.onTurnStart;
          if (!effs || effs.length === 0) continue;
          triggerFires.push({ cardId: id, effects: effs });
        }
      }
    }
    for (let i = 0; i < triggerFires.length; i++) {
      const { cardId, effects: effs } = triggerFires[i];
      for (let j = 0; j < effs.length; j++) {
        const card = s.cards[cardId];
        if (!card || card.zone !== 'LANE') break;
        const subCtx: EffectCtx = {
          state: s,
          manifest,
          self: cardId,
          selfKind: 'card',
          selfLane: card.lane,
          selfOwner: card.owner,
          rng: rng.fork(`turn-start:${cardId}:${j}`),
          source: { sourceId: cardId, effectKind: 'ON_REVEAL', exprIdx: j },
          depth: 0,
        };
        const res = evalEffect(s, effs[j], subCtx, manifest);
        events.push(...res.events);
        s = res.state;
      }
    }
  }

  // Phase 5.7  Location start-of-turn triggers, after card start triggers,
  // before normal draws.
  {
    for (const lane of activeLaneIds(s)) {
      const trig = fireLocationTrigger(
        s,
        lane,
        'atTurnStart',
        rng.fork(`loc-start:${lane}`),
        manifest,
      );
      events.push(...trig.events);
      s = trig.state;
    }
  }

  // Phase 6  Manifest-declared turn-start draws per owner, hand-cap permitting.
  for (const owner of ['P0', 'P1'] as const) {
    const draws = buildCardDrawEvents(s, owner, manifest.constants.turnStartDraw, manifest);
    for (const e of draws) {
      events.push(e);
      s = apply(s, e, manifest);
      const debuff = applyHandEntryDebuffs(s, e.cardId, owner, rng.fork(`draw-debuff:${e.cardId}`), manifest);
      events.push(...debuff.events);
      s = debuff.state;
    }
  }

  // Phase 7  Reveal the location for the upcoming turn (turns 2–3).
  //          `s.turn === nextTurn` now, so the lane index is `turn - 1`.
  if (s.turn <= 3) {
    const laneIdx = (s.turn - 1) as LaneId;
    const loc = s.lanes[laneIdx].location;
    if (loc && !s.lanes[laneIdx].locationRevealed) {
      const revealEvt: MatchEvent = {
        type: 'LOCATION_REVEALED',
        lane: laneIdx,
        locationId: loc.id,
      };
      events.push(revealEvt);
      s = apply(s, revealEvt, manifest);

      const locDef = manifest.locations[loc.defId];
      const locReveal = locDef?.abilities.onReveal ?? [];
      for (let idx = 0; idx < locReveal.length; idx++) {
        const ctx: EffectCtx = {
          state: s,
          manifest,
          self: loc.id,
          selfKind: 'location',
          selfLane: laneIdx,
          selfOwner: null,
          rng: rng.fork(`location-reveal:${loc.id}:${idx}`),
          source: { sourceId: loc.id, effectKind: 'LOCATION', exprIdx: idx },
          depth: 0,
        };
        const res = evalEffect(s, locReveal[idx], ctx, manifest);
        events.push(...res.events);
        s = res.state;
      }
    }
  }

  return { events, state: s };
}

// ============================================================================
// Helpers
// ============================================================================

function isPlayBlocked(
  state: MatchState,
  cardId: CardId,
  lane: LaneId,
  owner: Owner,
  manifest: Manifest,
): boolean {
  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'BLOCK_PLAY') continue;
    if (!ownerMatches(entry.expr.ownerFilter ?? 'ANY_OWNER', entry.sourceOwner, owner, owner)) continue;
    const baseCtx = sourceCtx(entry, state, manifest);
    if (!baseCtx) continue;
    const ctx = {
      ...baseCtx,
      eventCard: cardId,
      eventLane: lane,
      eventOwner: owner,
    };
    if (entry.expr.when && !evalPredicate(entry.expr.when, ctx)) continue;
    if (entry.expr.cardPred && !evalPredicate(entry.expr.cardPred, { ...ctx, self: cardId, selfKind: 'card' })) continue;
    if (entry.expr.laneOf) {
      if (selectLanes(entry.expr.laneOf, ctx).includes(lane)) return true;
    } else if (entry.expr.target) {
      if (select(entry.expr.target, ctx).includes(cardId)) return true;
    }
  }
  return false;
}

function revealDelayedCardsAtEndOfGame(
  state: MatchState,
  manifest: Manifest,
  rng: Rng,
  stagingOrder: readonly CardId[],
): ResolveTurnResult {
  const events: MatchEvent[] = [];
  let s = state;

  // Reveal in the order cards were staged (play order), per owner interleaved
  // as in the reveal phase: priority owner first, then opponent. Fall back to
  // lane-array order for any face-down cards not in stagingOrder (edge cases).
  const seenInOrder = new Set<CardId>();
  const ordered: CardId[] = [];

  // Staged cards in play order
  for (const id of stagingOrder) {
    const card = s.cards[id];
    if (!card || card.zone !== 'LANE' || card.revealed) continue;
    if (!isRevealDelayed(s, id, manifest)) continue;
    ordered.push(id);
    seenInOrder.add(id);
  }

  // Any remaining face-down lane cards not captured by stagingOrder (e.g.
  // effect-spawned with DELAY_REVEAL), in lane-array order.
  for (const owner of ['P0', 'P1'] as const) {
    for (const lane of activeLaneIds(s)) {
      for (const id of s.lanes[lane].cards[owner]) {
        if (seenInOrder.has(id)) continue;
        const card = s.cards[id];
        if (!card || card.zone !== 'LANE' || card.revealed) continue;
        if (!isRevealDelayed(s, id, manifest)) continue;
        ordered.push(id);
        seenInOrder.add(id);
      }
    }
  }

  for (const id of ordered) {
    const card = s.cards[id];
    if (!card) continue; // may have been destroyed by a prior reveal
    const res = forceRevealPlayedCard(s, id, manifest, rng.fork(`delayed:${id}`));
    events.push(...res.events);
    s = res.state;
  }
  return { events, state: s };
}

export function computeMatchResult(state: MatchState, manifest: Manifest): MatchResult {
  let lanesP = 0;
  let lanesO = 0;
  let totP = 0;
  let totO = 0;
  for (const lane of activeLaneIds(state)) {
    const p = getLanePower(state, lane, 'P0', manifest);
    const o = getLanePower(state, lane, 'P1', manifest);
    totP += p;
    totO += o;
    if (p > o) lanesP++;
    else if (o > p) lanesO++;
  }
  const winner: Owner | 'DRAW' =
      lanesP > lanesO ? 'P0'
    : lanesO > lanesP ? 'P1'
    : totP > totO     ? 'P0'
    : totO > totP     ? 'P1'
    :                   'DRAW';
  return {
    winner,
    lanesWon:   { P0: lanesP, P1: lanesO } as Record<Owner, number>,
    totalPower: { P0: totP,   P1: totO   } as Record<Owner, number>,
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
  for (const lane of activeLaneIds(state)) {
    const p = getLanePower(state, lane, 'P0', manifest);
    const o = getLanePower(state, lane, 'P1', manifest);
    totP += p;
    totO += o;
    if (p > o) lanesP++;
    else if (o > p) lanesO++;
  }
  if (lanesP !== lanesO) {
    return { owner: lanesP > lanesO ? 'P0' : 'P1', reason: 'MORE_LANES' };
  }
  if (totP !== totO) {
    return { owner: totP > totO ? 'P0' : 'P1', reason: 'MORE_POWER' };
  }
  return { owner: rng.int(0, 1) === 0 ? 'P0' : 'P1', reason: 'COIN_FLIP' };
}

// Re-exports for Step 8+ wiring convenience.
export type { Rng };

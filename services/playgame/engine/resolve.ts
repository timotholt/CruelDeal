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
 *     draw, and emit `TURN_ENDED`/`TURN_STARTED` bookends. On the live final
 *     turn it emits `MATCH_ENDED` instead of restarting.
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
import {
  revealPlayedCard,
  revealPlayedCardAtEndOfGame,
  executeReactionCommands,
  executeHandCommands,
  evalEffect,
  type EffectCtx,
} from './effects/evaluator';
import { getCardCost } from './projections/cost';
import { getLanePower } from './projections/power';
import { getFinalTurn } from './projections/gameEnd';
import { collectAllOngoings, sourceCtx } from './projections/ongoing';
import { evalPredicate, select, selectLanes, ownerMatches } from './projections/select';
import { activeLaneIds, isActiveLane, locationCardAtLane } from './laneTopology';
import { revealLocation } from './locationLifecycle';
import {
  getAllCardIds,
  getCardLifecycle,
  getCardRuntime,
} from './projections/cardRuntime';
import { getCardTemplate } from './projections/cardTemplate';
import { getRevealTimingPolicy } from './kernel/policies/revealTiming';

// ============================================================================
// resolve — intent → events
// ============================================================================

export function resolve(
  state: MatchState,
  intent: MatchIntent,
  rng: Rng,
  manifest: Manifest,
): MatchEvent[] {
  if (state.phase === 'SETUP') {
    return reject(intent.intentId, 'match setup is not complete');
  }
  switch (intent.type) {
    case 'STAGE_CARD':   return resolveStage(state, intent, rng, manifest);
    case 'UNSTAGE_CARD': return resolveUnstage(state, intent, manifest);
    case 'UNDO_TURN':    return resolveUndoTurn(state, intent, manifest);
    case 'END_TURN': {
      const started: MatchEvent = { type: 'TURN_RESOLUTION_STARTED', turn: state.turn };
      const resolvingState = apply(state, started, manifest);
      return [
        started,
        ...resolveTurn(resolvingState, manifest, rng.scope(`turn:${state.turn}`)).events,
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
  const card = getCardRuntime(state, intent.cardId, manifest);
  if (!card) return reject(intent.intentId, `unknown card ${intent.cardId}`);
  if (card.owner !== intent.owner) return reject(intent.intentId, 'card owner mismatch');
  if (card.zone !== 'HAND') return reject(intent.intentId, 'card not in hand');
  const def = getCardTemplate(manifest, card.defId);
  if (!def) return reject(intent.intentId, `unknown defId ${card.defId}`);

  const lane = state.lanesById[intent.lane];
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
  const staged: MatchEvent = {
      type: 'CARD_STAGED',
      intentId: intent.intentId,
      cardId: intent.cardId,
      lane: intent.lane,
      owner: intent.owner,
      cost,
  };
  events.push(staged);
  const spent: MatchEvent = {
    type: 'ENERGY_CHANGED',
    owner: intent.owner,
    delta: -cost,
    reason: 'CARD_PLAYED',
  };
  events.push(spent);

  const candidate = apply(apply(state, staged, manifest), spent, manifest);
  const revealTiming = getRevealTimingPolicy(candidate, intent.cardId, manifest);
  if (revealTiming) {
    events.push({
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: intent.cardId,
      timing: revealTiming.timing,
      cause: revealTiming.cause,
    });
  }

  return events;
}

function resolveUnstage(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'UNSTAGE_CARD' }>,
  manifest: Manifest,
): MatchEvent[] {
  const card = getCardRuntime(state, intent.cardId, manifest);
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
    .filter(id => getCardRuntime(state, id, manifest)?.owner === intent.owner)
    .slice()
    .reverse();
  const events: MatchEvent[] = [];
  for (const id of mine) {
    const card = getCardRuntime(state, id, manifest);
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
  const turnReveals = revealScheduledCards(s, manifest, rng.scope('turn-reveals'), 'TURN');
  events.push(...turnReveals.events);
  s = turnReveals.state;

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
    const commands: import('./kernel/revealTransaction').RevealCommand[] = [];
    for (const lane of activeLaneIds(s)) {
      for (const owner of ['P0', 'P1'] as const) {
        for (const cardId of s.lanesById[lane].cards[owner]) {
          const card = getCardRuntime(s, cardId, manifest);
          if (!card?.revealed || !card.text.abilities.onEndOfTurn?.length) {
            continue;
          }
          commands.push({
            type: 'INVOKE_CARD_TRIGGER',
            cardId,
            slot: 'TURN_END',
            depth: 0,
            cause: {
              sourceId: cardId,
              effectKind: 'ON_REVEAL',
              reason: 'TURN_END',
            },
          });
        }
      }
    }
    for (const lane of activeLaneIds(s)) {
      const location = locationCardAtLane(s, lane);
      if (location?.face !== 'FACE_UP') continue;
      commands.push({
        type: 'INVOKE_LOCATION_TRIGGER',
        locationId: location.id,
        lane,
        slot: 'TURN_END',
        depth: 0,
        cause: {
          sourceId: location.id,
          effectKind: 'LOCATION',
          reason: 'TURN_END',
        },
      });
    }
    const triggered = executeReactionCommands(
      s,
      commands,
      { rng: rng.scope('turn-end-reactions') },
      manifest,
    );
    events.push(...triggered.events);
    s = triggered.state;
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
        rng: rng.scope(`scheduled-end:${pe.sourceId}:${i}`),
        source: {
          sourceId: pe.sourceId,
          effectKind: 'ON_REVEAL',
          reason: 'SCHEDULED_END_OF_NEXT_TURN',
        },
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
  if (s.turn >= getFinalTurn(s, manifest)) {
    const delayed = revealScheduledCards(s, manifest, rng.scope('endgame-reveal'), 'END_OF_GAME');
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
  const newPriority = computePriorityForNextTurn(s, manifest, rng.scope(`priority:${nextTurn}`));
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
        rng: rng.scope(`scheduled:${pe.sourceId}:${i}`),
        source: {
          sourceId: pe.sourceId,
          effectKind: 'ON_REVEAL',
          reason: 'SCHEDULED_START_OF_NEXT_TURN',
        },
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
    const commands: import('./kernel/revealTransaction').RevealCommand[] = [];
    for (const lane of activeLaneIds(s)) {
      for (const owner of ['P0', 'P1'] as const) {
        for (const cardId of s.lanesById[lane].cards[owner]) {
          const card = getCardRuntime(s, cardId, manifest);
          if (!card?.revealed || !card.text.abilities.onTurnStart?.length) {
            continue;
          }
          commands.push({
            type: 'INVOKE_CARD_TRIGGER',
            cardId,
            slot: 'TURN_START',
            depth: 0,
            cause: {
              sourceId: cardId,
              effectKind: 'ON_REVEAL',
              reason: 'TURN_START',
            },
          });
        }
      }
    }
    for (const lane of activeLaneIds(s)) {
      const location = locationCardAtLane(s, lane);
      if (location?.face !== 'FACE_UP') continue;
      commands.push({
        type: 'INVOKE_LOCATION_TRIGGER',
        locationId: location.id,
        lane,
        slot: 'TURN_START',
        depth: 0,
        cause: {
          sourceId: location.id,
          effectKind: 'LOCATION',
          reason: 'TURN_START',
        },
      });
    }
    const triggered = executeReactionCommands(
      s,
      commands,
      { rng: rng.scope('turn-start-reactions') },
      manifest,
    );
    events.push(...triggered.events);
    s = triggered.state;
  }

  // Phase 6  Manifest-declared turn-start draws per owner, hand-cap permitting.
  for (const owner of ['P0', 'P1'] as const) {
    const draw = executeHandCommands(
      s,
      Array.from({ length: manifest.constants.turnStartDraw }, () => ({
        type: 'DRAW_CARD' as const,
        owner,
        selection: { kind: 'TOP' as const },
        cause: {
          sourceId: `system:turn:${s.turn}:draw:${owner}` as CardId,
          effectKind: 'SYSTEM' as const,
          reason: 'TURN_START_DRAW',
        },
      })),
      { rng: rng.scope(`turn-start-draw:${owner}`) },
      manifest,
    );
    events.push(...draw.events);
    s = draw.state;
  }

  // Phase 7  Reveal every active slot scheduled for this turn, in current
  //          topology order. Reveal timing belongs to the slot; lane IDs are
  //          stable identities and are never inferred from the turn number.
  const scheduledLocationLanes = activeLaneIds(s).filter((laneId) => {
    const location = locationCardAtLane(s, laneId);
    return location?.face === 'FACE_DOWN'
      && s.lanesById[laneId].locationSlot.revealAtTurn === s.turn;
  });
  for (const laneId of scheduledLocationLanes) {
    const loc = locationCardAtLane(s, laneId);
    if (
      loc?.face === 'FACE_DOWN'
      && s.lanesById[laneId]?.status === 'ACTIVE'
      && s.lanesById[laneId].locationSlot.revealAtTurn === s.turn
    ) {
      const reveal = revealLocation(s, laneId, {
        sourceId: loc.id,
        effectKind: 'SYSTEM',
        reason: 'TURN_START_LOCATION_REVEAL',
      }, manifest);
      if (!reveal.ok) {
        throw new Error(`turn-start location reveal failed: ${reveal.message}`);
      }
      events.push(...reveal.events);
      s = reveal.state;

      const locationTrigger = executeReactionCommands(s, [{
        type: 'INVOKE_LOCATION_TRIGGER',
        locationId: loc.id,
        lane: laneId,
        slot: 'REVEAL',
        depth: 0,
        cause: {
          sourceId: loc.id,
          effectKind: 'LOCATION',
          reason: 'LOCATION_ON_REVEAL',
        },
      }], {
        rng: rng.scope(`location-reveal:${loc.id}`),
      }, manifest);
      events.push(...locationTrigger.events);
      s = locationTrigger.state;
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

function latestStageIndex(state: MatchState, cardId: CardId): number {
  return getCardLifecycle(state, cardId)?.framePlayed ?? Number.MAX_SAFE_INTEGER;
}

function revealScheduledCards(
  state: MatchState,
  manifest: Manifest,
  rng: Rng,
  window: 'TURN' | 'END_OF_GAME',
): ResolveTurnResult {
  const events: MatchEvent[] = [];
  let s = state;
  const due = getAllCardIds(s)
    .map((id) => getCardRuntime(s, id, manifest))
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .filter((card) => {
    if (
      card.zone !== 'LANE'
      || card.lane === null
      || card.revealed
      || !isActiveLane(s, card.lane)
    ) return false;
    if (window === 'END_OF_GAME') {
      return card.revealTiming?.kind === 'END_OF_GAME'
        || (card.revealTiming?.kind === 'TURN' && card.revealTiming.turn <= s.turn);
    }
    return card.revealTiming?.kind === 'TURN' && card.revealTiming.turn <= s.turn;
    });
  const ownerOrder: readonly Owner[] = s.priority === 'P0' ? ['P0', 'P1'] : ['P1', 'P0'];
  const ordered = ownerOrder.flatMap((owner) =>
    due
      .filter((card) => card.owner === owner)
      .sort((a, b) => latestStageIndex(s, a.id) - latestStageIndex(s, b.id))
      .map((card) => card.id),
  );

  for (const id of ordered) {
    const card = getCardRuntime(s, id, manifest);
    if (!card) continue; // may have been destroyed by a prior reveal
    const res = window === 'END_OF_GAME'
      ? revealPlayedCardAtEndOfGame(s, id, manifest, rng.scope(`end-game:${id}`))
      : revealPlayedCard(s, id, manifest, rng.scope(`turn:${id}`));
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

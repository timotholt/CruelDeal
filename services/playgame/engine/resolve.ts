/**
 * resolve(state, intent, rng, manifest) → MatchEvent[]
 * resolveTurn(state, manifest, rng) → { events, state }
 *
 * Two entry points of the engine's authoritative step:
 *
 *   - `resolve` is the intent validator + translator: stage/concede/end-turn
 *     intents become event streams, or yield a single
 *     `INTENT_REJECTED` entry when the intent is invalid.
 *     Unstage and undo are private-plan edits owned by the runtime; they have
 *     no authoritative inverse event stream.
 *   - `resolveTurn` is the full turn-end cascade: flip priority-ordered
 *     reveals, run OR evaluators, reveal next location, refill energy,
 *     draw, and emit `TURN_ENDED`/`TURN_STARTED` bookends. On the live final
 *     turn it emits `MATCH_ENDED` instead of restarting.
 *
 * See spec §7 and §6.1.
 */

import type { MatchEvent } from './types/events';
import type { MatchIntent } from './types/intents';
import type { MatchState } from './types/state';
import type {
  KernelEffectTraceEntry,
  KernelResolutionStep,
} from './kernel/resolutionTrace';
import type { CardId, Owner } from './types/ids';
import type { Manifest } from './manifest/types';
import type { Rng } from './rng';
import { executeRulesCommands } from './effects/rulesInterpreter';
import { getFinalTurn } from './projections/gameEnd';
import { activeLaneIds, isActiveLane, locationCardAtLane } from './laneTopology';
import {
  getAllCardIds,
  getCardLifecycle,
  getCardRuntime,
} from './projections/cardRuntime';
import { KernelInvariantError } from './kernel/failure';
import {
  getPriorityStanding,
} from './kernel/operations/matchLifecycle';

// ============================================================================
// resolve — intent → events
// ============================================================================

export interface ResolveResult {
  readonly events: readonly MatchEvent[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
}

function appendResolution(
  events: MatchEvent[],
  resolutionSteps: KernelResolutionStep[],
  result: ResolveResult,
): void {
  const transitionOffset = events.length;
  const invocationOffset = resolutionSteps.reduce((next, step) => (
    step.effect === null
      ? next
      : Math.max(next, step.effect.invocationOrdinal + 1)
  ), 0);
  events.push(...result.events);
  resolutionSteps.push(...result.resolutionSteps.map(step => ({
    transitionIndex: step.transitionIndex === null
      ? null
      : step.transitionIndex + transitionOffset,
    effect: rebaseInvocationOrdinals(step.effect, invocationOffset),
  })));
}

function rebaseInvocationOrdinals(
  effect: KernelEffectTraceEntry | null,
  offset: number,
): KernelEffectTraceEntry | null {
  if (effect === null || offset === 0) return effect;
  if (effect.kind === 'EFFECT_INVOCATION_STARTED') {
    return {
      ...effect,
      invocationOrdinal: effect.invocationOrdinal + offset,
      parentInvocationOrdinal: effect.parentInvocationOrdinal === null
        ? null
        : effect.parentInvocationOrdinal + offset,
    };
  }
  return {
    ...effect,
    invocationOrdinal: effect.invocationOrdinal + offset,
  };
}

function combineResolution(...results: readonly ResolveResult[]): ResolveResult {
  const events: MatchEvent[] = [];
  const resolutionSteps: KernelResolutionStep[] = [];
  for (const result of results) {
    appendResolution(events, resolutionSteps, result);
  }
  return { events, resolutionSteps };
}

export function resolve(
  state: MatchState,
  intent: MatchIntent,
  rng: Rng,
  manifest: Manifest,
): ResolveResult {
  if (state.phase === 'SETUP') {
    return reject(intent.intentId, 'match setup is not complete');
  }
  switch (intent.type) {
    case 'STAGE_CARD':   return resolveStage(state, intent, rng, manifest);
    case 'UNSTAGE_CARD':
    case 'UNDO_TURN':
      return reject(
        intent.intentId,
        `${intent.type} is a private planning operation`,
      );
    case 'END_TURN': {
      const begun = executeRulesCommands(state, [{
        type: 'BEGIN_RESOLUTION',
        authority: 'SYSTEM',
      }], {
        rng: rng.scope(`turn:${state.turn}:begin-resolution`),
      }, manifest);
      const turn = resolveTurn(
        begun.state,
        manifest,
        rng.scope(`turn:${state.turn}`),
      );
      return combineResolution(begun, turn);
    }
    case 'CONCEDE':      return resolveConcede(state, intent, manifest, rng);
  }
}

function reject(intentId: string, reason: string): ResolveResult {
  return {
    events: [{ type: 'INTENT_REJECTED', intentId, reason }],
    resolutionSteps: [{ transitionIndex: 0, effect: null }],
  };
}

function resolveStage(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'STAGE_CARD' }>,
  rng: Rng,
  manifest: Manifest,
): ResolveResult {
  try {
    return executeRulesCommands(state, [{
      type: 'STAGE_PLAY',
      intentId: intent.intentId,
      cardId: intent.cardId,
      lane: intent.lane,
      owner: intent.owner,
      cause: {
        sourceId: intent.cardId,
        effectKind: 'SYSTEM',
        reason: 'PLAYER_STAGE_INTENT',
      },
    }], {
      rng: rng.scope(`stage:${intent.intentId}`),
    }, manifest);
  } catch (error) {
    if (error instanceof KernelInvariantError) {
      return reject(intent.intentId, error.failure.message);
    }
    throw error;
  }
}

function resolveConcede(
  state: MatchState,
  intent: Extract<MatchIntent, { type: 'CONCEDE' }>,
  manifest: Manifest,
  rng: Rng,
): ResolveResult {
  return executeRulesCommands(state, [{
    type: 'END_MATCH',
    authority: 'SYSTEM',
    reason: 'CONCESSION',
    concedingOwner: intent.owner,
  }], {
    rng: rng.scope(`concession:${intent.owner}`),
  }, manifest);
}

// ============================================================================
// resolveTurn — full turn cascade
// ============================================================================

export interface ResolveTurnResult {
  readonly events: readonly MatchEvent[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
  readonly state: MatchState;
}

export function resolveTurn(
  state: MatchState,
  manifest: Manifest,
  rng: Rng,
): ResolveTurnResult {
  const events: MatchEvent[] = [];
  const resolutionSteps: KernelResolutionStep[] = [];
  let s = state;

  // ─── Phase 1  Reveals (priority-ordered) ─────────────────────────────────
  // Priority holder's cards flip first, in stage order; then the other side.
  const turnReveals = revealScheduledCards(s, manifest, rng.scope('turn-reveals'), 'TURN');
  appendResolution(events, resolutionSteps, turnReveals);
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
    const triggered = executeRulesCommands(
      s,
      commands,
      { rng: rng.scope('turn-end-reactions') },
      manifest,
    );
    appendResolution(events, resolutionSteps, triggered);
    s = triggered.state;
  }

  // Phase 1.93  Fire SCHEDULED END_OF_NEXT_TURN effects whose target turn
  // has arrived. These run after normal EOT triggers and before TURN_ENDED
  // clears transient tags/staging order.
  {
    const scheduled = s.pendingEffects.filter(
      p =>
        p.when === 'END_OF_NEXT_TURN' &&
        p.fireTurn <= s.turn,
    );
    for (const pe of scheduled) {
      const consumed = executeRulesCommands(s, [{
        type: 'CONSUME_PENDING_EFFECT',
        pendingEffectId: pe.id,
        mode: 'EXECUTE',
        cause: {
          sourceId: pe.sourceId,
          effectKind: 'SYSTEM',
          reason: 'PENDING_END_OF_TURN_DUE',
        },
      }], { rng: rng.scope('scheduled-end'), depth: 0 }, manifest);
      appendResolution(events, resolutionSteps, consumed);
      s = consumed.state;
    }
  }

  const isFinalTurn = s.turn >= getFinalTurn(s, manifest);
  if (isFinalTurn) {
    const delayed = revealScheduledCards(s, manifest, rng.scope('endgame-reveal'), 'END_OF_GAME');
    appendResolution(events, resolutionSteps, delayed);
    s = delayed.state;
  }

  // Phase 2  TURN_ENDED — after every ordinary and final-turn delayed reveal.
  // The governed boundary snapshots tracked variables and clears staged plays.
  const ended = executeRulesCommands(s, [{
    type: 'END_TURN',
    authority: 'SYSTEM',
  }], {
    rng: rng.scope(`turn:${s.turn}:end-boundary`),
  }, manifest);
  appendResolution(events, resolutionSteps, ended);
  s = ended.state;

  // Phase 3  Terminal score is derived inside the governed lifecycle
  // operation from the settled post-cleanup candidate.
  if (isFinalTurn) {
    const terminated = executeRulesCommands(s, [{
      type: 'END_MATCH',
      authority: 'SYSTEM',
      reason: 'FINAL_SCORE',
    }], {
      rng: rng.scope(`turn:${s.turn}:match-end`),
    }, manifest);
    appendResolution(events, resolutionSteps, terminated);
    s = terminated.state;
    return { events, resolutionSteps, state: s };
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
  //          `TURN_STARTED` advances `state.turn` through the governed reducer.
  const standing = getPriorityStanding(s, manifest);
  if (standing.ok === false) {
    throw new KernelInvariantError({
      kind: 'KERNEL_FAILURE',
      code: standing.fault.code,
      message: standing.fault.message,
      workItemsConsumed: 0,
      eventsProduced: 0,
      reactionsScheduled: 0,
      ...(standing.fault.sourceInstanceId === undefined
        ? {}
        : { sourceInstanceId: standing.fault.sourceInstanceId }),
    });
  }
  const tiedPriority = standing.value === null
    ? (rng.scope(`priority:${nextTurn}`).int(0, 1) === 0 ? 'P0' : 'P1')
    : null;
  const started = executeRulesCommands(s, [{
    type: 'START_TURN',
    authority: 'SYSTEM',
    tiedPriority,
  }], {
    rng: rng.scope(`turn:${nextTurn}:start-boundary`),
  }, manifest);
  appendResolution(events, resolutionSteps, started);
  s = started.state;

  // Phase 5  Ramp `maxEnergy` (+1 per owner), refill `energy` to
  //          `maxEnergy + nextTurnEnergyBonus`, then consume the bonus.
  //          Event order per owner:
  //            1. MAX_ENERGY_CHANGED  (ramp ceiling by +1)
  //            2. ENERGY_CHANGED      (refill current to new ceiling + bonus)
  //            3. NEXT_TURN_ENERGY_BONUS_CHANGED (zero the one-shot bonus)
  //          Mirrors: `currentEnergy = maxEnergy + energyEarnedLastTurn`.
  for (const owner of ['P0', 'P1'] as const) {
    const ramp = executeRulesCommands(s, [{
      type: 'CHANGE_ENERGY',
      target: 'MAXIMUM',
      owner,
      delta: 1,
      reason: 'TURN_START',
      cause: {
        sourceId: `system:turn-${nextTurn}:energy` as CardId,
        effectKind: 'SYSTEM',
        reason: 'TURN_START_MAX_ENERGY_RAMP',
      },
    }], { rng: rng.scope(`turn:${nextTurn}:energy-ramp:${owner}`) }, manifest);
    appendResolution(events, resolutionSteps, ramp);
    s = ramp.state;

    const bonus = s.nextTurnEnergyBonus[owner];
    const target = s.maxEnergy[owner] + bonus;
    const refillDelta = target - s.energy[owner];
    if (refillDelta !== 0) {
      const refill = executeRulesCommands(s, [{
        type: 'CHANGE_ENERGY',
        target: 'CURRENT',
        owner,
        delta: refillDelta,
        reason: 'TURN_START',
        cause: {
          sourceId: `system:turn-${nextTurn}:energy` as CardId,
          effectKind: 'SYSTEM',
          reason: 'TURN_START_ENERGY_REFILL',
        },
      }], { rng: rng.scope(`turn:${nextTurn}:energy-refill:${owner}`) }, manifest);
      appendResolution(events, resolutionSteps, refill);
      s = refill.state;
    }

    if (bonus !== 0) {
      const consume = executeRulesCommands(s, [{
        type: 'CHANGE_ENERGY',
        target: 'NEXT_TURN_BONUS',
        owner,
        delta: -bonus,
        reason: 'TURN_START',
        cause: {
          sourceId: `system:turn-${nextTurn}:energy` as CardId,
          effectKind: 'SYSTEM',
          reason: 'TURN_START_BONUS_CONSUMED',
        },
      }], { rng: rng.scope(`turn:${nextTurn}:bonus-consume:${owner}`) }, manifest);
      appendResolution(events, resolutionSteps, consume);
      s = consume.state;
    }
  }

  // Phase 5.5  Fire any SCHEDULED pending effects with when='START_OF_NEXT_TURN'.
  //            Consume each stable pending identity before executing its
  //            frozen effect so nested work cannot observe it as still due.
  {
    const scheduled = s.pendingEffects.filter(
      p =>
        p.when === 'START_OF_NEXT_TURN' &&
        p.fireTurn <= s.turn,
    );
    for (const pe of scheduled) {
      const consumed = executeRulesCommands(s, [{
        type: 'CONSUME_PENDING_EFFECT',
        pendingEffectId: pe.id,
        mode: 'EXECUTE',
        cause: {
          sourceId: pe.sourceId,
          effectKind: 'SYSTEM',
          reason: 'PENDING_START_OF_TURN_DUE',
        },
      }], { rng: rng.scope('scheduled-start'), depth: 0 }, manifest);
      appendResolution(events, resolutionSteps, consumed);
      s = consumed.state;
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
    const triggered = executeRulesCommands(
      s,
      commands,
      { rng: rng.scope('turn-start-reactions') },
      manifest,
    );
    appendResolution(events, resolutionSteps, triggered);
    s = triggered.state;
  }

  // Phase 6  Manifest-declared turn-start draws per owner, hand-cap permitting.
  for (const owner of ['P0', 'P1'] as const) {
    const draw = executeRulesCommands(
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
    appendResolution(events, resolutionSteps, draw);
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
      const reveal = executeRulesCommands(s, [{
        type: 'REVEAL_LOCATION',
        lane: laneId,
        locationId: loc.id,
        cause: {
          sourceId: loc.id,
          effectKind: 'SYSTEM',
          reason: 'TURN_START_LOCATION_REVEAL',
        },
      }], {
        rng: rng.scope(`location-reveal:${loc.id}`),
      }, manifest);
      appendResolution(events, resolutionSteps, reveal);
      s = reveal.state;
    }
  }

  return { events, resolutionSteps, state: s };
}

// ============================================================================
// Helpers
// ============================================================================

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
  const resolutionSteps: KernelResolutionStep[] = [];
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
    if (!card || card.lane === null) continue;
    const cause = {
      sourceId: id,
      effectKind: 'SYSTEM' as const,
      reason: card.lifecycle.framePlayed === undefined
        ? 'SCHEDULED_REVEAL'
        : 'COMMITTED_HAND_PLAY',
    };
    const res = executeRulesCommands(
      s,
      [
        card.lifecycle.framePlayed === undefined
          ? {
              type: 'REVEAL_CARD',
              cardId: id,
              depth: 0,
              cleanupSpell: true,
              cause,
            }
          : {
              type: 'PLAY_CARD',
              cardId: id,
              lane: card.lane,
              depth: 0,
              cause,
            },
      ],
      {
        rng: rng.scope(
          window === 'END_OF_GAME' ? `end-game:${id}` : `turn:${id}`,
        ),
      },
      manifest,
    );
    appendResolution(events, resolutionSteps, res);
    s = res.state;
  }
  return { events, resolutionSteps, state: s };
}

// Re-exports for Step 8+ wiring convenience.
export type { Rng };

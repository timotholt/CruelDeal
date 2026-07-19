/**
 * Effect evaluator + OR cascade. See spec §6.
 *
 * Contract:
 *   evalEffect(state, effect, ctx, manifest) → { events, state }
 *   revealPlayedCard(state, cardId, manifest, rng) → { events, state }
 *   triggerOnReveal(state, cardId, manifest, rng) → { events, state }
 *
 * Both return BOTH the emitted events AND the post-event state. Effects
 * mutate-by-emission: they produce a MatchEvent list AND apply each one
 * as they go while each governed lifecycle transition remains explicit.
 *
 * Determinism: every effect-time randomness point consumes the one gameplay
 * stream through a purpose-labeled scope.
 */

import type { EffectExpr, EffectRef, PoolRef, Selector } from '../types/ability';
import type { MatchState, SpawnSource } from '../types/state';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { MatchEvent } from '../types/events';
import type { Manifest } from '../manifest/types';
import type { Rng } from '../rng';
import { apply } from '../apply';
import { select, selectLanes } from '../projections/select';
import { evalNum } from '../projections/numexpr';
import { evalPredicate } from '../projections/select';
import { type EvalCtx } from '../projections/context';
import { findLanes } from '../projections/query';
import { isPowerBearingCard } from '../projections/power-bearing';
import { pickDefIdFromPool, resolveOwnerRef } from './pools';
import { invokeBuiltin } from './builtins';
import {
  addStoredPower,
  changeStoredPower,
} from '../kernel/powerTransaction';
import {
  resolveDestructionLifecycleTransaction,
  type FrozenLifecycleEffectContext,
} from '../kernel/lifecycleTransaction';
import {
  resolvePlacementTransaction,
  type FrozenPlacementEffectContext,
} from '../kernel/placementTransaction';
import {
  resolveRevealTransaction,
  type FrozenRevealEffectContext,
  type RevealCommand,
  type RevealWork,
} from '../kernel/revealTransaction';
import type { KernelWorkExpansion } from '../kernel/kernel';
import type { PlacementCommand } from '../kernel/operations/placement';
import {
  addCardTag,
  adjustCardCost,
  changeCardCounter,
  removeCardTag,
  replaceCardText,
  setCardCost,
} from '../operations/cardMutations';
import {
  addLocationTag,
  changeLocationCounter,
  destroyAllOtherLanes,
  destroyLane,
  replaceLocationCard,
  type LocationLifecycleResult,
} from '../locationLifecycle';
import { locationCardAtLane } from '../laneTopology';
import {
  getAllCardIds,
  getCardRuntime,
} from '../projections/cardRuntime';

export const MAX_REVEAL_RECURSION = 16;

/** Names of per-card triggered ability slots that fire outside the reveal
 *  cascade. Each slot is a `readonly EffectExpr[]` on `CardAbilities`. */
type TriggerSlot = 'onMove' | 'onDestroyed' | 'onDiscarded' | 'onAnyCardPlayedHere';

/**
 * Fire a named trigger slot for one card, with a frozen self-context
 * (useful when the underlying card has been moved/destroyed/discarded
 * and we still need to resolve SELF-relative selectors against its
 * state at event time). Returns the concatenated events + final state.
 *
 * Depth is inherited + 1 from `parentDepth` so triggered cascades
 * respect the same recursion cap as the OR evaluator.
 */
function fireCardTrigger(
  state: MatchState,
  cardId: CardId,
  selfLane: LaneId | null,
  selfOwner: Owner | null,
  slot: TriggerSlot,
  parentRng: Rng,
  parentDepth: number,
  manifest: Manifest,
): EvalResult {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card) return { events: [], state };
  const effs = card.text.abilities[slot];
  if (!effs || effs.length === 0) return { events: [], state };
  if (parentDepth >= MAX_REVEAL_RECURSION) {
    const diag: MatchEvent = { type: 'RECURSION_LIMIT_HIT', cardId, depth: parentDepth };
    return { events: [diag], state: apply(state, diag, manifest) };
  }
  const events: MatchEvent[] = [];
  let s = state;
  for (let j = 0; j < effs.length; j++) {
    const subCtx: EffectCtx = {
      state: s,
      manifest,
      self: cardId,
      selfKind: 'card',
      selfLane,
      selfOwner,
      rng: parentRng.scope(`${slot}:${cardId}:${j}`),
      source: {
        sourceId: cardId,
        effectKind: 'ON_REVEAL',
        exprIdx: j,
        reason: slot,
      },
      depth: parentDepth + 1,
    };
    const res = evalEffect(s, effs[j], subCtx, manifest);
    events.push(...res.events);
    s = res.state;
  }
  return { events, state: s };
}

/** Extra fields carried during effect evaluation, on top of EvalCtx. */
export interface EffectCtx extends EvalCtx {
  /** Forked Rng owned by THIS effect invocation. Always defined during
   *  effect evaluation (unlike raw EvalCtx where it's optional). */
  readonly rng: Rng;
  /** Where this effect originated (for CARD_* event `cause` fields). */
  readonly source: EffectRef;
  /** OR recursion depth. Incremented on nested reveal calls. */
  readonly depth: number;
}

export interface EvalResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

export interface DestroyCardsOptions {
  readonly source: EffectRef;
  readonly rng: Rng;
  readonly sourceLane: LaneId | null;
  readonly depth?: number;
}

/**
 * Governed card-destruction primitive shared by authored DESTROY effects and
 * structural operations such as lane destruction.
 *
 * This is deliberately more than a CARD_DESTROYED event constructor: it
 * honors destroy immunity and friendly-destroy gates, then runs the normal
 * card onDestroyed and location onCardDestroyedHere reactions in order.
 */
export function destroyCards(
  state: MatchState,
  cardIds: readonly CardId[],
  options: DestroyCardsOptions,
  manifest: Manifest,
): EvalResult {
  const commands = cardIds.map((cardId) => ({
    type: 'DESTROY_CARD' as const,
    cardId,
    cause: { ...options.source },
  }));
  const transaction = resolveDestructionLifecycleTransaction(
    state,
    commands,
    {
      manifest,
      baseDepth: options.depth ?? 0,
      interpretEffect: (candidate, effect, frozen) =>
        evalEffect(
          candidate,
          effect,
          effectContextFromLifecycle(
            candidate,
            frozen,
            options.rng,
            manifest,
          ),
          manifest,
        ),
    },
  );
  return { events: transaction.events, state: transaction.state };
}

export function banishCards(
  state: MatchState,
  cardIds: readonly CardId[],
  options: DestroyCardsOptions,
  manifest: Manifest,
): EvalResult {
  const commands = cardIds.map((cardId) => ({
    type: 'BANISH_CARD' as const,
    cardId,
    cause: { ...options.source },
  }));
  const transaction = resolveDestructionLifecycleTransaction(
    state,
    commands,
    {
      manifest,
      baseDepth: options.depth ?? 0,
      interpretEffect: (candidate, effect, frozen) =>
        evalEffect(
          candidate,
          effect,
          effectContextFromLifecycle(
            candidate,
            frozen,
            options.rng,
            manifest,
          ),
          manifest,
        ),
    },
  );
  return { events: transaction.events, state: transaction.state };
}

export interface PlacementCommandsOptions {
  readonly rng: Rng;
  readonly depth?: number;
}

/** Execute move/create/return/zone-change work through the canonical kernel. */
export function executePlacementCommands(
  state: MatchState,
  commands: readonly PlacementCommand[],
  options: PlacementCommandsOptions,
  manifest: Manifest,
): EvalResult {
  const transaction = resolvePlacementTransaction(state, commands, {
    manifest,
    baseDepth: options.depth ?? 0,
    interpretEffect: (candidate, reaction, frozen) => {
      if (reaction.kind === 'HAND_ENTRY') {
        return applyHandEntryDebuffs(
          candidate,
          reaction.cardId,
          reaction.owner,
          placementRng(options.rng, frozen),
          manifest,
        );
      }
      return evalEffect(
        candidate,
        reaction.effect,
        effectContextFromPlacement(candidate, frozen, options.rng, manifest),
        manifest,
      );
    },
  });
  return { events: transaction.events, state: transaction.state };
}

function placementRng(
  root: Rng,
  context: FrozenPlacementEffectContext,
): Rng {
  return context.scopePath.reduce(
    (scoped, purpose) => scoped.scope(purpose),
    root,
  );
}

function effectContextFromPlacement(
  state: MatchState,
  context: FrozenPlacementEffectContext,
  rootRng: Rng,
  manifest: Manifest,
): EffectCtx {
  return {
    state,
    manifest,
    self: context.self,
    selfKind: context.selfKind,
    selfLane: context.selfLane,
    selfOwner: context.selfOwner,
    eventCard: context.eventCard,
    eventLane: context.eventLane,
    eventOwner: context.eventOwner,
    source: context.source,
    depth: context.depth,
    rng: placementRng(rootRng, context),
  };
}

function effectContextFromLifecycle(
  state: MatchState,
  context: FrozenLifecycleEffectContext,
  rootRng: Rng,
  manifest: Manifest,
): EffectCtx {
  const rng = context.scopePath.reduce(
    (scoped, purpose) => scoped.scope(purpose),
    rootRng,
  );
  return {
    state,
    manifest,
    self: context.self,
    selfKind: context.selfKind,
    selfLane: context.selfLane,
    selfOwner: context.selfOwner,
    eventCard: context.eventCard,
    eventLane: context.eventLane,
    eventOwner: context.eventOwner,
    source: context.source,
    depth: context.depth,
    rng,
  };
}

const normalLaneOccupantDestruction = (
  state: MatchState,
  cardIds: readonly CardId[],
  laneId: LaneId,
  cause: EffectRef,
  rng: Rng,
  manifest: Manifest,
): EvalResult => destroyCards(state, cardIds, {
  source: cause,
  rng,
  sourceLane: laneId,
}, manifest);

export function destroyLaneWithNormalRules(
  state: MatchState,
  laneId: LaneId,
  source: EffectRef,
  rng: Rng,
  manifest: Manifest,
): LocationLifecycleResult {
  return destroyLane(state, laneId, {
    cause: source,
    rng,
    destroyOccupants: normalLaneOccupantDestruction,
  }, manifest);
}

export function destroyAllOtherLanesWithNormalRules(
  state: MatchState,
  survivor: LaneId,
  source: EffectRef,
  rng: Rng,
  manifest: Manifest,
): LocationLifecycleResult {
  return destroyAllOtherLanes(state, survivor, {
    cause: source,
    rng,
    destroyOccupants: normalLaneOccupantDestruction,
  }, manifest);
}

// ============================================================================
// Reveal cascade
// ============================================================================

function banishResolvedSpell(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number,
): EvalResult {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || card.domain !== 'spell' || card.zone !== 'LANE') {
    return { events: [], state };
  }
  return banishCards(state, [cardId], {
    source: {
      sourceId: cardId,
      effectKind: 'SYSTEM',
      reason: 'SPELL_RESOLVED',
    },
    rng,
    sourceLane: card.lane,
    depth,
  }, manifest);
}

/**
 * Reveal a newly-played/spawned card. This is the full "card was played here"
 * path: flip, fire On Reveal, then notify card/location played-here triggers.
 */
export function revealPlayedCard(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number = 0,
): EvalResult {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || card.lane === null) return { events: [], state };
  const cause: EffectRef = {
    sourceId: cardId,
    effectKind: 'SYSTEM',
    reason: card.lifecycle.framePlayed === undefined
      ? 'SCHEDULED_REVEAL'
      : 'COMMITTED_HAND_PLAY',
  };
  return executeRevealCommands(state, [
    card.lifecycle.framePlayed === undefined
      ? {
          type: 'REVEAL_CARD',
          cardId,
          depth,
          cleanupSpell: true,
          cause,
        }
      : {
          type: 'PLAY_CARD',
          cardId,
          lane: card.lane,
          depth,
          cause,
        },
  ], { rng }, manifest);
}

/**
 * Perform a card's real reveal during the explicit end-game reveal window.
 */
export function revealPlayedCardAtEndOfGame(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number = 0,
): EvalResult {
  return revealPlayedCard(state, cardId, manifest, rng, depth);
}

/**
 * Re-fire a card's On Reveal text without making "card played here" listeners
 * see a second play. This is the Odin/Backdoor-style path.
 */
export function triggerOnReveal(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number = 0,
): EvalResult {
  return executeRevealCommands(state, [{
    type: 'INVOKE_ON_REVEAL',
    cardId,
    reason: 'RETRIGGER',
    depth,
    cause: {
      sourceId: cardId,
      effectKind: 'ON_REVEAL',
      reason: 'RETRIGGER',
    },
  }], { rng }, manifest);
}

/**
 * Execute committed play/reveal/deploy/retrigger work through the canonical
 * kernel. Nested work stays on the same depth-first queue.
 */
export function executeRevealCommands(
  state: MatchState,
  commands: readonly RevealCommand[],
  options: { readonly rng: Rng },
  manifest: Manifest,
): EvalResult {
  const transaction = resolveRevealTransaction(state, commands, {
    manifest,
    expandAuthoredEffect: (candidate, effect, context) =>
      expandRevealAuthoredEffect(
        candidate,
        effect,
        context,
        options.rng,
        manifest,
      ),
    interpretAtomicEffect: (candidate, effect, context) =>
      evalEffect(
        candidate,
        effect,
        {
          ...context,
          state: candidate,
          rng: revealRng(options.rng, context),
        },
        manifest,
      ),
    cleanupSpell: (candidate, cardId, _cause, context) =>
      banishResolvedSpell(
        candidate,
        cardId,
        manifest,
        revealRng(options.rng, context).scope(`spell-cleanup:${cardId}`),
        context.depth,
      ),
  });
  return { events: transaction.events, state: transaction.state };
}

/**
 * Execute card/location trigger invocations through the same depth-first
 * transaction queue used by play, reveal, create-and-reveal, and retriggers.
 */
export const executeReactionCommands = executeRevealCommands;

function revealRng(
  root: Rng,
  context: FrozenRevealEffectContext,
): Rng {
  return context.scopePath.reduce(
    (rng, purpose) => rng.scope(purpose),
    root,
  );
}

function scopedRevealContext(
  context: FrozenRevealEffectContext,
  state: MatchState,
  suffix: string,
): FrozenRevealEffectContext {
  return {
    ...context,
    state,
    scopePath: [...context.scopePath, suffix],
  };
}

function expandRevealAuthoredEffect(
  state: MatchState,
  effect: EffectExpr,
  context: FrozenRevealEffectContext,
  rootRng: Rng,
  manifest: Manifest,
): KernelWorkExpansion<RevealWork> | null {
  const rng = revealRng(rootRng, context);
  const liveContext: EffectCtx = {
    ...context,
    state,
    rng,
  };
  if (effect.kind === 'SEQUENCE') {
    return {
      work: effect.items.map((item, index) => {
        const child = scopedRevealContext(
          context,
          state,
          `sequence:${index}`,
        );
        return {
          kind: 'EFFECT',
          effect: { kind: 'AUTHORED', effect: item },
          context: child,
          depth: context.depth,
        };
      }),
    };
  }
  if (effect.kind === 'CONDITIONAL') {
    const branch = evalPredicate(effect.if, liveContext)
      ? effect.then
      : effect.else ?? [];
    return {
      work: branch.map((item, index) => {
        const child = scopedRevealContext(
          context,
          state,
          `conditional:${index}`,
        );
        return {
          kind: 'EFFECT',
          effect: { kind: 'AUTHORED', effect: item },
          context: child,
          depth: context.depth,
        };
      }),
    };
  }
  if (effect.kind === 'FOREACH') {
    const targets = select(effect.over, liveContext);
    return {
      work: targets.flatMap((cardId, targetIndex) => {
        const card = getCardRuntime(state, cardId, manifest);
        return effect.do.map((item, effectIndex) => {
          const child = scopedRevealContext(
            {
              ...context,
              self: cardId,
              selfKind: 'card',
              selfLane: card?.lane ?? null,
              selfOwner: card?.owner ?? null,
              it: cardId,
            },
            state,
            `foreach:${targetIndex}:${effectIndex}`,
          );
          return {
            kind: 'EFFECT' as const,
            effect: { kind: 'AUTHORED' as const, effect: item },
            context: child,
            depth: context.depth,
          };
        });
      }),
    };
  }
  if (effect.kind === 'TRIGGER_ON_REVEAL') {
    return {
      work: select(effect.target, liveContext).map((cardId) => ({
        kind: 'COMMAND',
        command: {
          type: 'INVOKE_ON_REVEAL',
          cardId,
          reason: 'RETRIGGER',
          depth: context.depth + 1,
          cause: { ...context.source, reason: 'RETRIGGER' },
        },
      })),
    };
  }
  if (effect.kind === 'DEPLOY_FROM_DECK') {
    const owner = resolveOwnerRef(
      effect.owner,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (!owner) return { work: [] };
    return {
      work: selectLanes(effect.lane, liveContext).map((lane) => ({
        kind: 'COMMAND',
        command: {
          type: 'DEPLOY_FROM_DECK',
          owner,
          lane,
          depth: context.depth + 1,
          selection: effect.selection,
          cause: { ...context.source, reason: 'DEPLOY_FROM_DECK' },
        },
      })),
    };
  }
  if (
    effect.kind === 'CREATE_CARD_IN_ZONE'
    && effect.destination.kind === 'LANE'
    && !effect.setCost
    && !effect.adjustCost
  ) {
    const owner = resolveOwnerRef(
      effect.owner,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (!owner) return { work: [] };
    const defId = pickDefIdFromPool(
      effect.pool,
      state,
      manifest,
      liveContext.selfOwner,
      rng.scope('create:pool'),
      liveContext.eventOwner ?? null,
    );
    if (!defId) return { work: [] };
    const lanes = selectLanes(effect.destination.lane, liveContext);
    if (lanes.length === 0) return { work: [] };
    const lane = lanes.length === 1
      ? lanes[0]
      : rng.scope('create:lane').pick(lanes);
    const cardId = mintCardId(rng.scope('create:id'));
    return {
      work: [{
        kind: 'COMMAND',
        command: {
          type: 'CREATE_CARD',
          cardId,
          defId,
          owner,
          depth: context.depth + 1,
          destination: {
            kind: 'LANE',
            lane,
            revealed: effect.destination.revealed ?? true,
          },
          spawnSource: spawnSourceForSource(
            context.source,
            owner === context.selfOwner,
          ),
          cause: { ...context.source, reason: 'CREATE_AND_REVEAL' },
        },
      }],
    };
  }
  return null;
}

// ============================================================================
// evalEffect — one case per EffectExpr variant
// ============================================================================

export function evalEffect(
  state: MatchState,
  effect: EffectExpr,
  ctx: EffectCtx,
  manifest: Manifest,
): EvalResult {
  // Refresh selfLane/selfOwner off the live state each call — they can
  // change mid-cascade (e.g. after a MOVE emits CARD_MOVED on SELF).
  //
  // EXCEPTION: if the card is in a terminal zone (DESTROYED/DISCARD/
  // BANISHED), `liveSelf.lane` is null but the FROZEN `ctx.selfLane`
  // (captured by the trigger before the lifecycle event) still reflects
  // the card's board position at the moment the effect was scheduled.
  // Preserving it is what makes deathrattles / on-discard-in-lane work.
  const self = ctx.self as CardId | null;
  const liveSelf = self ? getCardRuntime(state, self, manifest) : null;
  const onBoard = liveSelf && liveSelf.lane !== null;
  const liveCtx: EffectCtx = liveSelf
    ? {
        ...ctx,
        state,
        selfLane: onBoard ? liveSelf.lane : ctx.selfLane,
        selfOwner: liveSelf.owner,
      }
    : { ...ctx, state };

  switch (effect.kind) {
    // ---- Power math ------------------------------------------------------

    case 'ADD_POWER': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        if (!isPowerBearingCard(s, id, manifest)) continue;
        const perTargetCtx: EffectCtx = {
          ...liveCtx,
          state: s,
          self: id,
          selfKind: 'card',
          selfLane: getCardRuntime(s, id, manifest)?.lane ?? null,
          selfOwner: getCardRuntime(s, id, manifest)?.owner ?? null,
        };
        const delta = evalNum(effect.delta, perTargetCtx);
        const change = addStoredPower(s, id, delta, ctx.source, manifest);
        events.push(...change.events);
        s = change.state;
      }
      return { events, state: s };
    }

    case 'SET_POWER': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        if (!isPowerBearingCard(s, id, manifest)) continue;
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;
        const value = evalNum(effect.value, { ...liveCtx, state: s, self: id });
        const change = changeStoredPower(
          s,
          id,
          { kind: 'SET', value },
          ctx.source,
          manifest,
        );
        events.push(...change.events);
        s = change.state;
      }
      return { events, state: s };
    }

    case 'ADJUST_COST': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const perTargetCtx: EffectCtx = {
          ...liveCtx,
          state: s,
          self: id,
          selfKind: 'card',
          selfLane: getCardRuntime(s, id, manifest)?.lane ?? null,
          selfOwner: getCardRuntime(s, id, manifest)?.owner ?? null,
        };
        const delta = evalNum(effect.delta, perTargetCtx);
        if (delta === 0) continue;
        const mutation = adjustCardCost(s, id, delta, ctx.source, manifest);
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    // ---- Lifecycle -------------------------------------------------------

    case 'DESTROY': {
      const targets = select(effect.target, liveCtx);
      return destroyCards(state, targets, {
        source: ctx.source,
        rng: ctx.rng,
        sourceLane: ctx.selfLane,
        depth: ctx.depth,
      }, manifest);
    }

    case 'DESTROY_OTHER_LANES': {
      if (liveCtx.selfLane === null) return { events: [], state };
      const result = destroyAllOtherLanesWithNormalRules(
        state,
        liveCtx.selfLane,
        ctx.source,
        ctx.rng.scope(`destroy-other-lanes:${liveCtx.selfLane}`),
        manifest,
      );
      return result.ok
        ? { events: result.events, state: result.state }
        : { events: [], state };
    }

    case 'BANISH': {
      const targets = select(effect.target, liveCtx);
      return banishCards(state, targets, {
        source: ctx.source,
        rng: ctx.rng,
        sourceLane: ctx.selfLane,
        depth: ctx.depth,
      }, manifest);
    }

    case 'DISCARD': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const preCard = getCardRuntime(s, id, manifest);
        const preOwner = preCard?.owner ?? null;
        const e: MatchEvent = {
          type: 'CARD_DISCARDED',
          cardId: id,
          reason: 'FORCED_EFFECT',
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
        // Discard happens from hand, so selfLane is null.
        const trig = fireCardTrigger(s, id, null, preOwner, 'onDiscarded', ctx.rng, ctx.depth, manifest);
        events.push(...trig.events);
        s = trig.state;
      }
      return { events, state: s };
    }

    case 'MOVE': {
      const targets = select(effect.target, liveCtx);
      // Capacity must be filtered before a random destination is sampled.
      // Otherwise RANDOM_N can select a full lane and turn an otherwise legal
      // move into a silent no-op.
      const destinationSelector = effect.to.kind === 'RANDOM_N'
        ? effect.to.of
        : effect.to;
      const destLanes = selectLanes(destinationSelector, liveCtx);
      if (destLanes.length === 0) return { events: [], state };
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = getCardRuntime(s, id, manifest);
        if (!card || card.lane === null) continue;
        // Per-target destination: forked off ctx.rng so two simultaneous
        // MOVEs don't collide deterministic-stream-wise.
        const subRng = ctx.rng.scope(`move:${id}`);
        // Valid destination = candidate lane, not current lane, has capacity for owner.
        const filtered = findLanes(s, manifest, {
          laneId: destLanes,
          hasCapacity: card.owner,
          not: { laneId: card.lane },
        });
        if (filtered.length === 0) continue;
        const toLane = filtered.length === 1 ? filtered[0] : subRng.pick(filtered);
        const moved = executePlacementCommands(s, [{
          type: 'MOVE_CARD',
          cardId: id,
          toLane,
          cause: ctx.source,
        }], {
          rng: ctx.rng.scope(`placementMove:${id}`),
          depth: ctx.depth,
        }, manifest);
        events.push(...moved.events);
        s = moved.state;
      }
      return { events, state: s };
    }

    // ---- Deck / hand plumbing --------------------------------------------

    case 'DRAW': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const count = Math.max(0, Math.floor(evalNum(effect.count, liveCtx)));
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < count; i++) {
        const deck = s.deck[owner];
        if (deck.length === 0) break;
        const topCardId = deck[0]; // top-of-deck is index 0; DECK_SHUFFLED
                              // established that convention.
        if (s.hand[owner].length >= manifest.constants.handCap) break;
        const e: MatchEvent = {
          type: 'CARD_DRAWN',
          owner,
          cardId: topCardId,
          toHand: true,
        };
        events.push(e);
        s = apply(s, e, manifest);
        const debuff = applyHandEntryDebuffs(
          s,
          topCardId,
          owner,
          ctx.rng.scope(`debuff:${topCardId}`),
          manifest,
        );
        events.push(...debuff.events);
        s = debuff.state;
      }
      return { events, state: s };
    }

    case 'CREATE_CARD_IN_ZONE': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const defId = pickDefIdFromPool(effect.pool, state, manifest, ctx.selfOwner, ctx.rng.scope('pool'), ctx.eventOwner ?? null);
      if (!defId) return { events: [], state };
      const newId = mintCardId(ctx.rng.scope('id'));
      const spawnSource: SpawnSource = spawnSourceForSource(ctx.source, owner === ctx.selfOwner);
      const setCreatedCost = (
        currentState: MatchState,
        precedingEvents: MatchEvent[],
      ): EvalResult => {
        if (effect.setCost && effect.adjustCost) {
          throw new Error('CREATE_CARD_IN_ZONE cannot set and adjust cost together');
        }
        const mutation = effect.setCost
          ? setCardCost(
              currentState,
              newId,
              Math.max(
                0,
                Math.floor(evalNum(effect.setCost, {
                  ...liveCtx,
                  state: currentState,
                })),
              ),
              ctx.source,
              manifest,
            )
          : effect.adjustCost
            ? adjustCardCost(
                currentState,
                newId,
                Math.trunc(evalNum(effect.adjustCost, {
                  ...liveCtx,
                  state: currentState,
                })),
                ctx.source,
                manifest,
              )
            : { events: [], state: currentState };
        return {
          events: [...precedingEvents, ...mutation.events],
          state: mutation.state,
        };
      };

      switch (effect.destination.kind) {
        case 'HAND': {
          const created = executePlacementCommands(state, [{
            type: 'CREATE_CARD',
            owner,
            cardId: newId,
            defId,
            depth: ctx.depth,
            spawnSource,
            destination: { kind: 'HAND' },
            cause: ctx.source,
          }], { rng: ctx.rng.scope('createHand'), depth: ctx.depth }, manifest);
          return setCreatedCost(created.state, [...created.events]);
        }

        case 'DECK': {
          const created = executePlacementCommands(state, [{
            type: 'CREATE_CARD',
            owner,
            cardId: newId,
            defId,
            depth: ctx.depth,
            spawnSource,
            destination: {
              kind: 'DECK',
              position: effect.destination.position,
            },
            cause: ctx.source,
          }], { rng: ctx.rng.scope('createDeck'), depth: ctx.depth }, manifest);
          return setCreatedCost(created.state, [...created.events]);
        }

        case 'LANE': {
          const lanes = selectLanes(effect.destination.lane, liveCtx);
          if (lanes.length === 0) return { events: [], state };
          const lane = lanes.length === 1 ? lanes[0] : ctx.rng.scope('lane').pick(lanes);
          const created = executeRevealCommands(state, [{
            type: 'CREATE_CARD',
            owner,
            cardId: newId,
            defId,
            depth: ctx.depth,
            spawnSource,
            destination: {
              kind: 'LANE',
              lane,
              revealed: effect.destination.revealed ?? true,
            },
            cause: ctx.source,
          }], { rng: ctx.rng.scope('createLane') }, manifest);
          return setCreatedCost(created.state, [...created.events]);
        }

        default:
          return { events: [], state };
      }
    }

    case 'MOVE_CARD_TO_ZONE': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;

        if (effect.destination.kind === 'LANE') {
          const lanes = selectLanes(effect.destination.lane, { ...liveCtx, state: s });
          if (lanes.length === 0) continue;
          const lane = lanes.length === 1 ? lanes[0] : ctx.rng.scope(`moveZone:${id}`).pick(lanes);
          if (s.lanesById[lane].cards[card.owner].length >= manifest.constants.laneCapacity) continue;
          const moved = executePlacementCommands(s, [{
            type: 'CHANGE_CARD_ZONE',
            cardId: id,
            destination: {
              kind: 'LANE',
              lane,
              revealed: effect.destination.revealed ?? false,
            },
            cause: ctx.source,
          }], {
            rng: ctx.rng.scope(`moveZone:${id}`),
            depth: ctx.depth,
          }, manifest);
          events.push(...moved.events);
          s = moved.state;
          continue;
        }

        const moved = executePlacementCommands(s, [{
          type: 'CHANGE_CARD_ZONE',
          cardId: id,
          destination: effect.destination,
          cause: ctx.source,
        }], {
          rng: ctx.rng.scope(`moveZone:${id}`),
          depth: ctx.depth,
        }, manifest);
        events.push(...moved.events);
        s = moved.state;
      }
      return { events, state: s };
    }

    case 'RETURN_TO_LANE': {
      const targets = select(effect.target, liveCtx);
      const lanes = selectLanes(effect.to, liveCtx);
      if (lanes.length === 0) return { events: [], state };
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;
        const candidates = findLanes(s, manifest, {
          laneId: lanes,
          hasCapacity: card.owner,
        });
        if (candidates.length === 0) continue;
        const lane = candidates.length === 1 ? candidates[0] : ctx.rng.scope(`return:${id}`).pick(candidates);
        const returned = executePlacementCommands(s, [{
          type: 'RETURN_CARD',
          cardId: id,
          lane,
          revealed: effect.revealed ?? true,
          cause: ctx.source,
        }], {
          rng: ctx.rng.scope(`return:${id}`),
          depth: ctx.depth,
        }, manifest);
        events.push(...returned.events);
        s = returned.state;
      }
      return { events, state: s };
    }

    case 'DEPLOY_FROM_DECK': {
      const owner = resolveOwnerRef(
        effect.owner,
        liveCtx.selfOwner,
        liveCtx.eventOwner ?? null,
      );
      if (!owner) return { events: [], state };
      const lanes = selectLanes(effect.lane, liveCtx);
      if (lanes.length === 0) return { events: [], state };
      return executeRevealCommands(
        state,
        lanes.map((lane) => ({
          type: 'DEPLOY_FROM_DECK',
          owner,
          lane,
          selection: effect.selection,
          depth: ctx.depth + 1,
          cause: { ...ctx.source, reason: 'DEPLOY_FROM_DECK' },
        })),
        { rng: ctx.rng.scope('deploy-from-deck') },
        manifest,
      );
    }

    case 'TRANSFORM_CARD': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;
        const defId = pickDefIdFromPool(effect.pool, s, manifest, card.owner, ctx.rng.scope(`transform:${id}`), ctx.eventOwner ?? null);
        if (!defId || defId === card.defId) continue;
        if (effect.resetStats) {
          const powerReset = changeStoredPower(
            s,
            id,
            { kind: 'RESET' },
            ctx.source,
            manifest,
          );
          events.push(...powerReset.events);
          s = powerReset.state;
        }
        const e: MatchEvent = {
          type: 'CARD_TRANSFORMED',
          cardId: id,
          oldDefId: card.defId,
          newDefId: defId,
          cause: ctx.source,
          resetStats: effect.resetStats,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'SCHEDULE_REVEAL': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = getCardRuntime(s, id, manifest);
        if (!card || card.zone !== 'LANE' || card.revealed) continue;
        const perTargetCtx: EffectCtx = {
          ...liveCtx,
          state: s,
          self: id,
          selfKind: 'card',
          selfLane: card.lane,
          selfOwner: card.owner,
        };
        const timing = effect.timing.kind === 'END_OF_GAME'
          ? { kind: 'END_OF_GAME' as const }
          : {
              kind: 'TURN' as const,
              turn: Math.max(1, Math.floor(evalNum(effect.timing.turn, perTargetCtx))),
            };
        const event: MatchEvent = {
          type: 'CARD_REVEAL_SCHEDULED',
          cardId: id,
          timing,
          cause: ctx.source,
        };
        events.push(event);
        s = apply(s, event, manifest);
      }
      return { events, state: s };
    }

    case 'TRIGGER_ON_REVEAL': {
      // Fires OR of some OTHER already-in-play card (Odin, Vision).
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const subRng = ctx.rng.scope(`trigger:${id}`);
        const nested = triggerOnReveal(s, id, manifest, subRng, ctx.depth + 1);
        events.push(...nested.events);
        s = nested.state;
      }
      return { events, state: s };
    }

    // ---- Tags / counters / location mutations ----------------------------

    case 'ADD_CARD_TAG': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      const runtimeTag = resolveCardTagSpec(effect.tag, ctx.source);
      if (!runtimeTag) return { events, state };
      for (const id of targets) {
        const mutation = addCardTag(s, id, runtimeTag, ctx.source, manifest);
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'REMOVE_CARD_TAG': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const mutation = removeCardTag(
          s,
          id,
          effect.tag as never,
          ctx.source,
          manifest,
        );
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'ADD_LOCATION_TAG': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const lane of lanes) {
        const mutation = addLocationTag(
          s,
          lane,
          effect.tag,
          ctx.source,
          manifest,
        );
        if (!mutation.ok) continue;
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'REPLACE_LOCATION': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const lane of lanes) {
        const prev = locationCardAtLane(s, lane);
        if (!prev) continue;
        const newId = `loc-${lane}-${ctx.rng.scope(`replace:${lane}`).int(0, 2 ** 30).toString(36)}` as import('../types/ids').LocationCardInstanceId;
        const replacement = replaceLocationCard(s, lane, {
          newId,
          newDefId: effect.newDefId,
          cause: ctx.source,
          oldDestination: 'DISCARD',
          revealPolicy: 'KEEP_SLOT_SCHEDULE',
        }, manifest);
        if (!replacement.ok) continue;
        events.push(...replacement.events);
        s = replacement.state;
      }
      return { events, state: s };
    }

    case 'MODIFY_COUNTER': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const delta = evalNum(effect.delta, { ...liveCtx, state: s, self: id });
        if (delta === 0) continue;
        const mutation = changeCardCounter(
          s,
          id,
          effect.name,
          delta,
          ctx.source,
          manifest,
        );
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'MODIFY_LOCATION_COUNTER': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      const owner = effect.owner ? resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null) : undefined;
      if (effect.owner && !owner) return { events, state };
      for (const lane of lanes) {
        const delta = Math.trunc(evalNum(effect.delta, { ...liveCtx, state: s }));
        if (delta === 0) continue;
        const mutation = changeLocationCounter(
          s,
          lane,
          effect.name,
          delta,
          ctx.source,
          manifest,
          owner ?? undefined,
        );
        if (!mutation.ok) continue;
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'COPY_TEXT_OF': {
      const into = select(effect.into, liveCtx);
      const source = select(effect.source, liveCtx);
      if (source.length === 0) return { events: [], state };
      const srcCard = getCardRuntime(state, source[0], manifest);
      if (!srcCard) return { events: [], state };
      const copyKind = effect.copyKind ?? 'FULL';
      const abilities = copyKind === 'ON_REVEAL'
        ? {
            ...(srcCard.text.abilities.onReveal
              ? { onReveal: srcCard.text.abilities.onReveal }
              : {}),
          }
        : srcCard.text.abilities;
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of into) {
        const mutation = replaceCardText(
          s,
          id,
          {
            kind: 'COPIED_TEXT',
            sourceCardId: srcCard.id,
            sourceDefId: srcCard.defId,
            scope: copyKind === 'ON_REVEAL' ? 'ON_REVEAL' : 'ALL',
            abilities,
            rulesText: srcCard.text.rulesText,
          },
          ctx.source,
          manifest,
        );
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'RESET_POWER': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        if (!isPowerBearingCard(s, id, manifest)) continue;
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;
        const change = changeStoredPower(
          s,
          id,
          { kind: 'RESET' },
          ctx.source,
          manifest,
        );
        events.push(...change.events);
        s = change.state;
      }
      return { events, state: s };
    }

    case 'REMOVE_TEXT': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;
        const textKind = effect.textKind;
        const override = textKind === 'ONGOING' ? { kind: 'BLANK_ONGOING' as const }
                       : textKind === 'ALL'     ? { kind: 'BLANK_ALL' as const }
                       : null; // 'ON_REVEAL' — no TextOverride kind for that yet; skip
        if (!override) continue;
        const mutation = replaceCardText(
          s,
          id,
          override,
          ctx.source,
          manifest,
        );
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'REMOVE_COPIED_TEXT': {
      // Clear an immutable copied-text snapshot.
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;
        const ov = card.text.override;
        if (ov?.kind !== 'COPIED_TEXT') continue;
        const mutation = replaceCardText(
          s,
          id,
          null,
          ctx.source,
          manifest,
        );
        events.push(...mutation.events);
        s = mutation.state;
      }
      return { events, state: s };
    }

    case 'ADD_PENDING': {
      const runtime = resolvePendingEffectSpec(effect.effect, ctx, state, manifest);
      if (!runtime) return { events: [], state };
      const e: MatchEvent = { type: 'PENDING_EFFECT_ADDED', effect: runtime };
      return { events: [e], state: apply(state, e, manifest) };
    }

    // ---- Control flow ----------------------------------------------------

    case 'SEQUENCE': {
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < effect.items.length; i++) {
        const sub = effect.items[i];
        const subCtx: EffectCtx = { ...ctx, rng: ctx.rng.scope(`seq${i}`) };
        const res = evalEffect(s, sub, subCtx, manifest);
        events.push(...res.events);
        s = res.state;
      }
      return { events, state: s };
    }

    case 'CONDITIONAL': {
      const branch = evalPredicate(effect.if, liveCtx) ? effect.then : (effect.else ?? []);
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < branch.length; i++) {
        const sub = branch[i];
        const subCtx: EffectCtx = { ...ctx, rng: ctx.rng.scope(`cond${i}`) };
        const res = evalEffect(s, sub, subCtx, manifest);
        events.push(...res.events);
        s = res.state;
      }
      return { events, state: s };
    }

    case 'FOREACH': {
      const iter = select(effect.over, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < iter.length; i++) {
        const it = iter[i];
        for (let j = 0; j < effect.do.length; j++) {
          const sub = effect.do[j];
          const iterCard = getCardRuntime(s, it, manifest);
          const subCtx: EffectCtx = {
            ...ctx,
            state: s,
            self: it,
            selfKind: 'card',
            selfLane: iterCard?.lane ?? null,
            selfOwner: iterCard?.owner ?? null,
            it,
            rng: ctx.rng.scope(`fe:${it}:${j}`),
          };
          const res = evalEffect(s, sub, subCtx, manifest);
          events.push(...res.events);
          s = res.state;
        }
      }
      return { events, state: s };
    }

    // ---- Energy ----------------------------------------------------------

    case 'ADJUST_ENERGY': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      const e: MatchEvent = { type: 'ENERGY_CHANGED', owner, delta, reason: 'EFFECT', cause: ctx.source };
      return { events: [e], state: apply(state, e, manifest) };
    }

    case 'ADJUST_MAX_ENERGY': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      const e: MatchEvent = { type: 'MAX_ENERGY_CHANGED', owner, delta, reason: 'EFFECT' };
      return { events: [e], state: apply(state, e, manifest) };
    }

    case 'ADJUST_NEXT_TURN_ENERGY_BONUS': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      const e: MatchEvent = { type: 'NEXT_TURN_ENERGY_BONUS_CHANGED', owner, delta };
      return { events: [e], state: apply(state, e, manifest) };
    }

    // ---- Escape hatch ----------------------------------------------------

    case 'CALL_BUILTIN':
      return invokeBuiltin(
        state,
        effect.fn,
        effect.args ?? {},
        ctx,
        manifest,
        { destroyCards, banishCards, executePlacementCommands },
      );
  }
}

/** Apply DEBUFF_ENEMY_ON_HAND_ENTRY ongoings to a card that just entered hand.
 *  Call after every CARD_DRAWN or hand-destination CARD_CREATED event. */
export function applyHandEntryDebuffs(
  state: MatchState,
  cardId: CardId,
  newOwner: Owner,
  rng: Rng,
  manifest: Manifest,
): { events: MatchEvent[]; state: MatchState } {
  if (!isPowerBearingCard(state, cardId, manifest)) return { events: [], state };
  const oppOwner: Owner = newOwner === 'P0' ? 'P1' : 'P0';
  const events: MatchEvent[] = [];
  let s = state;
  for (const id of getAllCardIds(s)) {
    const card = getCardRuntime(s, id, manifest);
    if (!card || card.owner !== oppOwner || card.zone !== 'LANE' || !card.revealed) continue;
    for (const expr of card.text.abilities.ongoing ?? []) {
      const b = expr as any;
      if (b.kind !== 'CALL_BUILTIN' || b.fn !== 'DEBUFF_ENEMY_ON_HAND_ENTRY') continue;
      const delta: number = b.args?.delta ?? -1;
      if (delta === 0) continue;
      const change = addStoredPower(
        s,
        cardId,
        delta,
        {
          sourceId: card.id,
          effectKind: 'ONGOING',
          reason: 'DEBUFF_ENEMY_ON_HAND_ENTRY',
        },
        manifest,
      );
      events.push(...change.events);
      s = change.state;
    }
  }
  return { events, state: s };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compose a SpawnSource for cards minted by an effect.
 * - Location-sourced effects → LOCATION_CREATED
 * - Card-sourced effects on your side → CARD_CREATED
 * - Card-sourced effects placing on opp's side → ENEMY_CREATED
 */
function spawnSourceForSource(source: EffectRef, toOurSide: boolean): SpawnSource {
  if (source.effectKind === 'LOCATION') {
    return { kind: 'LOCATION_CREATED', sourceLocationId: source.sourceId as import('../types/ids').LocationCardInstanceId };
  }
  const sourceCardId = source.sourceId as CardId;
  return toOurSide
    ? { kind: 'CARD_CREATED', sourceCardId }
    : { kind: 'ENEMY_CREATED', sourceCardId };
}

/**
 * Resolve an authoring-time CardTagSpec into a runtime CardTag by
 * dereferencing any `sourceRef` fields against the active source.
 * Returns null when the spec requires a source the ctx can't supply
 * (e.g. location-sourced ONGOING_DISABLED with sourceRef='SELF').
 */
function resolveCardTagSpec(
  spec: import('../types/ability').CardTagSpec,
  source: EffectRef,
): import('../types/state').CardTag | null {
  switch (spec.kind) {
    case 'MOVED_THIS_TURN':
    case 'DESTROYED_THIS_TURN':
    case 'SHURI_DOUBLED':
      return { kind: spec.kind };
    case 'ONGOING_DISABLED':
      return { kind: 'ONGOING_DISABLED', sourceId: source.sourceId as CardId };
    case 'FROM_SPAWN':
      return { kind: 'FROM_SPAWN', sourceId: source.sourceId as CardId };
    case 'DESTROY_IMMUNE':
      return { kind: 'DESTROY_IMMUNE' };
    case 'PLAYED_THIS_TURN':
    case 'EVER_MOVED':
      return { kind: spec.kind };
  }
}

/**
 * Resolve an authoring-time PendingEffectSpec into a runtime PendingEffect
 * by filling in owner/lane/sourceId from the source card's context.
 */
function resolvePendingEffectSpec(
  spec: import('../types/ability').PendingEffectSpec,
  ctx: EffectCtx,
  state: MatchState,
  manifest: Manifest,
): import('../types/state').PendingEffect | null {
  const sourceId = ctx.source.sourceId as CardId;
  const sourceCard = getCardRuntime(state, sourceId, manifest);
  const owner = ctx.selfOwner ?? sourceCard?.owner ?? null;
  const lane = ctx.selfLane ?? sourceCard?.lane ?? null;
  switch (spec.kind) {
    case 'SHURI_DOUBLE_NEXT':
    case 'COULSON_TRIGGER_NEXT':
      if (owner === null || lane === null) return null;
      return { kind: spec.kind, owner, lane, sourceId };
    case 'EGO_OVERRIDE':
      // Authoring-time spec has no turn; default to current + 1 (next turn).
      return { kind: 'EGO_OVERRIDE', turn: state.turn + 1 };
    case 'RICKETY_BRIDGE_DESTROY':
      if (lane === null) return null;
      return { kind: 'RICKETY_BRIDGE_DESTROY', lane, atEndOfTurn: state.turn };
    case 'SCHEDULED':
      // Freeze sourceOwner/sourceLane at authoring time so the scheduled
      // effect resolves SELF-relative selectors correctly even if the
      // source card moves or is destroyed before it fires.
      return {
        kind: 'SCHEDULED',
        when: spec.when,
        sourceId,
        sourceOwner: owner,
        sourceLane: lane,
        fireTurn: state.turn + 1,
        effect: spec.effect,
      };
  }
}

/** Generate a deterministic fresh card id from an rng fork. */
function mintCardId(rng: Rng): CardId {
  const a = rng.int(0, 2 ** 31 - 1).toString(36);
  const b = rng.int(0, 2 ** 31 - 1).toString(36);
  return `c-${a}${b}` as CardId;
}

/**
 * Unused helper exported for parity with spec vocabulary — future callers
 * (Step 7) may want to test lane resolution independently.
 * eslint: keep named export to satisfy downstream imports.
 */
export function resolveLaneDestination(
  sel: Selector,
  ctx: EvalCtx,
  rng: Rng,
): LaneId | null {
  const lanes = selectLanes(sel, { ...ctx, rng });
  if (lanes.length === 0) return null;
  return lanes.length === 1 ? lanes[0] : rng.pick(lanes);
}

// Parameter export for debugging callers.
export type { PoolRef, Owner };

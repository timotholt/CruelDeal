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
import { invokeBuiltin, planBuiltinRevealCreations } from './builtins';
import {
  resolveStoredPowerTransaction,
  type FrozenPowerEffectContext,
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
  resolveHandTransaction,
  type FrozenHandEffectContext,
} from '../kernel/handTransaction';
import { resolveCostTransaction } from '../kernel/costTransaction';
import { resolveEnergyTransaction } from '../kernel/energyTransaction';
import { resolveCardMetadataTransaction } from '../kernel/cardMetadataTransaction';
import { resolveLocationMetadataTransaction } from '../kernel/locationMetadataTransaction';
import {
  resolvePendingEffectTransaction,
  type PendingEffectCommand,
} from '../kernel/pendingEffectTransaction';
import {
  resolveTransformTransaction,
  type TransformCardCommand,
} from '../kernel/transformTransaction';
import {
  resolveRevealTransaction,
  type FrozenRevealEffectContext,
  type RevealCommand,
  type RevealWork,
} from '../kernel/revealTransaction';
import type { KernelWorkExpansion } from '../kernel/kernel';
import type { PlacementCommand } from '../kernel/operations/placement';
import type { HandCommand } from '../kernel/operations/hand';
import type {
  ChangeCostCommand,
  ChangeCardCounterCommand,
  ChangeCardTagCommand,
  ChangeEnergyCommand,
  ChangeLocationCounterCommand,
  ChangeLocationTagCommand,
  ChangeStoredPowerCommand,
  OverrideCardTextCommand,
} from '../kernel/types';
import {
  destroyAllOtherLanes,
  destroyLane,
  replaceLocationCard,
  type LocationLifecycleResult,
} from '../locationLifecycle';
import { locationCardAtLane } from '../laneTopology';
import { getCardRuntime } from '../projections/cardRuntime';

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
    interpretEffect: (candidate, reaction, frozen) =>
      evalEffect(
        candidate,
        reaction.effect,
        effectContextFromPlacement(candidate, frozen, options.rng, manifest),
        manifest,
      ),
  });
  return { events: transaction.events, state: transaction.state };
}

/** Execute draw/discard work through the canonical hand transaction. */
export function executeHandCommands(
  state: MatchState,
  commands: readonly HandCommand[],
  options: PlacementCommandsOptions,
  manifest: Manifest,
): EvalResult {
  const transaction = resolveHandTransaction(state, commands, {
    manifest,
    baseDepth: options.depth ?? 0,
    interpretEffect: (candidate, reaction, frozen) =>
      evalEffect(
        candidate,
        reaction.effect,
        effectContextFromHand(candidate, frozen, options.rng, manifest),
        manifest,
      ),
  });
  return { events: transaction.events, state: transaction.state };
}

/** Execute stored-Power mutations and their immediate reactions atomically. */
export function executePowerCommands(
  state: MatchState,
  commands: readonly ChangeStoredPowerCommand[],
  options: PlacementCommandsOptions,
  manifest: Manifest,
): EvalResult {
  const transaction = resolveStoredPowerTransaction(state, commands, {
    manifest,
    baseDepth: options.depth ?? 0,
    interpretEffect: (candidate, reaction, frozen) =>
      evalEffect(
        candidate,
        reaction.effect,
        effectContextFromPower(candidate, frozen, options.rng, manifest),
        manifest,
      ),
  });
  return { events: transaction.events, state: transaction.state };
}

/** Execute permanent Cost mutations through the canonical kernel. */
export function executeCostCommands(
  state: MatchState,
  commands: readonly ChangeCostCommand[],
  manifest: Manifest,
): EvalResult {
  const transaction = resolveCostTransaction(state, commands, manifest);
  return { events: transaction.events, state: transaction.state };
}

/** Execute current, maximum, and next-turn Energy mutations canonically. */
export function executeEnergyCommands(
  state: MatchState,
  commands: readonly ChangeEnergyCommand[],
  manifest: Manifest,
): EvalResult {
  const transaction = resolveEnergyTransaction(state, commands, manifest);
  return { events: transaction.events, state: transaction.state };
}

/** Execute tags, counters, and text overrides through the canonical kernel. */
export function executeCardMetadataCommands(
  state: MatchState,
  commands: readonly (
    | ChangeCardTagCommand
    | ChangeCardCounterCommand
    | OverrideCardTextCommand
  )[],
  manifest: Manifest,
): EvalResult {
  const transaction = resolveCardMetadataTransaction(
    state,
    commands,
    manifest,
  );
  return { events: transaction.events, state: transaction.state };
}

/** Execute location tags and counters through stable location-card identity. */
export function executeLocationMetadataCommands(
  state: MatchState,
  commands: readonly (
    | ChangeLocationTagCommand
    | ChangeLocationCounterCommand
  )[],
  manifest: Manifest,
): EvalResult {
  const transaction = resolveLocationMetadataTransaction(
    state,
    commands,
    manifest,
  );
  return { events: transaction.events, state: transaction.state };
}

/** Schedule, execute, or cancel pending work through stable match-local IDs. */
export function executePendingEffectCommands(
  state: MatchState,
  commands: readonly PendingEffectCommand[],
  options: PlacementCommandsOptions,
  manifest: Manifest,
): EvalResult {
  const transaction = resolvePendingEffectTransaction(state, commands, {
    manifest,
    interpretEffect: (candidate, pending) =>
      evalEffect(
        candidate,
        pending.effect,
        {
          state: candidate,
          manifest,
          self: pending.sourceId,
          selfKind: pending.scheduledBy.effectKind === 'LOCATION'
            ? 'location'
            : 'card',
          selfLane: pending.sourceLane,
          selfOwner: pending.sourceOwner,
          rng: options.rng.scope(`pending:${pending.id}`),
          source: {
            sourceId: pending.sourceId,
            effectKind: pending.scheduledBy.effectKind === 'LOCATION'
              ? 'LOCATION'
              : 'ON_REVEAL',
            reason: pending.when === 'START_OF_NEXT_TURN'
              ? 'SCHEDULED_START_OF_NEXT_TURN'
              : 'SCHEDULED_END_OF_NEXT_TURN',
          },
          depth: options.depth ?? 0,
        },
        manifest,
      ),
  });
  return { events: transaction.events, state: transaction.state };
}

/** Resolve definition selection and transform metadata policy atomically. */
export function executeTransformCommands(
  state: MatchState,
  commands: readonly TransformCardCommand[],
  options: PlacementCommandsOptions,
  manifest: Manifest,
): EvalResult {
  const transaction = resolveTransformTransaction(state, commands, {
    manifest,
    baseDepth: options.depth ?? 0,
    interpretEffect: (candidate, reaction, frozen) =>
      evalEffect(
        candidate,
        reaction.effect,
        effectContextFromPower(candidate, frozen, options.rng, manifest),
        manifest,
      ),
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

function effectContextFromHand(
  state: MatchState,
  context: FrozenHandEffectContext,
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
    rng: context.scopePath.reduce(
      (scoped, purpose) => scoped.scope(purpose),
      rootRng,
    ),
    source: { ...context.source },
    depth: context.depth,
  };
}

function effectContextFromPower(
  state: MatchState,
  context: FrozenPowerEffectContext,
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
    rng: context.scopePath.reduce(
      (scoped, purpose) => scoped.scope(purpose),
      rootRng,
    ),
    source: { ...context.source },
    depth: context.depth,
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
  if (effect.kind === 'CALL_BUILTIN') {
    const plans = planBuiltinRevealCreations(
      state,
      effect.fn,
      liveContext,
      manifest,
    );
    if (plans === null) return null;
    return {
      work: plans.flatMap((plan, index): RevealWork[] => {
        const childContext = scopedRevealContext(
          {
            ...context,
            eventCard: plan.cardId,
            eventLane: plan.lane,
            eventOwner: plan.owner,
          },
          state,
          `builtin:${effect.fn}:${plan.lane}:${index}`,
        );
        const create: RevealWork = {
          kind: 'COMMAND',
          command: {
            type: 'CREATE_CARD',
            cardId: plan.cardId,
            defId: plan.defId,
            owner: plan.owner,
            depth: context.depth + 1,
            destination: {
              kind: 'LANE',
              lane: plan.lane,
              revealed: true,
            },
            spawnSource: plan.spawnSource,
            cause: {
              ...context.source,
              reason: `BUILTIN_${effect.fn}_CREATE_AND_REVEAL`,
            },
          },
        };
        if (plan.powerDelta === 0) return [create];
        return [
          create,
          {
            kind: 'EFFECT',
            effect: {
              kind: 'AUTHORED',
              effect: {
                kind: 'ADD_POWER',
                target: { kind: 'EVENT_CARD' },
                delta: { kind: 'LIT', n: plan.powerDelta },
              },
            },
            context: childContext,
            depth: context.depth + 1,
          },
        ];
      }),
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
        const change = executePowerCommands(s, [{
          type: 'CHANGE_STORED_POWER',
          cardId: id,
          mutation: { kind: 'ADD', delta },
          cause: { ...ctx.source },
        }], {
          rng: ctx.rng.scope(`power-add:${id}`),
          depth: ctx.depth,
        }, manifest);
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
        const change = executePowerCommands(s, [{
          type: 'CHANGE_STORED_POWER',
          cardId: id,
          mutation: { kind: 'SET', value },
          cause: { ...ctx.source },
        }], {
          rng: ctx.rng.scope(`power-set:${id}`),
          depth: ctx.depth,
        }, manifest);
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
        const mutation = executeCostCommands(s, [{
          type: 'CHANGE_COST',
          cardId: id,
          mutation: { kind: 'ADD', delta },
          cause: { ...ctx.source },
        }], manifest);
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
      return executeHandCommands(
        state,
        targets.map((cardId) => ({
          type: 'DISCARD_CARD' as const,
          cardId,
          reason: 'FORCED_EFFECT' as const,
          cause: { ...ctx.source },
        })),
        {
          rng: ctx.rng.scope('discard'),
          depth: ctx.depth,
        },
        manifest,
      );
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
      return executeHandCommands(
        state,
        Array.from({ length: count }, () => ({
          type: 'DRAW_CARD' as const,
          owner,
          selection: { kind: 'TOP' as const },
          cause: { ...ctx.source },
        })),
        {
          rng: ctx.rng.scope('draw'),
          depth: ctx.depth,
        },
        manifest,
      );
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
          ? executeCostCommands(currentState, [{
              type: 'CHANGE_COST',
              cardId: newId,
              mutation: {
                kind: 'SET',
                value: Math.max(
                  0,
                  Math.floor(evalNum(effect.setCost, {
                    ...liveCtx,
                    state: currentState,
                  })),
                ),
              },
              cause: { ...ctx.source },
            }], manifest)
          : effect.adjustCost
            ? executeCostCommands(currentState, [{
                type: 'CHANGE_COST',
                cardId: newId,
                mutation: {
                  kind: 'ADD',
                  delta: Math.trunc(evalNum(effect.adjustCost, {
                    ...liveCtx,
                    state: currentState,
                  })),
                },
                cause: { ...ctx.source },
              }], manifest)
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
      for (const cardId of targets) {
        const card = getCardRuntime(s, cardId, manifest);
        if (!card) continue;
        const newDefId = pickDefIdFromPool(
          effect.pool,
          s,
          manifest,
          card.owner,
          ctx.rng.scope(`transform:${cardId}`),
          ctx.eventOwner ?? null,
        );
        if (!newDefId || newDefId === card.defId) continue;
        const transformed = executeTransformCommands(
          s,
          [{
            type: 'TRANSFORM_CARD',
            cardId,
            newDefId,
            metadataPolicy: effect.metadataPolicy,
            cause: { ...ctx.source },
          }],
          { rng: ctx.rng, depth: ctx.depth },
          manifest,
        );
        events.push(...transformed.events);
        s = transformed.state;
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
      const runtimeTag = resolveCardTagSpec(effect.tag, ctx.source);
      if (!runtimeTag) return { events: [], state };
      return executeCardMetadataCommands(
        state,
        targets.map(id => ({
          type: 'CHANGE_CARD_TAG',
          cardId: id,
          mutation: { kind: 'ADD', tag: runtimeTag },
          cause: { ...ctx.source },
        })),
        manifest,
      );
    }

    case 'REMOVE_CARD_TAG': {
      const targets = select(effect.target, liveCtx);
      return executeCardMetadataCommands(
        state,
        targets.map(id => ({
          type: 'CHANGE_CARD_TAG',
          cardId: id,
          mutation: { kind: 'REMOVE', tag: effect.tag },
          cause: { ...ctx.source },
        })),
        manifest,
      );
    }

    case 'ADD_LOCATION_TAG': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const locationIds = lanes.flatMap(lane => {
        const location = locationCardAtLane(state, lane);
        return location ? [location.id] : [];
      });
      return executeLocationMetadataCommands(
        state,
        locationIds.map(locationId => ({
          type: 'CHANGE_LOCATION_TAG',
          locationId,
          mutation: { kind: 'ADD', tag: effect.tag },
          cause: { ...ctx.source },
        })),
        manifest,
      );
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
      return executeCardMetadataCommands(
        state,
        targets.map(id => ({
          type: 'CHANGE_CARD_COUNTER',
          cardId: id,
          name: effect.name,
          delta: evalNum(effect.delta, { ...liveCtx, self: id }),
          cause: { ...ctx.source },
        })),
        manifest,
      );
    }

    case 'MODIFY_LOCATION_COUNTER': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const owner = effect.owner ? resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null) : undefined;
      if (effect.owner && !owner) return { events: [], state };
      const locationIds = lanes.flatMap(lane => {
        const location = locationCardAtLane(state, lane);
        return location ? [location.id] : [];
      });
      const events: MatchEvent[] = [];
      let candidate = state;
      for (const locationId of locationIds) {
        const delta = Math.trunc(evalNum(effect.delta, {
          ...liveCtx,
          state: candidate,
        }));
        const transaction = executeLocationMetadataCommands(
          candidate,
          [{
            type: 'CHANGE_LOCATION_COUNTER',
            locationId,
            name: effect.name,
            owner: owner ?? null,
            delta,
            cause: { ...ctx.source },
          }],
          manifest,
        );
        events.push(...transaction.events);
        candidate = transaction.state;
      }
      return { events, state: candidate };
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
      const mutation = executeCardMetadataCommands(
        state,
        into.map(id => ({
          type: 'OVERRIDE_CARD_TEXT',
          cardId: id,
          override: {
            kind: 'COPIED_TEXT',
            sourceCardId: srcCard.id,
            sourceDefId: srcCard.defId,
            scope: copyKind === 'ON_REVEAL' ? 'ON_REVEAL' : 'ALL',
            abilities,
            rulesText: srcCard.text.rulesText,
          },
          cause: { ...ctx.source },
        })),
        manifest,
      );
      events.push(...mutation.events);
      return { events, state: mutation.state };
    }

    case 'RESET_POWER': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        if (!isPowerBearingCard(s, id, manifest)) continue;
        const card = getCardRuntime(s, id, manifest);
        if (!card) continue;
        const change = executePowerCommands(s, [{
          type: 'CHANGE_STORED_POWER',
          cardId: id,
          mutation: { kind: 'RESET' },
          cause: { ...ctx.source },
        }], {
          rng: ctx.rng.scope(`power-reset:${id}`),
          depth: ctx.depth,
        }, manifest);
        events.push(...change.events);
        s = change.state;
      }
      return { events, state: s };
    }

    case 'REMOVE_TEXT': {
      const targets = select(effect.target, liveCtx);
      const commands: OverrideCardTextCommand[] = [];
      for (const id of targets) {
        const card = getCardRuntime(state, id, manifest);
        if (!card) continue;
        const abilities = structuredClone(card.text.abilities);
        if (effect.textKind === 'ON_REVEAL') {
          if (abilities.onReveal === undefined) continue;
          delete abilities.onReveal;
        } else if (effect.textKind === 'ONGOING') {
          if (abilities.ongoing === undefined) continue;
          delete abilities.ongoing;
        } else {
          if (Object.keys(abilities).length === 0) continue;
          for (
            const slot of Object.keys(abilities) as (keyof typeof abilities)[]
          ) {
            delete abilities[slot];
          }
        }
        const priorOverride = card.text.override;
        const copiedFrom = priorOverride?.kind === 'COPIED_TEXT'
          ? {
              sourceCardId: priorOverride.sourceCardId,
              sourceDefId: priorOverride.sourceDefId,
              scope: priorOverride.scope,
            }
          : priorOverride?.kind === 'BLANKED_TEXT'
            ? priorOverride.copiedFrom
            : null;
        commands.push({
          type: 'OVERRIDE_CARD_TEXT',
          cardId: id,
          override: {
            kind: 'BLANKED_TEXT',
            abilities,
            // Rules text is not segmented by ability slot. Empty is truthful;
            // retaining the old prose would describe a removed ability.
            rulesText: '',
            copiedFrom,
          },
          cause: { ...ctx.source },
        });
      }
      return executeCardMetadataCommands(state, commands, manifest);
    }

    case 'REMOVE_COPIED_TEXT': {
      // Clear an immutable copied-text snapshot.
      const targets = select(effect.target, liveCtx);
      const commands: OverrideCardTextCommand[] = [];
      for (const id of targets) {
        const card = getCardRuntime(state, id, manifest);
        if (!card) continue;
        const ov = card.text.override;
        if (
          ov?.kind !== 'COPIED_TEXT'
          && !(ov?.kind === 'BLANKED_TEXT' && ov.copiedFrom !== null)
        ) continue;
        commands.push({
          type: 'OVERRIDE_CARD_TEXT',
          cardId: id,
          override: null,
          cause: { ...ctx.source },
        });
      }
      return executeCardMetadataCommands(state, commands, manifest);
    }

    case 'ADD_PENDING': {
      const runtime = resolvePendingEffectSpec(effect.effect, ctx, state, manifest);
      if (!runtime) return { events: [], state };
      return executePendingEffectCommands(state, [{
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: runtime,
        cause: { ...ctx.source },
      }], { rng: ctx.rng, depth: ctx.depth }, manifest);
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
      return executeEnergyCommands(state, [{
        type: 'CHANGE_ENERGY',
        target: 'CURRENT',
        owner,
        delta,
        reason: 'EFFECT',
        cause: { ...ctx.source },
      }], manifest);
    }

    case 'ADJUST_MAX_ENERGY': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      return executeEnergyCommands(state, [{
        type: 'CHANGE_ENERGY',
        target: 'MAXIMUM',
        owner,
        delta,
        reason: 'EFFECT',
        cause: { ...ctx.source },
      }], manifest);
    }

    case 'ADJUST_NEXT_TURN_ENERGY_BONUS': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      return executeEnergyCommands(state, [{
        type: 'CHANGE_ENERGY',
        target: 'NEXT_TURN_BONUS',
        owner,
        delta,
        reason: 'EFFECT',
        cause: { ...ctx.source },
      }], manifest);
    }

    // ---- Escape hatch ----------------------------------------------------

    case 'CALL_BUILTIN':
      return invokeBuiltin(
        state,
        effect.fn,
        effect.args ?? {},
        ctx,
        manifest,
        {
          destroyCards,
          banishCards,
          executePlacementCommands,
          executeRevealCommands,
          executeHandCommands,
          executePowerCommands,
          executeCostCommands,
          executeCardMetadataCommands,
          executePendingEffectCommands,
          executeTransformCommands,
        },
      );
  }
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
    case 'SHURI_DOUBLED':
      return { kind: spec.kind };
    case 'ONGOING_DISABLED':
      return { kind: 'ONGOING_DISABLED', sourceId: source.sourceId as CardId };
    case 'FROM_SPAWN':
      return { kind: 'FROM_SPAWN', sourceId: source.sourceId as CardId };
    case 'DESTROY_IMMUNE':
      return { kind: 'DESTROY_IMMUNE' };
  }
}

/**
 * Resolve an authoring-time PendingEffectSpec into a frozen runtime payload
 * by filling in owner/lane/sourceId from the source card's context.
 */
function resolvePendingEffectSpec(
  spec: import('../types/ability').PendingEffectSpec,
  ctx: EffectCtx,
  state: MatchState,
  manifest: Manifest,
): import('../types/state').PendingEffectPayload | null {
  const sourceId = ctx.source.sourceId;
  const sourceCard = ctx.selfKind === 'card'
    ? getCardRuntime(state, sourceId as CardId, manifest)
    : null;
  const owner = ctx.selfOwner ?? sourceCard?.owner ?? null;
  const lane = ctx.selfLane ?? sourceCard?.lane ?? null;
  // Freeze sourceOwner/sourceLane at authoring time so the scheduled effect
  // resolves SELF-relative selectors correctly even if the source card moves
  // or is destroyed before it fires.
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

/**
 * Canonical authored-rule interpreter.
 *
 * Present-tense commands and immutable authored effects are lowered onto one
 * private rules-kernel queue. This module does not expose the superseded
 * direct-effect, manual-trigger, or domain-specific transaction façades.
 */

import type { EffectExpr, EffectRef } from '../types/ability';
import type { MatchState, SpawnSource } from '../types/state';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { MatchEvent } from '../types/events';
import type { Manifest } from '../manifest/types';
import type { Rng } from '../rng';
import { select, selectLanes } from '../projections/select';
import { evalNum } from '../projections/numexpr';
import { evalPredicate } from '../projections/select';
import { type EvalCtx } from '../projections/context';
import { findLanes } from '../projections/query';
import { isPowerBearingCard } from '../projections/power-bearing';
import { getCardPower } from '../projections/power';
import { getCardTemplate } from '../projections/cardTemplate';
import { activePowerContributions } from '../powerLedger';
import {
  listDefIdsFromPool,
  pickDefIdFromPool,
  resolveOwnerRef,
} from './pools';
import {
  planBuiltinCommands,
  planBuiltinRevealCreations,
} from './builtinCommandPlanner';
import {
  kernelStepFailure,
  kernelStepSuccess,
  type KernelStepResult,
  type KernelWorkExpansion,
} from '../kernel/kernel';
import {
  resolveRulesTransaction,
  resolveRulesWorkTransaction,
  type CanonicalEffectContext,
  type CanonicalRulesEffect,
  type CanonicalRulesWork,
  type RulesCommand,
} from '../kernel/rulesTransaction';
import type { ResolutionBudget } from '../kernel/contracts';
import type { KernelBudgetUsage } from '../kernel/kernel';
import type { KernelResolutionStep } from '../kernel/resolutionTrace';
import type { CommittedTransition } from '../kernel/types';
import type { CanonicalRulesSemantics } from '../kernel/rulesTransaction';
import { activeLaneIds, locationCardAtLane } from '../laneTopology';
import {
  getCardLifecycle,
  getCardRuntime,
} from '../projections/cardRuntime';

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
  readonly transitions: readonly CommittedTransition<
    MatchEvent,
    CanonicalRulesSemantics
  >[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
  readonly usage: KernelBudgetUsage;
}

export interface RulesExecutionOptions {
  readonly rng: Rng;
  readonly depth?: number;
  readonly budget?: ResolutionBudget;
}

/**
 * Execute location-card and lane-topology work through one domain transaction.
 *
 * Authored reactions discovered by that transaction are lowered into the same
 * work queue with their frozen source context and scoped RNG. No location
 * operation may recursively open another public domain transaction.
 */
export function executeRulesCommands(
  state: MatchState,
  commands: readonly RulesCommand[],
  options: RulesExecutionOptions,
  manifest: Manifest,
): EvalResult {
  const transactionOptions = {
    manifest,
    baseDepth: options.depth ?? 0,
    ...(options.budget === undefined ? {} : { budget: options.budget }),
    expandEffect: (candidate, effect, frozen) =>
      expandCanonicalAuthoredEffect(
        candidate,
        effect,
        frozen,
        options.rng,
        manifest,
      ),
  };
  const transaction = resolveRulesTransaction(
    state,
    commands,
    transactionOptions,
  );
  return transaction;
}

/**
 * Internal testkit seam for seeding authored EFFECT work without inventing a
 * second mutation executor. Production callers enter through commands.
 */
export function executeCanonicalRulesWork(
  state: MatchState,
  work: readonly CanonicalRulesWork[],
  options: RulesExecutionOptions,
  manifest: Manifest,
): EvalResult {
  const transaction = resolveRulesWorkTransaction(state, work, {
    manifest,
    baseDepth: options.depth ?? 0,
    expandEffect: (candidate, effect, frozen) =>
      expandCanonicalAuthoredEffect(
        candidate,
        effect,
        frozen,
        options.rng,
        manifest,
      ),
  });
  return transaction;
}

function authoredCanonicalEffect(
  effect: CanonicalRulesEffect,
): EffectExpr {
  if (effect.kind === 'AUTHORED') return effect.effect;
  if (
    effect.kind === 'RESOLVE_STAGED_REVEAL_TIMING'
    || effect.kind === 'COMPLETE_PLAY'
    || effect.kind === 'SPELL_CLEANUP'
    || effect.kind === 'AWARD_POWER_FOR_DESTROYED_CARDS'
    || effect.kind === 'CHANGE_STORED_POWER_IF_CARD_ZONE'
  ) {
    throw new Error(
      `${effect.kind} must be consumed by the canonical rules router`,
    );
  }
  return effect;
}

function effectContextFromCanonicalRules(
  state: MatchState,
  context: CanonicalEffectContext,
  rootRng: Rng,
  manifest: Manifest,
): EffectCtx {
  return {
    state,
    manifest,
    self: context.self as CardId | import('../types/ids').LocationCardInstanceId,
    selfKind: context.selfKind,
    selfLane: context.selfLane,
    selfOwner: context.selfOwner,
    eventCard: typeof context.eventCard === 'string'
      ? context.eventCard as CardId
      : null,
    eventLane: typeof context.eventLane === 'number'
      ? context.eventLane as LaneId
      : null,
    eventOwner: context.eventOwner === 'P0' || context.eventOwner === 'P1'
      ? context.eventOwner
      : null,
    ...(
      typeof context.it === 'string'
        ? { it: context.it as CardId }
        : {}
    ),
    source: { ...context.source },
    depth: context.depth,
    rng: context.scopePath.reduce(
      (scoped, purpose) => scoped.scope(purpose),
      rootRng,
    ),
  };
}

function scopedCanonicalEffectContext(
  context: CanonicalEffectContext,
  suffix: string,
  overrides: Partial<CanonicalEffectContext> = {},
): CanonicalEffectContext {
  return {
    ...context,
    ...overrides,
    scopePath: [...context.scopePath, suffix],
  } as CanonicalEffectContext;
}

/**
 * Keep every authored command discovered inside control flow on the existing
 * domain work queue.
 */
function expandCanonicalAuthoredEffect(
  state: MatchState,
  wrapped: CanonicalRulesEffect,
  context: CanonicalEffectContext,
  rootRng: Rng,
  manifest: Manifest,
): KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>> {
  const effect = authoredCanonicalEffect(wrapped);
  const liveContext = effectContextFromCanonicalRules(
    state,
    context,
    rootRng,
    manifest,
  );

  if (effect.kind === 'SEQUENCE') {
    return kernelStepSuccess({
      work: effect.items.map((item, index): CanonicalRulesWork => ({
        kind: 'EFFECT',
        effect: item,
        context: scopedCanonicalEffectContext(
          context,
          `sequence:${index}`,
        ),
        depth: context.depth,
      })),
    });
  }

  if (effect.kind === 'CONDITIONAL') {
    const branch = evalPredicate(effect.if, liveContext)
      ? effect.then
      : effect.else ?? [];
    return kernelStepSuccess({
      work: branch.map((item, index): CanonicalRulesWork => ({
        kind: 'EFFECT',
        effect: item,
        context: scopedCanonicalEffectContext(
          context,
          `conditional:${index}`,
        ),
        depth: context.depth,
      })),
    });
  }

  if (effect.kind === 'FOREACH') {
    const targets = select(effect.over, liveContext);
    return kernelStepSuccess({
      work: targets.flatMap((cardId, targetIndex) => {
        const card = getCardRuntime(state, cardId, manifest);
        return effect.do.map((item, effectIndex): CanonicalRulesWork => ({
          kind: 'EFFECT',
          effect: item,
          context: scopedCanonicalEffectContext(
            context,
            `foreach:${targetIndex}:${effectIndex}`,
            {
              self: cardId,
              selfKind: 'card',
              selfLane: card?.lane ?? null,
              selfOwner: card?.owner ?? null,
              it: cardId,
            },
          ),
          depth: context.depth,
        }));
      }),
    });
  }

  if (effect.kind === 'DESTROY_OTHER_LANES') {
    if (liveContext.selfLane === null) {
      return kernelStepSuccess({ work: [] });
    }
    return kernelStepSuccess({
      work: [{
        kind: 'COMMAND',
        command: {
          type: 'DESTROY_OTHER_LANES',
          survivor: liveContext.selfLane,
          cause: { ...context.source },
        },
      }],
    });
  }

  if (effect.kind === 'REPLACE_LOCATION') {
    const lanes = selectLanes(effect.lane, liveContext);
    const commands: CanonicalRulesWork[] = [];
    for (const lane of lanes) {
      const previous = locationCardAtLane(state, lane);
      if (!previous) continue;
      const rng = liveContext.rng.scope(`replace:${lane}`);
      commands.push({
        kind: 'COMMAND',
        command: {
          type: 'REPLACE_LOCATION',
          lane,
          oldId: previous.id,
          newId: `loc-${lane}-${rng.int(0, 2 ** 30).toString(36)}` as import('../types/ids').LocationCardInstanceId,
          newDefId: effect.newDefId,
          oldDestination: 'DISCARD',
          revealPolicy: 'KEEP_SLOT_SCHEDULE',
          cause: { ...context.source },
        },
      });
    }
    return kernelStepSuccess({ work: commands });
  }

  const commandWork = (
    commands: readonly RulesCommand[],
  ): KernelStepResult<KernelWorkExpansion<CanonicalRulesWork>> =>
    kernelStepSuccess({
      work: commands.map((command): CanonicalRulesWork => ({
        kind: 'COMMAND',
        command,
      })),
    });

  if (effect.kind === 'ADD_POWER' || effect.kind === 'SET_POWER') {
    return commandWork(
      select(effect.target, liveContext).flatMap((cardId) => {
        if (!isPowerBearingCard(state, cardId, manifest)) return [];
        const card = getCardRuntime(state, cardId, manifest);
        if (!card) return [];
        const targetContext: EffectCtx = {
          ...liveContext,
          self: cardId,
          selfKind: 'card',
          selfLane: card.lane,
          selfOwner: card.owner,
        };
        return [{
          type: 'CHANGE_STORED_POWER' as const,
          cardId,
          mutation: effect.kind === 'ADD_POWER'
            ? {
                kind: 'ADD' as const,
                delta: evalNum(effect.delta, targetContext),
              }
            : {
                kind: 'SET' as const,
                value: evalNum(effect.value, targetContext),
              },
          cause: { ...context.source },
        }];
      }),
    );
  }

  if (effect.kind === 'RESET_POWER') {
    return commandWork(select(effect.target, liveContext).map(cardId => ({
      type: 'CHANGE_STORED_POWER',
      cardId,
      mutation: { kind: 'RESET' },
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'ADJUST_COST') {
    return commandWork(select(effect.target, liveContext).flatMap((cardId) => {
      const card = getCardRuntime(state, cardId, manifest);
      if (!card) return [];
      const delta = evalNum(effect.delta, {
        ...liveContext,
        self: cardId,
        selfKind: 'card',
        selfLane: card.lane,
        selfOwner: card.owner,
      });
      return delta === 0
        ? []
        : [{
            type: 'CHANGE_COST' as const,
            cardId,
            mutation: { kind: 'ADD' as const, delta },
            cause: { ...context.source },
          }];
    }));
  }

  if (
    effect.kind === 'ADJUST_ENERGY'
    || effect.kind === 'ADJUST_MAX_ENERGY'
    || effect.kind === 'ADJUST_NEXT_TURN_ENERGY_BONUS'
  ) {
    const owner = resolveOwnerRef(
      effect.owner,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (!owner) return kernelStepSuccess({ work: [] });
    const delta = Math.trunc(evalNum(effect.delta, liveContext));
    if (delta === 0) return kernelStepSuccess({ work: [] });
    return commandWork([{
      type: 'CHANGE_ENERGY',
      target: effect.kind === 'ADJUST_ENERGY'
        ? 'CURRENT'
        : effect.kind === 'ADJUST_MAX_ENERGY'
          ? 'MAXIMUM'
          : 'NEXT_TURN_BONUS',
      owner,
      delta,
      reason: 'EFFECT',
      cause: { ...context.source },
    }]);
  }

  if (effect.kind === 'DESTROY' || effect.kind === 'BANISH') {
    return commandWork(select(effect.target, liveContext).map(cardId => ({
      type: effect.kind === 'DESTROY' ? 'DESTROY_CARD' : 'BANISH_CARD',
      cardId,
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'DISCARD') {
    return commandWork(select(effect.target, liveContext).map(cardId => ({
      type: 'DISCARD_CARD',
      cardId,
      reason: 'FORCED_EFFECT',
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'DRAW') {
    const owner = resolveOwnerRef(
      effect.owner,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (!owner) return kernelStepSuccess({ work: [] });
    const count = Math.max(0, Math.floor(evalNum(effect.count, liveContext)));
    return commandWork(Array.from({ length: count }, () => ({
      type: 'DRAW_CARD',
      owner,
      selection: { kind: 'TOP' },
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'CREATE_CARDS_IN_ZONE') {
    if (effect.setCost && effect.adjustCost) {
      return kernelStepFailure({
        code: 'INVALID_OPERATION_OUTPUT',
        message: 'CREATE_CARDS_IN_ZONE cannot set and adjust cost together.',
        sourceInstanceId: String(context.source.sourceId),
      });
    }
    const owner = resolveOwnerRef(
      effect.owner,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (!owner) return kernelStepSuccess({ work: [] });
    const candidates = listDefIdsFromPool(
      effect.pool,
      state,
      manifest,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (candidates.length === 0) return kernelStepSuccess({ work: [] });
    const requestedCount = Math.max(0, Math.floor(evalNum(effect.count, liveContext)));
    if (requestedCount === 0) return kernelStepSuccess({ work: [] });
    const poolRng = liveContext.rng.scope('pool');
    const defIds: string[] = [];
    const remaining = [...candidates];
    for (let index = 0; index < requestedCount; index++) {
      const source = effect.replacement === 'WITHOUT_REPLACEMENT'
        ? remaining
        : candidates;
      if (source.length === 0) break;
      const pickedIndex = poolRng.int(0, source.length - 1);
      defIds.push(source[pickedIndex]!);
      if (effect.replacement === 'WITHOUT_REPLACEMENT') {
        remaining.splice(pickedIndex, 1);
      }
    }
    if (defIds.length === 0) return kernelStepSuccess({ work: [] });
    const spawnSource = spawnSourceForSource(
      context.source,
      owner === liveContext.selfOwner,
    );
    let destination: Extract<
      RulesCommand,
      { type: 'CREATE_CARD' }
    >['destination'];
    if (effect.destination.kind === 'LANE') {
      const lanes = selectLanes(effect.destination.lane, liveContext);
      if (lanes.length === 0) return kernelStepSuccess({ work: [] });
      const lane = lanes.length === 1
        ? lanes[0]
        : liveContext.rng.scope('lane').pick(lanes);
      destination = {
        kind: 'LANE',
        lane,
        revealed: effect.destination.revealed ?? true,
      };
    } else {
      destination = effect.destination;
    }
    const commands: RulesCommand[] = [];
    for (const [index, defId] of defIds.entries()) {
      const cardId = mintCardId(liveContext.rng.scope(`id:${index}`));
      commands.push({
        type: 'CREATE_CARD',
        owner,
        cardId,
        defId,
        depth: context.depth,
        spawnSource,
        destination,
        cause: { ...context.source },
      });
      if (effect.setCost) {
        commands.push({
          type: 'CHANGE_COST',
          cardId,
          mutation: {
            kind: 'SET',
            value: Math.max(
              0,
              Math.floor(evalNum(effect.setCost, liveContext)),
            ),
          },
          cause: { ...context.source },
        });
      } else if (effect.adjustCost) {
        commands.push({
          type: 'CHANGE_COST',
          cardId,
          mutation: {
            kind: 'ADD',
            delta: Math.trunc(evalNum(effect.adjustCost, liveContext)),
          },
          cause: { ...context.source },
        });
      }
    }
    return commandWork(commands);
  }

  if (effect.kind === 'COPY_CARDS_TO_ZONE') {
    const owner = resolveOwnerRef(
      effect.owner,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (!owner) return kernelStepSuccess({ work: [] });

    let destination: Extract<
      RulesCommand,
      { type: 'CREATE_CARD' }
    >['destination'];
    if (effect.destination.kind === 'LANE') {
      const lanes = selectLanes(effect.destination.lane, liveContext);
      if (lanes.length === 0) return kernelStepSuccess({ work: [] });
      const lane = lanes.length === 1
        ? lanes[0]
        : liveContext.rng.scope('copy-lane').pick(lanes);
      destination = {
        kind: 'LANE',
        lane,
        revealed: effect.destination.revealed ?? true,
      };
    } else {
      destination = effect.destination;
    }

    const commands: RulesCommand[] = [];
    for (const [index, sourceId] of select(effect.target, liveContext).entries()) {
      const sourceCard = getCardRuntime(state, sourceId, manifest);
      const template = sourceCard
        ? getCardTemplate(manifest, sourceCard.defId)
        : null;
      if (!sourceCard || !template) continue;

      const cardId = mintCardId(liveContext.rng.scope(`copy-id:${index}`));
      commands.push({
        type: 'CREATE_CARD',
        owner,
        cardId,
        defId: sourceCard.defId,
        depth: context.depth,
        spawnSource: { kind: 'COPY_OF', sourceCardId: sourceId },
        destination,
        cause: { ...context.source },
      });

      if (template.basePower !== null) {
        for (const contribution of activePowerContributions(
          sourceCard,
          template.basePower,
        )) {
          commands.push({
            type: 'CHANGE_STORED_POWER',
            cardId,
            mutation: { kind: 'ADD', delta: contribution.delta },
            cause: { ...context.source },
          });
        }
      }

      if (effect.setCost) {
        commands.push({
          type: 'CHANGE_COST',
          cardId,
          mutation: {
            kind: 'SET',
            value: Math.max(
              0,
              Math.floor(evalNum(effect.setCost, liveContext)),
            ),
          },
          cause: { ...context.source },
        });
      } else if (sourceCard.costDelta !== 0) {
        commands.push({
          type: 'CHANGE_COST',
          cardId,
          mutation: { kind: 'ADD', delta: sourceCard.costDelta },
          cause: { ...context.source },
        });
      }

      for (const tag of sourceCard.tags) {
        commands.push({
          type: 'CHANGE_CARD_TAG',
          cardId,
          mutation: { kind: 'ADD', tag: structuredClone(tag) },
          cause: { ...context.source },
        });
      }
      if (sourceCard.text.override !== null) {
        commands.push({
          type: 'OVERRIDE_CARD_TEXT',
          cardId,
          override: structuredClone(sourceCard.text.override),
          cause: { ...context.source },
        });
      }
      for (const [name, value] of Object.entries(sourceCard.counters)) {
        if (value === 0) continue;
        commands.push({
          type: 'CHANGE_CARD_COUNTER',
          cardId,
          name,
          delta: value,
          cause: { ...context.source },
        });
      }
    }
    return commandWork(commands);
  }

  if (effect.kind === 'DEPLOY_FROM_DECK') {
    const owner = resolveOwnerRef(
      effect.owner,
      liveContext.selfOwner,
      liveContext.eventOwner ?? null,
    );
    if (!owner) return kernelStepSuccess({ work: [] });
    return commandWork(selectLanes(effect.lane, liveContext).map(lane => ({
      type: 'DEPLOY_FROM_DECK',
      owner,
      lane,
      selection: effect.selection,
      depth: context.depth + 1,
      cause: { ...context.source, reason: 'DEPLOY_FROM_DECK' },
    })));
  }

  if (effect.kind === 'MOVE') {
    const destinationSelector = effect.to.kind === 'RANDOM_N'
      ? effect.to.of
      : effect.to;
    const destinations = selectLanes(destinationSelector, liveContext);
    const commands: RulesCommand[] = [];
    for (const cardId of select(effect.target, liveContext)) {
      const card = getCardRuntime(state, cardId, manifest);
      if (!card || card.lane === null) continue;
      const candidates = findLanes(state, manifest, {
        laneId: destinations,
        hasCapacity: card.owner,
        not: { laneId: card.lane },
      });
      if (candidates.length === 0) continue;
      commands.push({
        type: 'MOVE_CARD',
        cardId,
        toLane: candidates.length === 1
          ? candidates[0]
          : liveContext.rng.scope(`move:${cardId}`).pick(candidates),
        cause: { ...context.source },
      });
    }
    return commandWork(commands);
  }

  if (effect.kind === 'MOVE_CARD_TO_ZONE') {
    const commands: RulesCommand[] = [];
    for (const cardId of select(effect.target, liveContext)) {
      const card = getCardRuntime(state, cardId, manifest);
      if (!card) continue;
      if (effect.destination.kind !== 'LANE') {
        commands.push({
          type: 'CHANGE_CARD_ZONE',
          cardId,
          destination: effect.destination,
          cause: { ...context.source },
        });
        continue;
      }
      const lanes = selectLanes(effect.destination.lane, liveContext);
      if (lanes.length === 0) continue;
      const lane = lanes.length === 1
        ? lanes[0]
        : liveContext.rng.scope(`moveZone:${cardId}`).pick(lanes);
      commands.push({
        type: 'CHANGE_CARD_ZONE',
        cardId,
        destination: {
          kind: 'LANE',
          lane,
          revealed: effect.destination.revealed ?? false,
        },
        cause: { ...context.source },
      });
    }
    return commandWork(commands);
  }

  if (effect.kind === 'RETURN_TO_LANE') {
    const lanes = selectLanes(effect.to, liveContext);
    const commands: RulesCommand[] = [];
    for (const cardId of select(effect.target, liveContext)) {
      const card = getCardRuntime(state, cardId, manifest);
      if (!card) continue;
      const candidates = findLanes(state, manifest, {
        laneId: lanes,
        hasCapacity: card.owner,
      });
      if (candidates.length === 0) continue;
      commands.push({
        type: 'RETURN_CARD',
        cardId,
        lane: candidates.length === 1
          ? candidates[0]
          : liveContext.rng.scope(`return:${cardId}`).pick(candidates),
        revealed: effect.revealed ?? true,
        cause: { ...context.source },
      });
    }
    return commandWork(commands);
  }

  if (effect.kind === 'TRANSFORM_CARD') {
    const commands: RulesCommand[] = [];
    for (const cardId of select(effect.target, liveContext)) {
      const card = getCardRuntime(state, cardId, manifest);
      if (!card) continue;
      const newDefId = pickDefIdFromPool(
        effect.pool,
        state,
        manifest,
        card.owner,
        liveContext.rng.scope(`transform:${cardId}`),
        liveContext.eventOwner ?? null,
      );
      if (!newDefId || newDefId === card.defId) continue;
      commands.push({
        type: 'TRANSFORM_CARD',
        cardId,
        newDefId,
        metadataPolicy: effect.metadataPolicy,
        cause: { ...context.source },
      });
    }
    return commandWork(commands);
  }

  if (effect.kind === 'SCHEDULE_REVEAL') {
    return commandWork(select(effect.target, liveContext).flatMap((cardId) => {
      const card = getCardRuntime(state, cardId, manifest);
      if (!card || card.zone !== 'LANE' || card.revealed) return [];
      const timing = effect.timing.kind === 'END_OF_GAME'
        ? { kind: 'END_OF_GAME' as const }
        : {
            kind: 'TURN' as const,
            turn: Math.max(
              1,
              Math.floor(evalNum(effect.timing.turn, {
                ...liveContext,
                self: cardId,
                selfKind: 'card',
                selfLane: card.lane,
                selfOwner: card.owner,
              })),
            ),
          };
      return [{
        type: 'SET_CARD_REVEAL_TIMING' as const,
        cardId,
        timing,
        cause: { ...context.source },
      }];
    }));
  }

  if (effect.kind === 'TRIGGER_ON_REVEAL') {
    return commandWork(select(effect.target, liveContext).map(cardId => ({
      type: 'INVOKE_ON_REVEAL',
      cardId,
      reason: 'RETRIGGER',
      depth: context.depth + 1,
      cause: { ...context.source, reason: 'RETRIGGER' },
    })));
  }

  if (effect.kind === 'ADD_CARD_TAG') {
    const tag = resolveCardTagSpec(effect.tag, context.source);
    if (!tag) return kernelStepSuccess({ work: [] });
    return commandWork(select(effect.target, liveContext).map(cardId => ({
      type: 'CHANGE_CARD_TAG',
      cardId,
      mutation: { kind: 'ADD', tag },
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'REMOVE_CARD_TAG') {
    return commandWork(select(effect.target, liveContext).map(cardId => ({
      type: 'CHANGE_CARD_TAG',
      cardId,
      mutation: { kind: 'REMOVE', tag: effect.tag },
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'MODIFY_COUNTER') {
    return commandWork(select(effect.target, liveContext).map(cardId => ({
      type: 'CHANGE_CARD_COUNTER',
      cardId,
      name: effect.name,
      delta: evalNum(effect.delta, { ...liveContext, self: cardId }),
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'ADD_LOCATION_TAG') {
    return commandWork(selectLanes(effect.lane, liveContext).flatMap((lane) => {
      const location = locationCardAtLane(state, lane);
      return location
        ? [{
            type: 'CHANGE_LOCATION_TAG' as const,
            locationId: location.id,
            mutation: { kind: 'ADD' as const, tag: effect.tag },
            cause: { ...context.source },
          }]
        : [];
    }));
  }

  if (effect.kind === 'MODIFY_LOCATION_COUNTER') {
    const owner = effect.owner
      ? resolveOwnerRef(
          effect.owner,
          liveContext.selfOwner,
          liveContext.eventOwner ?? null,
        )
      : null;
    if (effect.owner && !owner) return kernelStepSuccess({ work: [] });
    return commandWork(selectLanes(effect.lane, liveContext).flatMap((lane) => {
      const location = locationCardAtLane(state, lane);
      return location
        ? [{
            type: 'CHANGE_LOCATION_COUNTER' as const,
            locationId: location.id,
            name: effect.name,
            owner,
            delta: Math.trunc(evalNum(effect.delta, liveContext)),
            cause: { ...context.source },
          }]
        : [];
    }));
  }

  if (effect.kind === 'COPY_TEXT_OF') {
    const into = select(effect.into, liveContext);
    const sources = select(effect.source, liveContext);
    const source = sources.length > 0
      ? getCardRuntime(state, sources[0], manifest)
      : null;
    if (!source) return kernelStepSuccess({ work: [] });
    const abilities = effect.copyKind === 'ON_REVEAL'
      ? {
          ...(source.text.abilities.onReveal
            ? { onReveal: source.text.abilities.onReveal }
            : {}),
        }
      : source.text.abilities;
    return commandWork(into.map(cardId => ({
      type: 'OVERRIDE_CARD_TEXT',
      cardId,
      override: {
        kind: 'COPIED_TEXT',
        sourceCardId: source.id,
        sourceDefId: source.defId,
        scope: effect.copyKind === 'ON_REVEAL' ? 'ON_REVEAL' : 'ALL',
        abilities,
        rulesText: source.text.rulesText,
      },
      cause: { ...context.source },
    })));
  }

  if (effect.kind === 'REMOVE_TEXT') {
    const commands: RulesCommand[] = [];
    for (const cardId of select(effect.target, liveContext)) {
      const card = getCardRuntime(state, cardId, manifest);
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
        for (const slot of Object.keys(
          abilities,
        ) as (keyof typeof abilities)[]) {
          delete abilities[slot];
        }
      }
      const prior = card.text.override;
      const copiedFrom = prior?.kind === 'COPIED_TEXT'
        ? {
            sourceCardId: prior.sourceCardId,
            sourceDefId: prior.sourceDefId,
            scope: prior.scope,
          }
        : prior?.kind === 'BLANKED_TEXT'
          ? prior.copiedFrom
          : null;
      commands.push({
        type: 'OVERRIDE_CARD_TEXT',
        cardId,
        override: {
          kind: 'BLANKED_TEXT',
          abilities,
          rulesText: '',
          copiedFrom,
        },
        cause: { ...context.source },
      });
    }
    return commandWork(commands);
  }

  if (effect.kind === 'REMOVE_COPIED_TEXT') {
    return commandWork(select(effect.target, liveContext).flatMap((cardId) => {
      const card = getCardRuntime(state, cardId, manifest);
      const override = card?.text.override;
      return override?.kind === 'COPIED_TEXT'
        || (
          override?.kind === 'BLANKED_TEXT'
          && override.copiedFrom !== null
        )
        ? [{
            type: 'OVERRIDE_CARD_TEXT' as const,
            cardId,
            override: null,
            cause: { ...context.source },
          }]
        : [];
    }));
  }

  if (effect.kind === 'ADD_PENDING') {
    const pending = resolvePendingEffectSpec(
      effect.effect,
      liveContext,
      state,
      manifest,
    );
    return pending
      ? commandWork([{
          type: 'SCHEDULE_PENDING_EFFECT',
          effect: pending,
          cause: { ...context.source },
        }])
      : kernelStepSuccess({ work: [] });
  }

  if (effect.kind === 'CALL_BUILTIN') {
    if (effect.fn === 'CORPORATE_CLIMBER') {
      const owner = liveContext.selfOwner;
      const lane = liveContext.selfLane;
      const recipientId = liveContext.self as CardId | null;
      if (owner === null || lane === null || recipientId === null) {
        return kernelStepSuccess({ work: [] });
      }
      const victims = state.lanesById[lane].cards[owner]
        .filter(cardId => cardId !== recipientId)
        .map(cardId => ({
          cardId,
          priorPower: isPowerBearingCard(state, cardId, manifest)
            ? getCardPower(state, cardId, manifest)
            : 0,
          priorFrameDestroyed:
            getCardLifecycle(state, cardId)?.frameDestroyed ?? null,
        }));
      if (victims.length === 0) {
        return kernelStepSuccess({ work: [] });
      }
      return kernelStepSuccess({
        work: [
          ...victims.map((victim): CanonicalRulesWork => ({
            kind: 'COMMAND',
            command: {
              type: 'DESTROY_CARD',
              cardId: victim.cardId,
              cause: { ...context.source },
            },
          })),
          {
            kind: 'EFFECT',
            effect: {
              kind: 'AWARD_POWER_FOR_DESTROYED_CARDS',
              recipientId,
              victims,
              cause: { ...context.source },
            },
            context: scopedCanonicalEffectContext(
              context,
              'corporate-climber:award',
            ),
            depth: context.depth,
          },
        ],
      });
    }

    if (effect.fn === 'LEON_RETURN') {
      const cardId = liveContext.self as CardId;
      const card = getCardRuntime(state, cardId, manifest);
      if (!card || card.zone !== 'LANE') {
        return kernelStepSuccess({ work: [] });
      }
      const work: CanonicalRulesWork[] = [
          {
            kind: 'COMMAND',
            command: {
              type: 'CHANGE_CARD_ZONE',
              cardId,
              destination: { kind: 'HAND' },
              cause: { ...context.source },
            },
          },
          {
            kind: 'EFFECT',
            effect: {
              kind: 'CHANGE_STORED_POWER_IF_CARD_ZONE',
              cardId,
              zone: 'HAND',
              delta: (effect.args.delta as number) ?? 2,
              cause: { ...context.source },
            },
            context: scopedCanonicalEffectContext(
              context,
              'leon-return:award',
            ),
            depth: context.depth,
          },
        ];
      return kernelStepSuccess({ work });
    }

    if (effect.fn === 'RIOT_SQUAD') {
      const owner = liveContext.selfOwner;
      const lane = liveContext.selfLane;
      const self = liveContext.self as CardId | null;
      if (owner === null || lane === null || !self) {
        return kernelStepSuccess({ work: [] });
      }
      const enemy: Owner = owner === 'P0' ? 'P1' : 'P0';
      const enemyPlayedHere = state.lanesById[lane].cards[enemy].some(
        cardId => {
          const card = getCardRuntime(state, cardId, manifest);
          return card?.lifecycle.turnPlayed === state.turn
            && card.lifecycle.lanePlayed === lane;
        },
      );
      if (
        enemyPlayedHere
        || !isPowerBearingCard(state, self, manifest)
      ) {
        return kernelStepSuccess({ work: [] });
      }
      return commandWork([{
        type: 'CHANGE_STORED_POWER',
        cardId: self,
        mutation: {
          kind: 'ADD',
          delta: (effect.args.delta as number) ?? 2,
        },
        cause: { ...context.source },
      }]);
    }

    if (
      effect.fn === 'MOVE_ENEMY_CARD_TO_OTHER_LANE'
      || effect.fn === 'MOVE_SELF_TO_RANDOM_OTHER_LANE'
      || effect.fn === 'MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE'
      || effect.fn === 'MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE'
    ) {
      const owner = liveContext.selfOwner;
      const lane = liveContext.selfLane;
      if (owner === null || lane === null) {
        return kernelStepSuccess({ work: [] });
      }
      const enemy: Owner = owner === 'P0' ? 'P1' : 'P0';
      let targetId: CardId | null;
      let targetOwner = owner;
      if (effect.fn === 'MOVE_SELF_TO_RANDOM_OTHER_LANE') {
        targetId = liveContext.self as CardId;
      } else if (effect.fn === 'MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE') {
        const candidates = state.lanesById[lane].cards[owner].filter(
          cardId => cardId !== liveContext.self,
        );
        targetId = candidates.length === 0
          ? null
          : liveContext.rng.scope('target').pick(candidates);
      } else {
        targetOwner = enemy;
        const candidates = state.lanesById[lane].cards[enemy];
        if (effect.fn === 'MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE') {
          targetId = candidates
            .filter(cardId => isPowerBearingCard(state, cardId, manifest))
            .sort((left, right) =>
              getCardPower(state, left, manifest)
              - getCardPower(state, right, manifest))[0] ?? null;
        } else {
          targetId = candidates.length === 0
            ? null
            : liveContext.rng.scope('target').pick([...candidates]);
        }
      }
      if (!targetId) return kernelStepSuccess({ work: [] });
      const destinations = activeLaneIds(state).filter(candidate =>
        candidate !== lane
        && state.lanesById[candidate].cards[targetOwner].length
          < manifest.constants.laneCapacity);
      if (destinations.length === 0) return kernelStepSuccess({ work: [] });
      return commandWork([{
        type: 'MOVE_CARD',
        cardId: targetId,
        toLane: liveContext.rng.scope('lane').pick(destinations),
        cause: { ...context.source },
      }]);
    }

    const plans = planBuiltinRevealCreations(
      state,
      effect.fn,
      liveContext,
      manifest,
    );
    if (plans !== null) {
      const commands: RulesCommand[] = [];
      for (const plan of plans) {
        commands.push({
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
        });
        if (plan.powerDelta !== 0) {
          commands.push({
            type: 'CHANGE_STORED_POWER',
            cardId: plan.cardId,
            mutation: { kind: 'ADD', delta: plan.powerDelta },
            cause: { ...context.source },
          });
        }
      }
      return commandWork(commands);
    }
    const plan = planBuiltinCommands(
      state,
      effect.fn,
      effect.args,
      liveContext,
      manifest,
    );
    if (plan !== null) return commandWork(plan.commands);
    return kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: `Builtin ${effect.fn} has no canonical command planner.`,
      sourceInstanceId: String(context.source.sourceId),
    });
  }

  const unhandled: never = effect;
  void unhandled;
  return kernelStepFailure({
    code: 'INVALID_OPERATION_OUTPUT',
    message: 'Canonical authored effect planner is not exhaustive.',
    sourceInstanceId: String(context.source.sourceId),
  });
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

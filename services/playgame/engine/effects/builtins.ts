/**
 * CALL_BUILTIN registry — bespoke implementations for card effects that
 * exceed the generic DSL's expressiveness.
 *
 * Each handler receives the current state, the effect node (with fn + args),
 * the full effect context, and the manifest. Returns { events, state } exactly
 * like evalEffect.
 *
 * Projection-only builtins remain outside this dispatcher because they are
 * compiled into normal OngoingExpr entries by the projection layer.
 */

import type { MatchEvent } from '../types/events';
import type { MatchState, SpawnSource } from '../types/state';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { Manifest } from '../manifest/types';
import type { EffectCtx } from './evaluator';
import type { PlacementCommand } from '../kernel/operations/placement';
import type { HandCommand } from '../kernel/operations/hand';
import type { RevealCommand } from '../kernel/revealTransaction';
import type {
  ChangeCostCommand,
  ChangeCardCounterCommand,
  ChangeCardTagCommand,
  ChangeStoredPowerCommand,
  OverrideCardTextCommand,
} from '../kernel/types';
import type { PendingEffectCommand } from '../kernel/pendingEffectTransaction';
import { apply } from '../apply';
import { getCardPower } from '../projections/power';
import { getCardCost } from '../projections/cost';
import { isPowerBearingCard } from '../projections/power-bearing';
import { activeLaneIds } from '../laneTopology';
import { getPermanentCardPower } from '../powerLedger';
import {
  getAllCardIds,
  getCardLifecycle,
  getCardPlacement,
  getCardRuntime,
} from '../projections/cardRuntime';
import {
  getAllCardTemplates,
  getCardTemplate,
} from '../projections/cardTemplate';

type BuiltinArgs = Record<string, unknown>;
type BuiltinResult = { events: readonly MatchEvent[]; state: MatchState };
export interface BuiltinLifecycleCapabilities {
  readonly executePlacementCommands: (
    state: MatchState,
    commands: readonly PlacementCommand[],
    options: {
      readonly rng: EffectCtx['rng'];
      readonly depth?: number;
    },
    manifest: Manifest,
  ) => BuiltinResult;
  readonly executeRevealCommands: (
    state: MatchState,
    commands: readonly RevealCommand[],
    options: {
      readonly rng: EffectCtx['rng'];
    },
    manifest: Manifest,
  ) => BuiltinResult;
  readonly executeHandCommands: (
    state: MatchState,
    commands: readonly HandCommand[],
    options: {
      readonly rng: EffectCtx['rng'];
      readonly depth?: number;
    },
    manifest: Manifest,
  ) => BuiltinResult;
  readonly executePowerCommands: (
    state: MatchState,
    commands: readonly ChangeStoredPowerCommand[],
    options: {
      readonly rng: EffectCtx['rng'];
      readonly depth?: number;
    },
    manifest: Manifest,
  ) => BuiltinResult;
  readonly executeCostCommands: (
    state: MatchState,
    commands: readonly ChangeCostCommand[],
    manifest: Manifest,
  ) => BuiltinResult;
  readonly executeCardMetadataCommands: (
    state: MatchState,
    commands: readonly (
      | ChangeCardTagCommand
      | ChangeCardCounterCommand
      | OverrideCardTextCommand
    )[],
    manifest: Manifest,
  ) => BuiltinResult;
  readonly executePendingEffectCommands: (
    state: MatchState,
    commands: readonly PendingEffectCommand[],
    options: {
      readonly rng: EffectCtx['rng'];
      readonly depth?: number;
    },
    manifest: Manifest,
  ) => BuiltinResult;
  readonly destroyCards: (
    state: MatchState,
    cardIds: readonly CardId[],
    options: {
      readonly source: EffectCtx['source'];
      readonly rng: EffectCtx['rng'];
      readonly sourceLane: LaneId | null;
      readonly depth?: number;
    },
    manifest: Manifest,
  ) => BuiltinResult;
  readonly banishCards: (
    state: MatchState,
    cardIds: readonly CardId[],
    options: {
      readonly source: EffectCtx['source'];
      readonly rng: EffectCtx['rng'];
      readonly sourceLane: LaneId | null;
      readonly depth?: number;
    },
    manifest: Manifest,
  ) => BuiltinResult;
}

function runPlacement(
  state: MatchState,
  commands: readonly PlacementCommand[],
  ctx: EffectCtx,
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  return lifecycle.executePlacementCommands(
    state,
    commands,
    { rng: ctx.rng, depth: ctx.depth },
    manifest,
  );
}

function runReveal(
  state: MatchState,
  commands: readonly RevealCommand[],
  ctx: EffectCtx,
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  return lifecycle.executeRevealCommands(
    state,
    commands,
    { rng: ctx.rng },
    manifest,
  );
}

function runHand(
  state: MatchState,
  commands: readonly HandCommand[],
  ctx: EffectCtx,
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  return lifecycle.executeHandCommands(
    state,
    commands,
    { rng: ctx.rng, depth: ctx.depth },
    manifest,
  );
}

function runPower(
  state: MatchState,
  commands: readonly ChangeStoredPowerCommand[],
  ctx: EffectCtx,
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  return lifecycle.executePowerCommands(
    state,
    commands,
    { rng: ctx.rng, depth: ctx.depth },
    manifest,
  );
}

function runCost(
  state: MatchState,
  commands: readonly ChangeCostCommand[],
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  return lifecycle.executeCostCommands(state, commands, manifest);
}

function runPending(
  state: MatchState,
  commands: readonly PendingEffectCommand[],
  ctx: EffectCtx,
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  return lifecycle.executePendingEffectCommands(
    state,
    commands,
    { rng: ctx.rng, depth: ctx.depth },
    manifest,
  );
}
type BuiltinHandler = (
  state: MatchState,
  fn: string,
  args: BuiltinArgs,
  ctx: EffectCtx,
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
) => BuiltinResult;

function noop(state: MatchState): BuiltinResult {
  return { events: [], state };
}

function mintCardId(ctx: EffectCtx, salt: string): CardId {
  const a = ctx.rng.scope(salt).int(0, 2 ** 31 - 1).toString(36);
  const b = ctx.rng.scope(salt + '2').int(0, 2 ** 31 - 1).toString(36);
  return `c-${a}${b}` as CardId;
}

function spawnSource(ctx: EffectCtx, forOwner: Owner): SpawnSource {
  if (ctx.source.effectKind === 'LOCATION') {
    return { kind: 'LOCATION_CREATED', sourceLocationId: ctx.source.sourceId as import('../types/ids').LocationCardInstanceId };
  }
  const sourceCardId = ctx.source.sourceId as CardId;
  return forOwner === ctx.selfOwner
    ? { kind: 'CARD_CREATED', sourceCardId }
    : { kind: 'ENEMY_CREATED', sourceCardId };
}

export interface BuiltinRevealCreationPlan {
  readonly cardId: CardId;
  readonly owner: Owner;
  readonly lane: LaneId;
  readonly defId: string;
  readonly spawnSource: SpawnSource;
  readonly powerDelta: number;
}

/**
 * Lower lane-token built-ins into content-neutral create-and-reveal plans.
 *
 * The reveal transaction consumes these plans on its parent queue. Direct
 * builtin evaluation consumes the same plans through the reveal capability,
 * so both routes share identity, capacity, provenance, and power semantics.
 */
export function planBuiltinRevealCreations(
  state: MatchState,
  fn: string,
  ctx: EffectCtx,
  manifest: Manifest,
): readonly BuiltinRevealCreationPlan[] | null {
  const owner = ctx.selfOwner;
  const sourceLane = ctx.selfLane;
  if (fn !== 'SECURITY_DETAIL' && fn !== 'RIFF_RAFF') return null;
  if (owner === null || sourceLane === null) return [];

  if (fn === 'SECURITY_DETAIL') {
    const count = Math.max(
      0,
      Math.min(
        2,
        manifest.constants.laneCapacity
          - state.lanesById[sourceLane].cards[owner].length,
      ),
    );
    const sourcePower = ctx.self
      ? getPermanentCardPower(state, ctx.self as CardId, manifest)
      : 0;
    const guardBasePower =
      getCardTemplate(manifest, 'guard')?.basePower ?? sourcePower;
    return Array.from({ length: count }, (_, index) => ({
      cardId: mintCardId(ctx, `guard:${index}`),
      owner,
      lane: sourceLane,
      defId: 'guard',
      spawnSource: spawnSource(ctx, owner),
      powerDelta: sourcePower - guardBasePower,
    }));
  }

  return activeLaneIds(state)
    .filter((lane) =>
      lane !== sourceLane
      && state.lanesById[lane].cards[owner].length
        < manifest.constants.laneCapacity)
    .map((lane) => ({
      cardId: mintCardId(ctx, `riff:${lane}`),
      owner,
      lane,
      defId: 'riff-raff-token',
      spawnSource: spawnSource(ctx, owner),
      powerDelta: 0,
    }));
}

function otherLanes(state: MatchState, lane: LaneId): LaneId[] {
  return activeLaneIds(state).filter(laneId => laneId !== lane);
}

// ---- Handlers ---------------------------------------------------------------

/** When Destroyed: give the card that caused this +delta Power. */
function powerToDestroyer(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const delta = (args.delta as number) ?? 0;
  const sourceId = ctx.source.sourceId as CardId;
  const srcCard = getCardRuntime(state, sourceId, manifest);
  if (!srcCard || !delta || !isPowerBearingCard(state, sourceId, manifest)) return noop(state);
  return runPower(state, [{
    type: 'CHANGE_STORED_POWER',
    cardId: sourceId,
    mutation: { kind: 'ADD', delta },
    cause: { ...ctx.source },
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Replace a random hand card with one that costs costDelta more.
 * If costDelta < 0, finds a card that costs |costDelta| less.
 */
function replaceHandCardHigherCost(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const costDelta = (args.costDelta as number) ?? 1;
  const owner = ctx.selfOwner;
  if (owner === null) return noop(state);
  if (state.hand[owner].length === 0) return noop(state);

  const handCardId = ctx.rng.scope('pick').pick([...state.hand[owner]]);
  const handCard = getCardRuntime(state, handCardId, manifest);
  if (!handCard) return noop(state);
  const handCardDef = getCardTemplate(manifest, handCard.defId);
  if (!handCardDef) return noop(state);
  const targetCost = handCardDef.baseCost + costDelta;

  const candidates = getAllCardTemplates(manifest)
    .filter(def => def.baseCost === targetCost && def.defId !== handCard.defId)
    .map(def => def.defId);
  if (candidates.length === 0) return noop(state);

  const newDefId = ctx.rng.scope('def').pick(candidates);
  const newId = mintCardId(ctx, 'replace');
  const ss = spawnSource(ctx, owner);

  const banished = lifecycle.banishCards(state, [handCard.id], {
    source: ctx.source,
    rng: ctx.rng.scope(`replace-hand:${handCard.id}`),
    sourceLane: ctx.selfLane,
    depth: ctx.depth,
  }, manifest);
  const events: MatchEvent[] = [...banished.events];
  let s = banished.state;

  // Add new card
  const created = runPlacement(s, [{
    type: 'CREATE_CARD',
    owner,
    cardId: newId,
    defId: newDefId,
    depth: ctx.depth,
    spawnSource: ss,
    destination: { kind: 'HAND' },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
  events.push(...created.events);
  s = created.state;

  return { events, state: s };
}

/**
 * On Reveal: Replace your lowest-Power hand card with a random card of targetCost.
 */
function replaceLowestPowerHandWithCost(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const targetCost = (args.targetCost as number) ?? 3;
  const owner = ctx.selfOwner;
  if (owner === null || state.hand[owner].length === 0) return noop(state);

  const sorted = state.hand[owner]
    .map(cardId => getCardRuntime(state, cardId, manifest))
    .filter((card): card is NonNullable<typeof card> =>
      card !== null && isPowerBearingCard(state, card.id, manifest))
    .sort((a, b) =>
      getCardPower(state, a.id, manifest) - getCardPower(state, b.id, manifest),
    );
  if (sorted.length === 0) return noop(state);
  const weakest = sorted[0];

  const candidates = getAllCardTemplates(manifest)
    .filter(def => def.baseCost === targetCost && def.defId !== weakest.defId)
    .map(def => def.defId);
  if (candidates.length === 0) return noop(state);

  const newDefId = ctx.rng.scope('def').pick(candidates);
  const newId = mintCardId(ctx, 'replace');
  const ss = spawnSource(ctx, owner);
  const banished = lifecycle.banishCards(state, [weakest.id], {
    source: ctx.source,
    rng: ctx.rng.scope(`replace-lowest:${weakest.id}`),
    sourceLane: ctx.selfLane,
    depth: ctx.depth,
  }, manifest);
  const events: MatchEvent[] = [...banished.events];
  let s = banished.state;

  const created = runPlacement(s, [{
    type: 'CREATE_CARD',
    owner, cardId: newId, defId: newDefId, depth: ctx.depth, spawnSource: ss,
    destination: { kind: 'HAND' },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
  events.push(...created.events);
  s = created.state;
  return { events, state: s };
}

/**
 * On Reveal: Replace a created card in hand with one that costs costDelta more.
 */
function replaceCreatedHandCardHigherCost(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const costDelta = (args.costDelta as number) ?? 1;
  const owner = ctx.selfOwner;
  if (owner === null) return noop(state);

  const createdCards = state.hand[owner]
    .map(cardId => getCardRuntime(state, cardId, manifest))
    .filter((card): card is NonNullable<typeof card> =>
      card !== null
      && card.spawnSource.kind !== 'DECK_CREATION'
      && card.spawnSource.kind !== 'SYSTEM');
  if (createdCards.length === 0) return noop(state);

  const picked = ctx.rng.scope('pick').pick(createdCards);
  const pickedDef = getCardTemplate(manifest, picked.defId);
  if (!pickedDef) return noop(state);
  const targetCost = pickedDef.baseCost + costDelta;

  const candidates = getAllCardTemplates(manifest)
    .filter(def => def.baseCost === targetCost && def.defId !== picked.defId)
    .map(def => def.defId);
  if (candidates.length === 0) return noop(state);

  const newDefId = ctx.rng.scope('def').pick(candidates);
  const newId = mintCardId(ctx, 'replace');
  const ss = spawnSource(ctx, owner);
  const banished = lifecycle.banishCards(state, [picked.id], {
    source: ctx.source,
    rng: ctx.rng.scope(`replace-created:${picked.id}`),
    sourceLane: ctx.selfLane,
    depth: ctx.depth,
  }, manifest);
  const events: MatchEvent[] = [...banished.events];
  let s = banished.state;

  const created = runPlacement(s, [{
    type: 'CREATE_CARD',
    owner, cardId: newId, defId: newDefId, depth: ctx.depth, spawnSource: ss,
    destination: { kind: 'HAND' },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
  events.push(...created.events);
  s = created.state;
  return { events, state: s };
}

/**
 * On Reveal: Add a random card to hand that costs costDelta less (temporarily).
 * The cost discount is applied via CARD_COST_CHANGED and scheduled to revert
 * at the end of the next turn via a SCHEDULED pending effect.
 */
function addDiscountedCardToHand(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const costDelta = (args.costDelta as number) ?? -1;
  const owner = ctx.selfOwner;
  if (owner === null) return noop(state);
  if (state.hand[owner].length >= manifest.constants.handCap) return noop(state);

  const allDefs = getAllCardTemplates(manifest);
  const validDefs = allDefs.filter(def => {
    const discountedCost = def.baseCost + costDelta;
    return discountedCost >= 0;
  });
  if (validDefs.length === 0) return noop(state);

  const chosenDef = ctx.rng.scope('def').pick(validDefs);
  const newId = mintCardId(ctx, 'add');
  const ss = spawnSource(ctx, owner);
  const events: MatchEvent[] = [];
  let s = state;

  const created = runPlacement(s, [{
    type: 'CREATE_CARD',
    owner, cardId: newId, defId: chosenDef.defId, depth: ctx.depth, spawnSource: ss,
    destination: { kind: 'HAND' },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
  events.push(...created.events);
  s = created.state;

  // Apply temporary cost discount
  if (costDelta !== 0) {
    const mutation = runCost(s, [{
      type: 'CHANGE_COST',
      cardId: newId,
      mutation: { kind: 'ADD', delta: costDelta },
      cause: { ...ctx.source },
    }], manifest, lifecycle);
    events.push(...mutation.events);
    s = mutation.state;

    // Schedule reversal at end of next turn
    const revertEffect: import('../types/ability').EffectExpr = {
      kind: 'ADJUST_COST',
      target: { kind: 'ALL_CARDS', ownerFilter: 'SELF_OWNER', zoneFilter: 'HAND' },
      delta: { kind: 'LIT', n: -costDelta },
    };
    const scheduled = runPending(s, [{
      type: 'SCHEDULE_PENDING_EFFECT',
      effect: {
        kind: 'SCHEDULED',
        when: 'END_OF_NEXT_TURN',
        sourceId: newId,
        sourceOwner: owner,
        sourceLane: null,
        fireTurn: state.turn + 1,
        effect: revertEffect,
      },
      cause: { ...ctx.source },
    }], ctx, manifest, lifecycle);
    events.push(...scheduled.events);
    s = scheduled.state;
  }

  return { events, state: s };
}

/**
 * On Reveal: Draw the lowest-Cost card from your deck.
 */
function drawLowestCostCard(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  if (owner === null || state.hand[owner].length >= manifest.constants.handCap) return noop(state);
  if (state.deck[owner].length === 0) return noop(state);

  const sorted = [...state.deck[owner]].sort((a, b) =>
    getCardCost(state, a, manifest) - getCardCost(state, b, manifest),
  );
  const target = sorted[0];
  return runHand(state, [{
    type: 'DRAW_CARD',
    owner,
    selection: { kind: 'CARD', cardId: target },
    cause: { ...ctx.source },
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Give a random friendly card here +delta Power.
 * Destroy it at end of next turn (via SCHEDULED pending).
 */
function overclockChip(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const delta = (args.delta as number) ?? 5;
  const owner = ctx.selfOwner;
  if (owner === null || ctx.selfLane === null) return noop(state);

  const friendliesHere = state.lanesById[ctx.selfLane].cards[owner]
    .filter(id => id !== (ctx.self as CardId) && isPowerBearingCard(state, id, manifest));
  if (friendliesHere.length === 0) return noop(state);

  const targetId = ctx.rng.scope('target').pick(friendliesHere);
  const events: MatchEvent[] = [];
  let s = state;

  const powerChange = runPower(s, [{
    type: 'CHANGE_STORED_POWER',
    cardId: targetId,
    mutation: { kind: 'ADD', delta },
    cause: { ...ctx.source },
  }], ctx, manifest, lifecycle);
  events.push(...powerChange.events);
  s = powerChange.state;

  // Schedule destruction at end of next turn
  const destroyEffect: import('../types/ability').EffectExpr = {
    kind: 'DESTROY',
    target: { kind: 'ALL_CARDS', ownerFilter: 'SELF_OWNER', zoneFilter: 'LANE' },
  };
  const scheduled = runPending(s, [{
    type: 'SCHEDULE_PENDING_EFFECT',
    effect: {
      kind: 'SCHEDULED',
      when: 'END_OF_NEXT_TURN',
      sourceId: targetId,
      sourceOwner: owner,
      sourceLane: ctx.selfLane,
      fireTurn: state.turn + 1,
      effect: destroyEffect,
    },
    cause: { ...ctx.source },
  }], ctx, manifest, lifecycle);
  events.push(...scheduled.events);
  s = scheduled.state;

  return { events, state: s };
}

/**
 * On Reveal: Move a random enemy card here to another location.
 */
function moveEnemyCardToOtherLane(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  if (owner === null || ctx.selfLane === null) return noop(state);
  const oppOwner: Owner = owner === 'P0' ? 'P1' : 'P0';
  const enemiesHere = state.lanesById[ctx.selfLane].cards[oppOwner];
  if (enemiesHere.length === 0) return noop(state);

  const targetId = ctx.rng.scope('target').pick([...enemiesHere]);
  const toLaneCandidates = otherLanes(state, ctx.selfLane).filter(l =>
    state.lanesById[l].cards[oppOwner].length < manifest.constants.laneCapacity,
  );
  if (toLaneCandidates.length === 0) return noop(state);

  const toLane = ctx.rng.scope('lane').pick(toLaneCandidates);
  return runPlacement(state, [{
    type: 'MOVE_CARD', cardId: targetId, toLane, cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Move this card to a random other location.
 */
function moveSelfToRandomOtherLane(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const self = ctx.self as CardId;
  const owner = ctx.selfOwner;
  if (!self || owner === null || ctx.selfLane === null) return noop(state);

  const toLaneCandidates = otherLanes(state, ctx.selfLane).filter(l =>
    state.lanesById[l].cards[owner].length < manifest.constants.laneCapacity,
  );
  if (toLaneCandidates.length === 0) return noop(state);

  const toLane = ctx.rng.scope('lane').pick(toLaneCandidates);
  return runPlacement(state, [{
    type: 'MOVE_CARD', cardId: self, toLane, cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Move one of your other cards here to another location.
 */
function moveRandomFriendlyToOtherLane(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  if (owner === null || ctx.selfLane === null) return noop(state);

  const others = state.lanesById[ctx.selfLane].cards[owner]
    .filter(id => id !== (ctx.self as CardId));
  if (others.length === 0) return noop(state);

  const targetId = ctx.rng.scope('target').pick([...others]);
  const toLaneCandidates = otherLanes(state, ctx.selfLane).filter(l =>
    state.lanesById[l].cards[owner].length < manifest.constants.laneCapacity,
  );
  if (toLaneCandidates.length === 0) return noop(state);

  const toLane = ctx.rng.scope('lane').pick(toLaneCandidates);
  return runPlacement(state, [{
    type: 'MOVE_CARD', cardId: targetId, toLane, cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Move the lowest-Power enemy card here to another location.
 */
function moveLowestPowerEnemyToOtherLane(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  if (owner === null || ctx.selfLane === null) return noop(state);
  const oppOwner: Owner = owner === 'P0' ? 'P1' : 'P0';

  const enemies = state.lanesById[ctx.selfLane].cards[oppOwner]
    .filter(id => isPowerBearingCard(state, id, manifest));
  if (enemies.length === 0) return noop(state);

  const sorted = [...enemies].sort((a, b) =>
    getCardPower(state, a, manifest) - getCardPower(state, b, manifest),
  );
  const targetId = sorted[0];

  const toLaneCandidates = otherLanes(state, ctx.selfLane).filter(l =>
    state.lanesById[l].cards[oppOwner].length < manifest.constants.laneCapacity,
  );
  if (toLaneCandidates.length === 0) return noop(state);

  const toLane = ctx.rng.scope('lane').pick(toLaneCandidates);
  return runPlacement(state, [{
    type: 'MOVE_CARD', cardId: targetId, toLane, cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Add a copy of the top card of the opponent's deck to your hand.
 */
function copyTopEnemyDeckCardToHand(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  if (owner === null) return noop(state);
  if (state.hand[owner].length >= manifest.constants.handCap) return noop(state);
  const oppOwner: Owner = owner === 'P0' ? 'P1' : 'P0';

  const oppDeck = state.deck[oppOwner];
  if (oppDeck.length === 0) return noop(state);

  const topCardId = oppDeck[0];
  const topCard = getCardRuntime(state, topCardId, manifest);
  if (!topCard) return noop(state);
  const newId = mintCardId(ctx, 'copy');
  const ss: SpawnSource = { kind: 'COPY_OF', sourceCardId: topCardId };

  return runPlacement(state, [{
    type: 'CREATE_CARD',
    owner, cardId: newId, defId: topCard.defId, depth: ctx.depth, spawnSource: ss,
    destination: { kind: 'HAND' },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Add a card you discarded this game to your hand.
 */
function addDiscardedCardToHand(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  if (owner === null) return noop(state);
  if (state.hand[owner].length >= manifest.constants.handCap) return noop(state);

  const discarded = getAllCardIds(state)
    .map((id) => getCardRuntime(state, id, manifest))
    .filter((card): card is NonNullable<typeof card> =>
      card !== null && card.owner === owner && card.zone === 'DISCARD');
  if (discarded.length === 0) return noop(state);

  const picked = ctx.rng.scope('pick').pick(discarded);
  return runPlacement(state, [{
    type: 'CHANGE_CARD_ZONE',
    cardId: picked.id,
    destination: { kind: 'HAND' },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

/**
 * On Reveal: Disable Ongoing effects in this lane this turn.
 * Implemented by adding ONGOING_DISABLED tags (sourced to this card) to all
 * cards currently in the lane. Tags are cleared at TURN_ENDED.
 *
 * Note: ONGOING_DISABLED is per-source (the disabling card), so this is
 * structurally correct — multiple disablers stack correctly.
 */
function disableOngoingsThisLaneThisTurn(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  if (ctx.selfLane === null || ctx.self === null) return noop(state);
  const sourceId = ctx.self as CardId;

  const allInLane: CardId[] = [
    ...state.lanesById[ctx.selfLane].cards.P0,
    ...state.lanesById[ctx.selfLane].cards.P1,
  ];

  const commands: ChangeCardTagCommand[] = [];
  for (const id of allInLane) {
    if (id === sourceId) continue; // don't disable yourself
    const card = getCardRuntime(state, id, manifest);
    if (!card) continue;
    // Only disable cards that have an ongoing
    if ((card.text.abilities.ongoing?.length ?? 0) === 0) continue;

    const alreadyDisabled = card.tags.some(
      t => t.kind === 'ONGOING_DISABLED' && (t as { kind: 'ONGOING_DISABLED'; sourceId: CardId }).sourceId === sourceId,
    );
    if (alreadyDisabled) continue;

    commands.push({
      type: 'CHANGE_CARD_TAG',
      cardId: id,
      mutation: {
        kind: 'ADD',
        tag: { kind: 'ONGOING_DISABLED', sourceId },
      },
      cause: { ...ctx.source },
    });
  }
  return lifecycle.executeCardMetadataCommands(state, commands, manifest);
}

function executeRevealCreationPlan(
  state: MatchState,
  ctx: EffectCtx,
  manifest: Manifest,
  plan: BuiltinRevealCreationPlan,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  return runReveal(state, [{
    type: 'CREATE_CARD',
    owner: plan.owner,
    cardId: plan.cardId,
    defId: plan.defId,
    depth: ctx.depth,
    spawnSource: plan.spawnSource,
    destination: { kind: 'LANE', lane: plan.lane, revealed: true },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

function securityDetail(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  const lane = ctx.selfLane;
  const sourceId = ctx.self as CardId;
  if (owner === null || lane === null || !sourceId) return noop(state);
  const plans = planBuiltinRevealCreations(
    state,
    'SECURITY_DETAIL',
    ctx,
    manifest,
  ) ?? [];

  const events: MatchEvent[] = [];
  let s = state;
  for (const plan of plans) {
    const spawned = executeRevealCreationPlan(
      s,
      ctx,
      manifest,
      plan,
      lifecycle,
    );
    if (spawned.events.length === 0) break;
    events.push(...spawned.events);
    s = spawned.state;
    if (plan.powerDelta === 0) continue;
    const powerChange = runPower(s, [{
      type: 'CHANGE_STORED_POWER',
      cardId: plan.cardId,
      mutation: { kind: 'ADD', delta: plan.powerDelta },
      cause: { ...ctx.source },
    }], ctx, manifest, lifecycle);
    events.push(...powerChange.events);
    s = powerChange.state;
  }
  return { events, state: s };
}

function recklessRecruiter(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  if (owner === null) return noop(state);

  const events: MatchEvent[] = [];
  let s = state;
  for (const cardId of state.deck[owner]) {
    const giveCost = ctx.rng.scope(`recruit:${cardId}`).int(0, 1) === 0;
    if (!giveCost && !isPowerBearingCard(state, cardId, manifest)) continue;
    if (giveCost) {
      const mutation = runCost(s, [{
        type: 'CHANGE_COST',
        cardId,
        mutation: { kind: 'ADD', delta: -1 },
        cause: { ...ctx.source },
      }], manifest, lifecycle);
      events.push(...mutation.events);
      s = mutation.state;
    } else {
      const powerChange = runPower(s, [{
        type: 'CHANGE_STORED_POWER',
        cardId,
        mutation: { kind: 'ADD', delta: 2 },
        cause: { ...ctx.source },
      }], ctx, manifest, lifecycle);
      events.push(...powerChange.events);
      s = powerChange.state;
    }
  }
  return { events, state: s };
}

function cardWasPlayedAtLaneThisTurn(state: MatchState, lane: LaneId, owner?: Owner): boolean {
  return getAllCardIds(state).some((cardId) => {
    const lifecycle = getCardLifecycle(state, cardId);
    const placement = getCardPlacement(state, cardId);
    return lifecycle?.turnPlayed === state.turn
      && lifecycle.lanePlayed === lane
      && (owner === undefined || placement?.owner === owner);
  });
}

function barracadeCheck(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const self = ctx.self as CardId;
  const lane = ctx.selfLane;
  if (!self || lane === null) return noop(state);
  const card = getCardRuntime(state, self, manifest);
  if (!card || card.zone !== 'LANE' || !isPowerBearingCard(state, self, manifest)) return noop(state);
  if (!cardWasPlayedAtLaneThisTurn(state, lane)) return noop(state);

  const delta = (args.delta as number) ?? 4;
  return runPower(state, [{
    type: 'CHANGE_STORED_POWER',
    cardId: self,
    mutation: { kind: 'ADD', delta },
    cause: { ...ctx.source },
  }], ctx, manifest, lifecycle);
}

function leonReturn(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const self = ctx.self as CardId;
  if (!self) return noop(state);
  const card = getCardRuntime(state, self, manifest);
  if (!card || card.zone !== 'LANE') return noop(state);

  const events: MatchEvent[] = [];
  let s = state;
  const moved = runPlacement(s, [{
    type: 'CHANGE_CARD_ZONE',
    cardId: self,
    destination: { kind: 'HAND' },
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
  events.push(...moved.events);
  s = moved.state;
  if (getCardRuntime(s, self, manifest)?.zone !== 'HAND' || !isPowerBearingCard(s, self, manifest)) return { events, state: s };

  const delta = (args.delta as number) ?? 2;
  const powerChange = runPower(s, [{
    type: 'CHANGE_STORED_POWER',
    cardId: self,
    mutation: { kind: 'ADD', delta },
    cause: { ...ctx.source },
  }], ctx, manifest, lifecycle);
  events.push(...powerChange.events);
  s = powerChange.state;
  return { events, state: s };
}

function riotSquad(
  state: MatchState, _fn: string, args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const self = ctx.self as CardId;
  const lane = ctx.selfLane;
  const owner = ctx.selfOwner;
  if (!self || lane === null || owner === null) return noop(state);
  const enemy: Owner = owner === 'P0' ? 'P1' : 'P0';
  if (cardWasPlayedAtLaneThisTurn(state, lane, enemy)) return noop(state);
  if (!isPowerBearingCard(state, self, manifest)) return noop(state);

  const delta = (args.delta as number) ?? 2;
  return runPower(state, [{
    type: 'CHANGE_STORED_POWER',
    cardId: self,
    mutation: { kind: 'ADD', delta },
    cause: { ...ctx.source },
  }], ctx, manifest, lifecycle);
}

function corporateClimber(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  const lane = ctx.selfLane;
  const self = ctx.self as CardId;
  if (owner === null || lane === null || !self) return noop(state);
  const victims = state.lanesById[lane].cards[owner].filter(id => id !== self);
  if (victims.length === 0) return noop(state);
  const priorPower = new Map(
    victims
      .filter((id) => isPowerBearingCard(state, id, manifest))
      .map((id) => [id, getCardPower(state, id, manifest)] as const),
  );
  const destroyed = lifecycle.destroyCards(state, victims, {
    source: ctx.source,
    rng: ctx.rng.scope(`corporate-climber:${self}`),
    sourceLane: lane,
    depth: ctx.depth,
  }, manifest);
  const events: MatchEvent[] = [...destroyed.events];
  let s = destroyed.state;
  const gainedPower = destroyed.events.reduce(
    (sum, event) => event.type === 'CARD_DESTROYED'
      ? sum + (priorPower.get(event.cardId) ?? 0)
      : sum,
    0,
  );
  if (gainedPower > 0 && getCardRuntime(s, self, manifest)?.zone === 'LANE' && isPowerBearingCard(s, self, manifest)) {
    const powerChange = runPower(s, [{
      type: 'CHANGE_STORED_POWER',
      cardId: self,
      mutation: { kind: 'ADD', delta: gainedPower },
      cause: { ...ctx.source },
    }], ctx, manifest, lifecycle);
    events.push(...powerChange.events);
    s = powerChange.state;
  }
  return { events, state: s };
}

function traumaTeam(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  const lane = ctx.selfLane;
  if (owner === null || lane === null) return noop(state);
  if (state.lanesById[lane].cards[owner].length >= manifest.constants.laneCapacity) return noop(state);

  const destroyedLastTurn = getAllCardIds(state).filter((cardId) => {
    const card = getCardRuntime(state, cardId, manifest);
    return card?.owner === owner
      && card.zone === 'DESTROYED'
      && card.lifecycle.turnDestroyed === state.turn - 1;
  });
  if (destroyedLastTurn.length === 0) return noop(state);

  const cardId = ctx.rng.scope('revive').pick(destroyedLastTurn);
  return runPlacement(state, [{
    type: 'RETURN_CARD',
    cardId,
    lane,
    revealed: true,
    cause: ctx.source,
  }], ctx, manifest, lifecycle);
}

function socialWorker(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  const lane = ctx.selfLane;
  const self = ctx.self as CardId;
  if (owner === null || lane === null || !self) return noop(state);
  const targets = [
    ...state.lanesById[lane].cards.P0,
    ...state.lanesById[lane].cards.P1,
  ].filter(id => id !== self);

  const events: MatchEvent[] = [];
  let s = state;
  for (const cardId of targets) {
    const card = getCardRuntime(s, cardId, manifest);
    if (!card) continue;
    const currentCost = getCardCost(s, cardId, manifest);
    const candidates = getAllCardTemplates(manifest)
      .filter(def => def.domain === 'character' && def.baseCost === currentCost + 1)
      .map(def => def.defId);
    if (candidates.length === 0) continue;
    const newDefId = ctx.rng.scope(`social:${cardId}`).pick(candidates);
    const powerReset = runPower(s, [{
      type: 'CHANGE_STORED_POWER',
      cardId,
      mutation: { kind: 'RESET' },
      cause: { ...ctx.source },
    }], ctx, manifest, lifecycle);
    events.push(...powerReset.events);
    s = powerReset.state;
    const event: MatchEvent = {
      type: 'CARD_TRANSFORMED',
      cardId,
      oldDefId: card.defId,
      newDefId,
      cause: ctx.source,
      resetStats: true,
    };
    events.push(event);
    s = apply(s, event, manifest);
  }
  return { events, state: s };
}

function riffRaff(
  state: MatchState, _fn: string, _args: BuiltinArgs,
  ctx: EffectCtx, manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const owner = ctx.selfOwner;
  const lane = ctx.selfLane;
  if (owner === null || lane === null) return noop(state);

  const events: MatchEvent[] = [];
  let s = state;
  const plans = planBuiltinRevealCreations(
    state,
    'RIFF_RAFF',
    ctx,
    manifest,
  ) ?? [];
  for (const plan of plans) {
    const spawned = executeRevealCreationPlan(
      s,
      ctx,
      manifest,
      plan,
      lifecycle,
    );
    events.push(...spawned.events);
    s = spawned.state;
  }
  return { events, state: s };
}

/**
 * COPY_ONGOING_OF_CHEAPEST_ONGOING — Ongoing: copy ongoing of cheapest Ongoing
 * card here. Implemented in collectAllOngoings.
 */
function copyOngoingOfCheapestOngoing(state: MatchState): BuiltinResult {
  return noop(state);
}

/**
 * FULL_LANES_POWER — Ongoing: your full lanes have +delta Power.
 * Implemented in collectAllOngoings as a lane POWER_ADD projection.
 */
function fullLanesPower(state: MatchState): BuiltinResult {
  return noop(state);
}

// ---- Registry ---------------------------------------------------------------

const REGISTRY = new Map<string, BuiltinHandler>([
  ['POWER_TO_DESTROYER',               powerToDestroyer],
  ['COPY_ONGOING_OF_CHEAPEST_ONGOING', (_s, _fn, _a, _c) => copyOngoingOfCheapestOngoing(_s)],
  ['REPLACE_HAND_CARD_HIGHER_COST',    replaceHandCardHigherCost],
  ['REPLACE_LOWEST_POWER_HAND_WITH_COST', replaceLowestPowerHandWithCost],
  ['ADD_DISCOUNTED_CARD_TO_HAND',      addDiscountedCardToHand],
  ['DRAW_LOWEST_COST_CARD',            drawLowestCostCard],
  ['OVERCLOCK_CHIP',                   overclockChip],
  ['REPLACE_CREATED_HAND_CARD_HIGHER_COST', replaceCreatedHandCardHigherCost],
  ['MOVE_ENEMY_CARD_TO_OTHER_LANE',    moveEnemyCardToOtherLane],
  ['MOVE_SELF_TO_RANDOM_OTHER_LANE',   moveSelfToRandomOtherLane],
  ['MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE', moveRandomFriendlyToOtherLane],
  ['MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE', moveLowestPowerEnemyToOtherLane],
  ['COPY_TOP_ENEMY_DECK_CARD_TO_HAND', copyTopEnemyDeckCardToHand],
  ['ADD_DISCARDED_CARD_TO_HAND',       addDiscardedCardToHand],
  ['FULL_LANES_POWER',                 (_s) => fullLanesPower(_s)],
  ['DISABLE_ONGOINGS_THIS_LANE_THIS_TURN', disableOngoingsThisLaneThisTurn],
  ['SECURITY_DETAIL',                  securityDetail],
  ['RECKLESS_RECRUITER',               recklessRecruiter],
  ['BARRACADE_CHECK',                  barracadeCheck],
  ['LEON_RETURN',                      leonReturn],
  ['RIOT_SQUAD',                       riotSquad],
  ['CORPORATE_CLIMBER',                corporateClimber],
  ['TRAUMA_TEAM',                      traumaTeam],
  ['SOCIAL_WORKER',                    socialWorker],
  ['RIFF_RAFF',                        riffRaff],
]);

export function registeredBuiltinNames(): readonly string[] {
  return [...REGISTRY.keys()].sort();
}

export function invokeBuiltin(
  state: MatchState,
  fn: string,
  args: BuiltinArgs,
  ctx: EffectCtx,
  manifest: Manifest,
  lifecycle: BuiltinLifecycleCapabilities,
): BuiltinResult {
  const handler = REGISTRY.get(fn);
  if (!handler) {
    throw new Error(`CALL_BUILTIN: no handler registered for "${fn}"`);
  }
  return handler(state, fn, args, ctx, manifest, lifecycle);
}

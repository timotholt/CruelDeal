import type { Manifest } from '../manifest/types';
import { getCardCost } from '../projections/cost';
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
import { getCardPower } from '../projections/power';
import { isPowerBearingCard } from '../projections/power-bearing';
import { activeLaneIds } from '../laneTopology';
import { getPermanentCardPower } from '../powerLedger';
import type { CardId, LaneId, Owner } from '../types/ids';
import type { MatchState, SpawnSource } from '../types/state';
import type { GameCommand } from '../kernel/types';
import type { EffectCtx } from './rulesInterpreter';

type BuiltinArgs = Readonly<Record<string, unknown>>;

export interface BuiltinCommandPlan {
  readonly commands: readonly GameCommand[];
}

const REGISTERED_BUILTIN_NAMES = [
  'ADD_DISCARDED_CARD_TO_HAND',
  'ADD_DISCOUNTED_CARD_TO_HAND',
  'BARRACADE_CHECK',
  'COPY_ONGOING_OF_CHEAPEST_ONGOING',
  'COPY_TOP_ENEMY_DECK_CARD_TO_HAND',
  'CORPORATE_CLIMBER',
  'DISABLE_ONGOINGS_THIS_LANE_THIS_TURN',
  'DRAW_LOWEST_COST_CARD',
  'FULL_LANES_POWER',
  'LEON_RETURN',
  'MOVE_ENEMY_CARD_TO_OTHER_LANE',
  'MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE',
  'MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE',
  'MOVE_SELF_TO_RANDOM_OTHER_LANE',
  'OVERCLOCK_CHIP',
  'POWER_TO_DESTROYER',
  'RECKLESS_RECRUITER',
  'REPLACE_CREATED_HAND_CARD_HIGHER_COST',
  'REPLACE_HAND_CARD_HIGHER_COST',
  'REPLACE_LOWEST_POWER_HAND_WITH_COST',
  'RIFF_RAFF',
  'RIOT_SQUAD',
  'SECURITY_DETAIL',
  'SOCIAL_WORKER',
  'TRAUMA_TEAM',
] as const;

export function registeredBuiltinNames(): readonly string[] {
  return [...REGISTERED_BUILTIN_NAMES];
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
 * Lower lane-token built-ins to immutable create-and-reveal plans. The
 * canonical rules queue consumes the plans without opening a nested
 * transaction or handing a built-in mutation capabilities.
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

function mintCardId(ctx: EffectCtx, salt: string): CardId {
  const a = ctx.rng.scope(salt).int(0, 2 ** 31 - 1).toString(36);
  const b = ctx.rng.scope(`${salt}2`).int(0, 2 ** 31 - 1).toString(36);
  return `c-${a}${b}` as CardId;
}

function spawnSource(ctx: EffectCtx, owner: Owner): SpawnSource {
  if (ctx.source.effectKind === 'LOCATION') {
    return {
      kind: 'LOCATION_CREATED',
      sourceLocationId: ctx.source.sourceId as import('../types/ids').LocationCardInstanceId,
    };
  }
  const sourceCardId = ctx.source.sourceId as CardId;
  return owner === ctx.selfOwner
    ? { kind: 'CARD_CREATED', sourceCardId }
    : { kind: 'ENEMY_CREATED', sourceCardId };
}

function createInHand(
  ctx: EffectCtx,
  owner: Owner,
  cardId: CardId,
  defId: string,
  source: SpawnSource = spawnSource(ctx, owner),
): GameCommand {
  return {
    type: 'CREATE_CARD',
    owner,
    cardId,
    defId,
    depth: ctx.depth,
    spawnSource: source,
    destination: { kind: 'HAND' },
    cause: { ...ctx.source },
  };
}

function replaceHandCard(
  ctx: EffectCtx,
  owner: Owner,
  oldId: CardId,
  newDefId: string,
): readonly GameCommand[] {
  return [
    {
      type: 'BANISH_CARD',
      cardId: oldId,
      cause: { ...ctx.source },
    },
    createInHand(ctx, owner, mintCardId(ctx, 'replace'), newDefId),
  ];
}

function cardWasPlayedAtLaneThisTurn(
  state: MatchState,
  lane: LaneId,
): boolean {
  return getAllCardIds(state).some((cardId) => {
    const lifecycle = getCardLifecycle(state, cardId);
    const placement = getCardPlacement(state, cardId);
    return lifecycle?.turnPlayed === state.turn
      && lifecycle.lanePlayed === lane
      && placement !== null;
  });
}

/**
 * Pure lowering for built-ins whose decisions can be frozen from the current
 * candidate. `null` means the built-in remains continuation-sensitive.
 */
export function planBuiltinCommands(
  state: MatchState,
  fn: string,
  args: BuiltinArgs,
  ctx: EffectCtx,
  manifest: Manifest,
): BuiltinCommandPlan | null {
  const owner = ctx.selfOwner;
  const self = ctx.self as CardId | null;

  if (fn === 'COPY_ONGOING_OF_CHEAPEST_ONGOING' || fn === 'FULL_LANES_POWER') {
    return { commands: [] };
  }

  if (fn === 'POWER_TO_DESTROYER') {
    const delta = (args.delta as number) ?? 0;
    const sourceId = ctx.source.sourceId as CardId;
    return {
      commands: delta
        && getCardRuntime(state, sourceId, manifest)
        && isPowerBearingCard(state, sourceId, manifest)
        ? [{
            type: 'CHANGE_STORED_POWER',
            cardId: sourceId,
            mutation: { kind: 'ADD', delta },
            cause: { ...ctx.source },
          }]
        : [],
    };
  }

  if (fn === 'REPLACE_HAND_CARD_HIGHER_COST') {
    if (owner === null || state.hand[owner].length === 0) return { commands: [] };
    const pickedId = ctx.rng.scope('pick').pick([...state.hand[owner]]);
    const picked = getCardRuntime(state, pickedId, manifest);
    const pickedDef = picked && getCardTemplate(manifest, picked.defId);
    if (!picked || !pickedDef) return { commands: [] };
    const targetCost = pickedDef.baseCost + ((args.costDelta as number) ?? 1);
    const candidates = getAllCardTemplates(manifest)
      .filter(def => def.baseCost === targetCost && def.defId !== picked.defId)
      .map(def => def.defId);
    if (candidates.length === 0) return { commands: [] };
    return {
      commands: replaceHandCard(
        ctx,
        owner,
        picked.id,
        ctx.rng.scope('def').pick(candidates),
      ),
    };
  }

  if (fn === 'REPLACE_LOWEST_POWER_HAND_WITH_COST') {
    if (owner === null || state.hand[owner].length === 0) return { commands: [] };
    const weakest = state.hand[owner]
      .map(id => getCardRuntime(state, id, manifest))
      .filter((card): card is NonNullable<typeof card> =>
        card !== null && isPowerBearingCard(state, card.id, manifest))
      .sort((a, b) =>
        getCardPower(state, a.id, manifest) - getCardPower(state, b.id, manifest))[0];
    if (!weakest) return { commands: [] };
    const targetCost = (args.targetCost as number) ?? 3;
    const candidates = getAllCardTemplates(manifest)
      .filter(def => def.baseCost === targetCost && def.defId !== weakest.defId)
      .map(def => def.defId);
    if (candidates.length === 0) return { commands: [] };
    return {
      commands: replaceHandCard(
        ctx,
        owner,
        weakest.id,
        ctx.rng.scope('def').pick(candidates),
      ),
    };
  }

  if (fn === 'REPLACE_CREATED_HAND_CARD_HIGHER_COST') {
    if (owner === null) return { commands: [] };
    const created = state.hand[owner]
      .map(id => getCardRuntime(state, id, manifest))
      .filter((card): card is NonNullable<typeof card> =>
        card !== null
        && card.spawnSource.kind !== 'DECK_CREATION'
        && card.spawnSource.kind !== 'SYSTEM');
    if (created.length === 0) return { commands: [] };
    const picked = ctx.rng.scope('pick').pick(created);
    const pickedDef = getCardTemplate(manifest, picked.defId);
    if (!pickedDef) return { commands: [] };
    const targetCost = pickedDef.baseCost + ((args.costDelta as number) ?? 1);
    const candidates = getAllCardTemplates(manifest)
      .filter(def => def.baseCost === targetCost && def.defId !== picked.defId)
      .map(def => def.defId);
    if (candidates.length === 0) return { commands: [] };
    return {
      commands: replaceHandCard(
        ctx,
        owner,
        picked.id,
        ctx.rng.scope('def').pick(candidates),
      ),
    };
  }

  if (fn === 'ADD_DISCOUNTED_CARD_TO_HAND') {
    const costDelta = (args.costDelta as number) ?? -1;
    if (
      owner === null
      || state.hand[owner].length >= manifest.constants.handCap
    ) return { commands: [] };
    const validDefs = getAllCardTemplates(manifest).filter(
      definition => definition.baseCost + costDelta >= 0,
    );
    if (validDefs.length === 0) return { commands: [] };
    const chosenDef = ctx.rng.scope('def').pick(validDefs);
    const cardId = mintCardId(ctx, 'add');
    const commands: GameCommand[] = [
      createInHand(ctx, owner, cardId, chosenDef.defId),
    ];
    if (costDelta !== 0) {
      commands.push(
        {
          type: 'CHANGE_COST',
          cardId,
          mutation: { kind: 'ADD', delta: costDelta },
          cause: { ...ctx.source },
        },
        {
          type: 'SCHEDULE_PENDING_EFFECT',
          effect: {
            kind: 'SCHEDULED',
            when: 'END_OF_NEXT_TURN',
            sourceId: cardId,
            sourceOwner: owner,
            sourceLane: null,
            fireTurn: state.turn + 1,
            effect: {
              kind: 'ADJUST_COST',
              target: {
                kind: 'ALL_CARDS',
                ownerFilter: 'SELF_OWNER',
                zoneFilter: 'HAND',
              },
              delta: { kind: 'LIT', n: -costDelta },
            },
          },
          cause: { ...ctx.source },
        },
      );
    }
    return { commands };
  }

  if (fn === 'DRAW_LOWEST_COST_CARD') {
    if (
      owner === null
      || state.hand[owner].length >= manifest.constants.handCap
      || state.deck[owner].length === 0
    ) return { commands: [] };
    const target = [...state.deck[owner]].sort((a, b) =>
      getCardCost(state, a, manifest) - getCardCost(state, b, manifest))[0];
    return {
      commands: [{
        type: 'DRAW_CARD',
        owner,
        selection: { kind: 'CARD', cardId: target },
        cause: { ...ctx.source },
      }],
    };
  }

  if (fn === 'OVERCLOCK_CHIP') {
    if (owner === null || ctx.selfLane === null) return { commands: [] };
    const candidates = state.lanesById[ctx.selfLane].cards[owner]
      .filter(id => id !== self && isPowerBearingCard(state, id, manifest));
    if (candidates.length === 0) return { commands: [] };
    const targetId = ctx.rng.scope('target').pick(candidates);
    return {
      commands: [
        {
          type: 'CHANGE_STORED_POWER',
          cardId: targetId,
          mutation: { kind: 'ADD', delta: (args.delta as number) ?? 5 },
          cause: { ...ctx.source },
        },
        {
          type: 'SCHEDULE_PENDING_EFFECT',
          effect: {
            kind: 'SCHEDULED',
            when: 'END_OF_NEXT_TURN',
            sourceId: targetId,
            sourceOwner: owner,
            sourceLane: ctx.selfLane,
            fireTurn: state.turn + 1,
            effect: {
              kind: 'DESTROY',
              target: {
                kind: 'ALL_CARDS',
                ownerFilter: 'SELF_OWNER',
                zoneFilter: 'LANE',
              },
            },
          },
          cause: { ...ctx.source },
        },
      ],
    };
  }

  if (fn === 'COPY_TOP_ENEMY_DECK_CARD_TO_HAND') {
    if (owner === null || state.hand[owner].length >= manifest.constants.handCap) {
      return { commands: [] };
    }
    const opponent: Owner = owner === 'P0' ? 'P1' : 'P0';
    const topId = state.deck[opponent][0];
    const top = topId && getCardRuntime(state, topId, manifest);
    if (!top) return { commands: [] };
    return {
      commands: [createInHand(
        ctx,
        owner,
        mintCardId(ctx, 'copy'),
        top.defId,
        { kind: 'COPY_OF', sourceCardId: topId },
      )],
    };
  }

  if (fn === 'ADD_DISCARDED_CARD_TO_HAND') {
    if (owner === null || state.hand[owner].length >= manifest.constants.handCap) {
      return { commands: [] };
    }
    const discarded = getAllCardIds(state)
      .map(id => getCardRuntime(state, id, manifest))
      .filter((card): card is NonNullable<typeof card> =>
        card !== null && card.owner === owner && card.zone === 'DISCARD');
    if (discarded.length === 0) return { commands: [] };
    return {
      commands: [{
        type: 'CHANGE_CARD_ZONE',
        cardId: ctx.rng.scope('pick').pick(discarded).id,
        destination: { kind: 'HAND' },
        cause: { ...ctx.source },
      }],
    };
  }

  if (fn === 'DISABLE_ONGOINGS_THIS_LANE_THIS_TURN') {
    if (ctx.selfLane === null || self === null) return { commands: [] };
    const commands: GameCommand[] = [];
    for (const id of [
      ...state.lanesById[ctx.selfLane].cards.P0,
      ...state.lanesById[ctx.selfLane].cards.P1,
    ]) {
      if (id === self) continue;
      const card = getCardRuntime(state, id, manifest);
      if (
        !card
        || (card.text.abilities.ongoing?.length ?? 0) === 0
        || card.tags.some(tag =>
          tag.kind === 'ONGOING_DISABLED'
          && tag.sourceId === self)
      ) continue;
      commands.push({
        type: 'CHANGE_CARD_TAG',
        cardId: id,
        mutation: {
          kind: 'ADD',
          tag: { kind: 'ONGOING_DISABLED', sourceId: self },
        },
        cause: { ...ctx.source },
      });
    }
    return { commands };
  }

  if (fn === 'RECKLESS_RECRUITER') {
    if (owner === null) return { commands: [] };
    const commands: GameCommand[] = [];
    for (const cardId of state.deck[owner]) {
      const cost = ctx.rng.scope(`recruit:${cardId}`).int(0, 1) === 0;
      if (!cost && !isPowerBearingCard(state, cardId, manifest)) continue;
      commands.push(cost
        ? {
            type: 'CHANGE_COST',
            cardId,
            mutation: { kind: 'ADD', delta: -1 },
            cause: { ...ctx.source },
          }
        : {
            type: 'CHANGE_STORED_POWER',
            cardId,
            mutation: { kind: 'ADD', delta: 2 },
            cause: { ...ctx.source },
          });
    }
    return { commands };
  }

  if (fn === 'BARRACADE_CHECK') {
    if (
      self === null
      || ctx.selfLane === null
      || !getCardRuntime(state, self, manifest)
      || !isPowerBearingCard(state, self, manifest)
      || !cardWasPlayedAtLaneThisTurn(state, ctx.selfLane)
    ) return { commands: [] };
    return {
      commands: [{
        type: 'CHANGE_STORED_POWER',
        cardId: self,
        mutation: { kind: 'ADD', delta: (args.delta as number) ?? 4 },
        cause: { ...ctx.source },
      }],
    };
  }

  if (fn === 'TRAUMA_TEAM') {
    if (
      owner === null
      || ctx.selfLane === null
      || state.lanesById[ctx.selfLane].cards[owner].length
        >= manifest.constants.laneCapacity
    ) return { commands: [] };
    const destroyed = getAllCardIds(state).filter((id) => {
      const card = getCardRuntime(state, id, manifest);
      return card?.owner === owner
        && card.zone === 'DESTROYED'
        && card.lifecycle.turnDestroyed === state.turn - 1;
    });
    if (destroyed.length === 0) return { commands: [] };
    return {
      commands: [{
        type: 'RETURN_CARD',
        cardId: ctx.rng.scope('revive').pick(destroyed),
        lane: ctx.selfLane,
        revealed: true,
        cause: { ...ctx.source },
      }],
    };
  }

  if (fn === 'SOCIAL_WORKER') {
    if (owner === null || ctx.selfLane === null || self === null) {
      return { commands: [] };
    }
    const commands: GameCommand[] = [];
    for (const cardId of [
      ...state.lanesById[ctx.selfLane].cards.P0,
      ...state.lanesById[ctx.selfLane].cards.P1,
    ]) {
      if (cardId === self || !getCardRuntime(state, cardId, manifest)) continue;
      const currentCost = getCardCost(state, cardId, manifest);
      const candidates = getAllCardTemplates(manifest)
        .filter(def =>
          def.domain === 'character'
          && def.baseCost === currentCost + 1)
        .map(def => def.defId);
      if (candidates.length === 0) continue;
      commands.push({
        type: 'TRANSFORM_CARD',
        cardId,
        newDefId: ctx.rng.scope(`social:${cardId}`).pick(candidates),
        metadataPolicy: 'RESET_TO_DEFINITION',
        cause: { ...ctx.source },
      });
    }
    return { commands };
  }

  // The remaining built-ins either already have dedicated pure planners or
  // require a continuation after observing committed child results.
  return null;
}

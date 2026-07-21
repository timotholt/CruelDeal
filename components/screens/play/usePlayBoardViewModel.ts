import { createMemo, type Accessor } from 'solid-js';
import type { MatchContentCatalog } from '@/services/playgame/client/contentCatalog';
import type { LaneId, Seat } from '@/services/playgame/engine/types/ids';
import { isBoardCardResolutionLocked } from '@/services/playgame/presentation/cardFacing';
import type {
  SeatCardStatReadModel,
  SeatLanePowerReadModel,
} from '@/services/playgame/runtime/seatReadModels';
import type {
  SeatCardToken,
  SeatReplayStep,
  SeatReplayTimeline,
  SeatVisibleMatchState,
} from '@/services/playgame/runtime/projection';
import {
  getCardsInZoneForSeat,
  getHandForSeat,
  getLaneCardsForSeat,
  getLocation,
  type ResolvedCard,
  type ResolvedLocation,
  type UiState,
  type VisiblePileZone,
} from '@/services/playgame/view';
import { selectInteractiveHand } from './handInteractivity';

interface SelectedPile {
  readonly owner: Seat;
  readonly zone: VisiblePileZone;
}

interface PlayBoardViewModelOptions {
  readonly content: MatchContentCatalog;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly engineState: Accessor<SeatVisibleMatchState>;
  readonly ui: UiState;
  readonly isResolving: Accessor<boolean>;
  readonly turnFlowRunning: Accessor<boolean>;
  readonly replayTimeline: Accessor<SeatReplayTimeline | null>;
  readonly replayCursor: Accessor<number>;
  readonly openPile: Accessor<SelectedPile | null>;
  readonly cardStatReadModel: (
    token: SeatCardToken,
  ) => SeatCardStatReadModel | null;
  readonly lanePowerReadModel: (
    lane: LaneId,
    owner: Seat,
  ) => SeatLanePowerReadModel | null;
}

export interface PlayBoardViewModel {
  readonly replayLastCursor: Accessor<number>;
  readonly replayStep: Accessor<SeatReplayStep | null>;
  readonly inspectingReplayHistory: Accessor<boolean>;
  readonly presentedState: Accessor<SeatVisibleMatchState>;
  readonly boardLocked: Accessor<boolean>;
  readonly boardInteractive: Accessor<boolean>;
  readonly boardInspectable: Accessor<boolean>;
  readonly boardCardResolutionLocked: Accessor<boolean>;
  readonly laneIds: Accessor<readonly LaneId[]>;
  readonly hand: Accessor<ResolvedCard[]>;
  readonly reservedHandIds: Accessor<Set<string>>;
  readonly interactiveHand: Accessor<ResolvedCard[]>;
  readonly bottomLane: (lane: LaneId) => ResolvedCard[];
  readonly topLane: (lane: LaneId) => ResolvedCard[];
  readonly laneLocation: (lane: LaneId) => ResolvedLocation;
  readonly bottomPower: (lane: LaneId) => number;
  readonly topPower: (lane: LaneId) => number;
  readonly bottomBreakdown: (lane: LaneId) => SeatLanePowerReadModel;
  readonly topBreakdown: (lane: LaneId) => SeatLanePowerReadModel;
  readonly localHasPriority: Accessor<boolean>;
  readonly localDiscard: Accessor<ResolvedCard[]>;
  readonly localDestroyed: Accessor<ResolvedCard[]>;
  readonly remoteDiscard: Accessor<ResolvedCard[]>;
  readonly remoteDestroyed: Accessor<ResolvedCard[]>;
  readonly remoteHandSize: Accessor<number>;
  readonly localDeckSize: Accessor<number>;
  readonly remoteDeckSize: Accessor<number>;
  readonly selectedPileCards: Accessor<readonly ResolvedCard[]>;
  readonly recordedOutcomeLabel: Accessor<'WIN' | 'LOSE' | 'DRAW' | null>;
}

export function usePlayBoardViewModel(
  options: PlayBoardViewModelOptions,
): PlayBoardViewModel {
  const replayLastCursor = createMemo(() => Math.max(
    0,
    (options.replayTimeline()?.steps.length ?? 1) - 1,
  ));
  const replayStep = createMemo(() => {
    const timeline = options.replayTimeline();
    return timeline?.steps[options.replayCursor()] ?? null;
  });
  const inspectingReplayHistory = createMemo(
    () => options.replayCursor() < replayLastCursor(),
  );
  const presentedState = createMemo(() => (
    inspectingReplayHistory()
      ? replayStep()?.state ?? options.engineState()
      : options.engineState()
  ));
  const boardLocked = createMemo(() => (
    options.turnFlowRunning()
    || options.isResolving()
    || presentedState().phase === 'RESOLVING'
  ));
  const boardInteractive = createMemo(
    () => !inspectingReplayHistory() && !boardLocked(),
  );
  const boardInspectable = createMemo(
    () => inspectingReplayHistory() || boardInteractive(),
  );
  const boardCardResolutionLocked = createMemo(() => (
    isBoardCardResolutionLocked({
      inspectingHistory: inspectingReplayHistory(),
      phase: presentedState().phase,
      liveResolutionLocked: options.ui.isFlipped,
    })
  ));
  const laneIds = createMemo<readonly LaneId[]>(() => (
    presentedState().lanes
      .filter(lane => lane.status === 'ACTIVE')
      .map(lane => lane.id)
  ));
  const statReader = () => inspectingReplayHistory()
    ? undefined
    : options.cardStatReadModel;
  const hand = createMemo<ResolvedCard[]>(() => getHandForSeat(
    presentedState(),
    options.localSeat,
    options.content,
    statReader(),
  ));
  const reservedHandIds = createMemo<Set<string>>(() => (
    inspectingReplayHistory()
      ? new Set<string>()
      : new Set(options.ui.handReservations.map(card => card.id))
  ));
  const interactiveHand = createMemo<ResolvedCard[]>(() => (
    selectInteractiveHand(hand(), reservedHandIds())
  ));
  const bottomLane = (lane: LaneId): ResolvedCard[] => getLaneCardsForSeat(
    presentedState(),
    lane,
    options.localSeat,
    options.content,
    statReader(),
  );
  const topLane = (lane: LaneId): ResolvedCard[] => getLaneCardsForSeat(
    presentedState(),
    lane,
    options.remoteSeat,
    options.content,
    statReader(),
  );
  const laneLocation = (lane: LaneId): ResolvedLocation => getLocation(
    presentedState(),
    lane,
    options.content,
  );
  const laneState = (lane: LaneId) => presentedState().lanes.find(
    candidate => candidate.id === lane,
  );
  const bottomPower = (lane: LaneId): number => (
    laneState(lane)?.power[options.localSeat] ?? 0
  );
  const topPower = (lane: LaneId): number => (
    laneState(lane)?.power[options.remoteSeat] ?? 0
  );
  const fallbackBreakdown = (
    lane: LaneId,
    owner: Seat,
  ): SeatLanePowerReadModel => {
    const cards = getLaneCardsForSeat(
      presentedState(),
      lane,
      owner,
      options.content,
    ).map(card => ({
      label: card.name,
      basePower: card.basePower,
      permanentDelta: card.storedPowerDelta,
      ongoingDelta: 0,
      finalPower: card.power,
    }));
    const total = laneState(lane)?.power[owner] ?? 0;
    return {
      lane,
      owner,
      cards,
      cardSubtotal: cards.reduce((sum, card) => sum + card.finalPower, 0),
      laneAdditions: [],
      subtotalAfterAdditions: total,
      multipliers: [],
      effectiveMultiplier: 1,
      total,
    };
  };
  const breakdown = (lane: LaneId, owner: Seat): SeatLanePowerReadModel => (
    inspectingReplayHistory()
      ? fallbackBreakdown(lane, owner)
      : options.lanePowerReadModel(lane, owner) ?? fallbackBreakdown(lane, owner)
  );
  const bottomBreakdown = (lane: LaneId): SeatLanePowerReadModel => (
    breakdown(lane, options.localSeat)
  );
  const topBreakdown = (lane: LaneId): SeatLanePowerReadModel => (
    breakdown(lane, options.remoteSeat)
  );
  const localHasPriority = createMemo(
    () => presentedState().priority === options.localSeat,
  );
  const zoneCards = (seat: Seat, zone: VisiblePileZone): ResolvedCard[] => (
    getCardsInZoneForSeat(
      presentedState(),
      seat,
      zone,
      options.content,
      statReader(),
    )
  );
  const localDiscard = createMemo(() => zoneCards(options.localSeat, 'DISCARD'));
  const localDestroyed = createMemo(() => zoneCards(options.localSeat, 'DESTROYED'));
  const localBanished = createMemo(() => zoneCards(options.localSeat, 'BANISHED'));
  const remoteDiscard = createMemo(() => zoneCards(options.remoteSeat, 'DISCARD'));
  const remoteDestroyed = createMemo(() => zoneCards(options.remoteSeat, 'DESTROYED'));
  const remoteBanished = createMemo(() => zoneCards(options.remoteSeat, 'BANISHED'));
  const remoteHandSize = createMemo(
    () => presentedState().hands[options.remoteSeat].length,
  );
  const localDeckSize = createMemo(
    () => presentedState().deckCounts[options.localSeat],
  );
  const remoteDeckSize = createMemo(
    () => presentedState().deckCounts[options.remoteSeat],
  );
  const selectedPileCards = createMemo<readonly ResolvedCard[]>(() => {
    const pile = options.openPile();
    if (!pile) return [];
    if (pile.owner === options.localSeat) {
      if (pile.zone === 'DISCARD') return localDiscard();
      if (pile.zone === 'DESTROYED') return localDestroyed();
      return localBanished();
    }
    if (pile.zone === 'DISCARD') return remoteDiscard();
    if (pile.zone === 'DESTROYED') return remoteDestroyed();
    return remoteBanished();
  });
  const recordedOutcomeLabel = createMemo<'WIN' | 'LOSE' | 'DRAW' | null>(() => {
    const result = options.ui.lockedResult;
    if (!result) return null;
    if (result.winner === options.localSeat) return 'WIN';
    if (result.winner === options.remoteSeat) return 'LOSE';
    return 'DRAW';
  });

  return {
    replayLastCursor,
    replayStep,
    inspectingReplayHistory,
    presentedState,
    boardLocked,
    boardInteractive,
    boardInspectable,
    boardCardResolutionLocked,
    laneIds,
    hand,
    reservedHandIds,
    interactiveHand,
    bottomLane,
    topLane,
    laneLocation,
    bottomPower,
    topPower,
    bottomBreakdown,
    topBreakdown,
    localHasPriority,
    localDiscard,
    localDestroyed,
    remoteDiscard,
    remoteDestroyed,
    remoteHandSize,
    localDeckSize,
    remoteDeckSize,
    selectedPileCards,
    recordedOutcomeLabel,
  };
}

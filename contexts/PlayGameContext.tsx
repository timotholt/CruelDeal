import {
  createContext,
  createSignal,
  onCleanup,
  untrack,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import type { Manifest } from '@/services/playgame/engine/manifest/types';
import type { CardId, LaneIdx, Seat } from '@/services/playgame/engine/types/ids';
import type { MatchEvent } from '@/services/playgame/engine/types/events';
import type { MatchState as EngineMatchState } from '@/services/playgame/engine/types/state';
import { replayMatch } from '@/services/playgame/engine/replay';
import { buildEventTransactionFrames } from '@/services/playgame/engine/transactionFrames';
import type {
  IntentAcceptanceResult,
  MatchEventFrame,
  MatchRuntimeReplayExport,
  MatchTransactionFrames,
  RuntimeIntent,
  ValidatedMatchBootstrap,
} from '@/services/playgame/runtime/contracts';
import { createMatchRuntime } from '@/services/playgame/runtime/matchRuntime';
import { otherSeat } from '@/services/playgame/engine/types/ids';
import type { UiState } from '@/services/playgame/view';
export type { UiState } from '@/services/playgame/view';

type EngineStateStore = {
  -readonly [K in keyof EngineMatchState]: EngineMatchState[K];
};

declare global {
  interface Window {
    __snapDebug?: {
      getLiveState: () => EngineMatchState;
      getLiveLog: () => readonly import('@/services/playgame/engine/types/state').MatchLogEntry[];
      getReplayBundle: () => MatchRuntimeReplayExport;
      getReplayTimeline: () => ReturnType<typeof replayMatch>;
      getFrame: (index: number) => import('@/services/playgame/engine/replay').ReplayFrame | null;
      copyReplayJson: () => Promise<string>;
    };
  }
}

export interface PlayGameContextValue {
  engineState: EngineMatchState;
  initialState: EngineMatchState;
  manifest: Manifest;
  localSeat: Seat;
  remoteSeat: Seat;
  seatMeta: Record<Seat, { name: string }>;
  ui: UiState;
  setUi: SetStoreFunction<UiState>;
  isResolving: Accessor<boolean>;
  openingTimeline: MatchTransactionFrames;
  replayEvents: () => readonly MatchEvent[];
  exportRuntimeReplay: () => MatchRuntimeReplayExport;
  actions: {
    stageCardInLane: (cardId: string, laneIdx: number) => Promise<boolean>;
    undoPending: () => Promise<boolean>;
    undoPendingCard: (cardId: string) => Promise<boolean>;
    endTurn: () => Promise<MatchTransactionFrames | null>;
    presentCommittedFrame: (frame: MatchEventFrame) => void;
    finishTurnPresentation: () => void;
  };
}

const Ctx = createContext<PlayGameContextValue>();

export const PlayGameProvider = (props: {
  children: JSX.Element;
  bootstrap: ValidatedMatchBootstrap;
}) => {
  const bootstrap = untrack(() => props.bootstrap);
  const manifest = BOOTSTRAP_MANIFEST;
  const runtime = createMatchRuntime(bootstrap);
  const localSeat = bootstrap.viewerSeat;
  const remoteSeat = otherSeat(localSeat);
  const seatMeta: Record<Seat, { name: string }> = {
    P0: { name: bootstrap.participants.P0.displayName },
    P1: { name: bootstrap.participants.P1.displayName },
  };
  const opening = runtime.transactions()[0];
  if (!opening) throw new Error('PlayGameProvider: runtime did not commit opening transaction');
  const builtOpening = buildEventTransactionFrames({
    transactionId: opening.transactionId,
    initialState: runtime.genesis(),
    events: opening.events,
    manifest,
  });
  const openingTimeline: MatchTransactionFrames = {
    transaction: opening,
    frames: builtOpening.frames,
    finalState: builtOpening.finalState,
  };

  const [engineState, setEngineState] = createStore<EngineStateStore>(
    structuredClone(runtime.genesis()) as EngineStateStore,
  );
  const [ui, setUi] = createStore<UiState>({
    handReservations: [],
    history: [],
    isFlipped: false,
    lockedResult: null,
    showEndGamePrompt: false,
  });
  const [presentationBusy, setPresentationBusy] = createSignal(false);
  const resolutionWaiters = new Set<(timeline: MatchTransactionFrames) => void>();
  const projectedFrameStates = new WeakMap<MatchEventFrame, EngineMatchState>();
  let activeProjectedTransactionId: string | null = null;
  let intentCounter = 0;

  const adoptRuntimeState = (state: EngineMatchState): void => {
    // Runtime snapshots are immutable authority objects. Reconcile may retain
    // newly inserted array members by reference, which lets a later runtime
    // projection alias store-owned nodes and skip Solid writes by identity.
    // Replace every top-level branch with a private clone instead.
    setEngineState(() => structuredClone(state) as EngineStateStore);
  };

  const adoptWorkingProjection = (
    committedBase?: EngineMatchState,
    capturedProjection?: EngineMatchState,
  ): void => {
    adoptRuntimeState(capturedProjection ?? runtime.projectWorkingState(committedBase));
  };

  const syncFromRuntime = (): void => adoptWorkingProjection();

  const captureTimelineProjection = (timeline: MatchTransactionFrames): void => {
    for (const frame of timeline.frames) {
      projectedFrameStates.set(frame, runtime.projectWorkingState(frame.after));
    }
  };

  captureTimelineProjection(openingTimeline);

  const unsubscribe = runtime.subscribeCommittedTransactions((timeline) => {
    // Authority is already final. Capture presentation-only working
    // projections synchronously while the runtime still has the viewer's
    // private plan available, then let the presentation driver walk them.
    captureTimelineProjection(timeline);
    const isTurnResolution = timeline.frames.some(
      (frame) => frame.event.type === 'TURN_RESOLUTION_STARTED',
    );
    if (isTurnResolution && resolutionWaiters.size > 0) {
      activeProjectedTransactionId = timeline.transaction.transactionId;
      for (const resolveWaiter of [...resolutionWaiters]) resolveWaiter(timeline);
      resolutionWaiters.clear();
    } else {
      const finalFrame = timeline.frames.at(-1);
      adoptWorkingProjection(
        timeline.finalState,
        finalFrame ? projectedFrameStates.get(finalFrame) : undefined,
      );
    }
  });
  onCleanup(unsubscribe);

  const submit = (intent: RuntimeIntent): Promise<IntentAcceptanceResult> => runtime.submitIntent({
    matchId: bootstrap.matchId,
    seat: localSeat,
    intentId: `live-${localSeat}-${++intentCounter}-${intent.type.toLowerCase()}`,
    expectedRevision: runtime.revision(),
    intent,
  });

  const stageCardInLane = async (cardId: string, laneIdx: number): Promise<boolean> => {
    const result = await submit({
      type: 'STAGE_CARD',
      cardId: cardId as CardId,
      lane: laneIdx as LaneIdx,
    });
    if (result.status !== 'accepted') return false;
    syncFromRuntime();
    return true;
  };

  const undoPendingCard = async (cardId: string): Promise<boolean> => {
    const result = await submit({ type: 'UNSTAGE_CARD', cardId: cardId as CardId });
    if (result.status !== 'accepted') return false;
    syncFromRuntime();
    return true;
  };

  const undoPending = async (): Promise<boolean> => {
    const lastStaged = [...runtime.state().stagingOrder]
      .reverse()
      .find((id) => runtime.state().cards[id]?.owner === localSeat);
    return lastStaged ? undoPendingCard(lastStaged) : false;
  };

  const endTurn = async (): Promise<MatchTransactionFrames | null> => {
    setPresentationBusy(true);
    let resolveTimeline!: (timeline: MatchTransactionFrames) => void;
    const timelinePromise = new Promise<MatchTransactionFrames>((resolve) => {
      resolveTimeline = resolve;
      resolutionWaiters.add(resolve);
    });
    const result = await submit({ type: 'END_TURN' });
    if (result.status !== 'accepted') {
      resolutionWaiters.delete(resolveTimeline);
      syncFromRuntime();
      setPresentationBusy(false);
      return null;
    }
    return timelinePromise;
  };

  const replayEvents = (): readonly MatchEvent[] => runtime.transactions().flatMap(
    (transaction) => transaction.events,
  );

  const value: PlayGameContextValue = {
    engineState: engineState as unknown as EngineMatchState,
    initialState: runtime.genesis(),
    manifest,
    localSeat,
    remoteSeat,
    seatMeta,
    ui,
    setUi,
    isResolving: () => presentationBusy() || engineState.phase === 'RESOLVING',
    openingTimeline,
    replayEvents,
    exportRuntimeReplay: runtime.exportReplay,
    actions: {
      stageCardInLane,
      undoPending,
      undoPendingCard,
      endTurn,
      presentCommittedFrame: (frame) => {
        const capturedProjection = frame.transactionId === activeProjectedTransactionId
          ? projectedFrameStates.get(frame)
          : undefined;
        adoptWorkingProjection(frame.after, capturedProjection);
      },
      finishTurnPresentation: () => {
        // Normal completion is already at the final frame. Cancellation or a
        // best-effort animation failure fast-forwards display only.
        activeProjectedTransactionId = null;
        syncFromRuntime();
        setPresentationBusy(false);
      },
    },
  };

  if (typeof window !== 'undefined') {
    const timeline = () => replayMatch({
      seed: runtime.genesis().seed,
      manifest,
      initialState: runtime.genesis(),
      events: replayEvents(),
    });
    window.__snapDebug = {
      getLiveState: () => structuredClone(runtime.state()),
      getLiveLog: () => structuredClone(runtime.state().log),
      getReplayBundle: runtime.exportReplay,
      getReplayTimeline: timeline,
      getFrame: (index) => timeline().frames[index] ?? null,
      copyReplayJson: async () => {
        const json = JSON.stringify(runtime.exportReplay(), null, 2);
        await navigator.clipboard.writeText(json);
        return json;
      },
    };
    onCleanup(() => {
      delete window.__snapDebug;
    });
  }

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
};

export const usePlayGame = (): PlayGameContextValue => {
  const value = useContext(Ctx);
  if (!value) throw new Error('usePlayGame must be used inside <PlayGameProvider>');
  return value;
};

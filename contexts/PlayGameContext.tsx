import {
  batch,
  createContext,
  createSignal,
  onCleanup,
  untrack,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';
import type { Manifest } from '@/services/playgame/engine/manifest/types';
import type { CardId, LaneId, Seat } from '@/services/playgame/engine/types/ids';
import type { MatchState as EngineMatchState } from '@/services/playgame/engine/types/state';
import type { EventTransition } from '@/services/playgame/engine/transactionTimeline';
import type {
  CommittedTransactionTimeline,
  IntentAcceptanceResult,
  MatchRuntimeReplayExport,
  RuntimeIntent,
} from '@/services/playgame/runtime/contracts';
import type { MatchSession } from '@/services/playgame/runtime/matchSession';
import { otherSeat } from '@/services/playgame/engine/types/ids';
import type { UiState } from '@/services/playgame/view';
import { getCardRuntime } from '@/services/playgame/engine/projections';
import {
  elapsed,
  monotonicNow,
  type FramePresentationTiming,
  type MatchPerformanceProfile,
} from '@/services/playgame/runtime/performanceTelemetry';
export type { UiState } from '@/services/playgame/view';

export interface PlayGameContextValue {
  engineState: Accessor<EngineMatchState>;
  manifest: Manifest;
  localSeat: Seat;
  remoteSeat: Seat;
  seatMeta: Record<Seat, { name: string }>;
  ui: UiState;
  setUi: SetStoreFunction<UiState>;
  isResolving: Accessor<boolean>;
  openingTimeline: CommittedTransactionTimeline;
  exportRuntimeReplay: () => MatchRuntimeReplayExport;
  performanceProfile: Accessor<MatchPerformanceProfile>;
  actions: {
    stageCardInLane: (cardId: string, laneIdx: number) => Promise<boolean>;
    undoPending: () => Promise<boolean>;
    undoPendingCard: (cardId: string) => Promise<boolean>;
    endTurn: (onWaitingForSeat?: (seat: Seat) => void) => Promise<CommittedTransactionTimeline | null>;
    presentCommittedFrame: (frame: EventTransition) => void;
    recordFramePresentationTiming: (timing: FramePresentationTiming) => void;
    finishTurnPresentation: () => void;
  };
}

const Ctx = createContext<PlayGameContextValue>();

export const PlayGameProvider = (props: {
  children: JSX.Element;
  session: MatchSession;
}) => {
  const session = untrack(() => props.session);
  const bootstrap = session.bootstrap;
  const manifest = session.manifest;
  const runtime = session.runtime;
  const localSeat = bootstrap.viewerSeat;
  const remoteSeat = otherSeat(localSeat);
  const seatMeta: Record<Seat, { name: string }> = {
    P0: { name: bootstrap.participants.P0.displayName },
    P1: { name: bootstrap.participants.P1.displayName },
  };
  const initialization = runtime.initialization();
  const openingTimeline = initialization.opening;

  const [engineState, setPresentedState] = createSignal<EngineMatchState>(
    initialization.setup.finalState,
    { equals: false },
  );
  const [ui, setUi] = createStore<UiState>({
    handReservations: [],
    history: [],
    isFlipped: false,
    lockedResult: null,
    showEndGamePrompt: false,
  });
  const [presentationBusy, setPresentationBusy] = createSignal(false);
  const [performanceRevision, setPerformanceRevision] = createSignal(0);
  const resolutionWaiters = new Set<(timeline: CommittedTransactionTimeline) => void>();
  const projectedFrameStates = new WeakMap<EventTransition, EngineMatchState>();
  let activeProjectedTransactionId: string | null = null;
  let intentCounter = 0;

  const adoptRuntimeState = (state: EngineMatchState): void => {
    // Runtime snapshots are immutable authority values. Replace the snapshot
    // reference atomically; never recursively proxy/reconcile the complete
    // game state and replay log through a presentation store.
    setPresentedState(() => state);
  };

  const adoptWorkingProjection = (
    committedBase?: EngineMatchState,
    capturedProjection?: EngineMatchState,
  ): void => {
    adoptRuntimeState(capturedProjection ?? runtime.projectWorkingState(committedBase));
  };

  const syncFromRuntime = (): void => adoptWorkingProjection();

  const captureTimelineProjection = (timeline: CommittedTransactionTimeline): void => {
    for (const frame of timeline.transitions) {
      const startedAtMs = monotonicNow();
      projectedFrameStates.set(frame, runtime.projectWorkingState(frame.after));
      const endedAtMs = monotonicNow();
      session.performanceTelemetry.recordFrameProjection({
        transactionId: frame.transactionId,
        frame: frame.frame,
        eventType: frame.event.type,
        startedAtMs,
        endedAtMs,
        durationMs: elapsed(startedAtMs, endedAtMs),
      });
    }
    setPerformanceRevision((revision) => revision + 1);
  };

  captureTimelineProjection(openingTimeline);

  const unsubscribe = runtime.subscribeCommittedTransactions((timeline) => {
    // Authority is already final. Capture presentation-only working
    // projections synchronously while the runtime still has the viewer's
    // private plan available, then let the presentation driver walk them.
    captureTimelineProjection(timeline);
    const isTurnResolution = timeline.transitions.some(
      (frame) => frame.event.type === 'TURN_RESOLUTION_STARTED',
    );
    if (isTurnResolution && resolutionWaiters.size > 0) {
      activeProjectedTransactionId = timeline.transaction.transactionId;
      for (const resolveWaiter of [...resolutionWaiters]) resolveWaiter(timeline);
      resolutionWaiters.clear();
    } else {
      const finalFrame = timeline.transitions.at(-1);
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
      lane: laneIdx as LaneId,
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
      .find((id) => getCardRuntime(runtime.state(), id, manifest)?.owner === localSeat);
    return lastStaged ? undoPendingCard(lastStaged) : false;
  };

  const endTurn = async (
    onWaitingForSeat?: (seat: Seat) => void,
  ): Promise<CommittedTransactionTimeline | null> => {
    setPresentationBusy(true);
    let resolveTimeline!: (timeline: CommittedTransactionTimeline) => void;
    const timelinePromise = new Promise<CommittedTransactionTimeline>((resolve) => {
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
    if (result.commit === 'PRIVATE') {
      onWaitingForSeat?.(remoteSeat);
    }
    return timelinePromise;
  };

  const value: PlayGameContextValue = {
    engineState,
    manifest,
    localSeat,
    remoteSeat,
    seatMeta,
    ui,
    setUi,
    isResolving: () => presentationBusy() || engineState().phase === 'RESOLVING',
    openingTimeline,
    exportRuntimeReplay: session.exportReplay,
    performanceProfile: () => {
      void performanceRevision();
      return runtime.performanceProfile();
    },
    actions: {
      stageCardInLane,
      undoPending,
      undoPendingCard,
      endTurn,
      presentCommittedFrame: (frame) => {
        const capturedProjection = frame.transactionId === activeProjectedTransactionId
          ? projectedFrameStates.get(frame)
          : undefined;
        // Solid store writes propagate synchronously. Batch the lock and the
        // committed projection so BoardCard can never observe (and render)
        // the RESOLVING frame without its presentation-facing lock.
        batch(() => {
          if (frame.event.type === 'TURN_RESOLUTION_STARTED') {
            // Presentation-only lock: staged cards remain mechanically
            // unrevealed, but the owner was allowed to see their faces while
            // planning. Lock that facing before the reveal walk advances.
            setUi('isFlipped', true);
          }
          adoptWorkingProjection(frame.after, capturedProjection);
        });
      },
      recordFramePresentationTiming: (timing) => {
        session.performanceTelemetry.recordFramePresentation(timing);
        setPerformanceRevision((revision) => revision + 1);
      },
      finishTurnPresentation: () => {
        // Normal completion is already at the final frame. Cancellation or a
        // best-effort animation failure fast-forwards display only.
        activeProjectedTransactionId = null;
        setUi('isFlipped', false);
        syncFromRuntime();
        setPresentationBusy(false);
      },
    },
  };

  let providerDisposed = false;
  let uninstallDebug = (): void => undefined;
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    void import('@/services/playgame/debug/installSnapDebug').then(({ installSnapDebug }) => {
      if (!providerDisposed) uninstallDebug = installSnapDebug(runtime, manifest, session.exportReplay);
    });
  }
  onCleanup(() => {
    providerDisposed = true;
    uninstallDebug();
  });

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
};

export const usePlayGame = (): PlayGameContextValue => {
  const value = useContext(Ctx);
  if (!value) throw new Error('usePlayGame must be used inside <PlayGameProvider>');
  return value;
};

import {
  batch,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';
import { useMatchSession } from './MatchSessionContext';
import type {
  SeatPresentationBlock,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '@/services/playgame/runtime/projection';
import { seatPresentationBlockToTransactionTimeline } from '@/services/playgame/runtime/projection';
import {
  PresentationDirector,
  type MatchPresentationSink,
} from '@/services/playgame/presentation/presentationDirector';
import type { UiState } from '@/services/playgame/view';
import type { VisiblePileZone } from '@/services/playgame/view';
import type { Seat } from '@/services/playgame/engine/types/ids';
import type { InspectTarget } from '@/components/screens/play/inspector';

export type ReplayClientActivity =
  | { readonly kind: 'PROCESSING_EVENTS' }
  | { readonly kind: 'PLAYING_ANIMATIONS' }
  | { readonly kind: 'WAITING_FOR_PLAYER'; readonly seat: Seat }
  | null;

export interface OpenPile {
  readonly owner: Seat;
  readonly zone: VisiblePileZone;
}

export interface PlayUiContextValue {
  readonly presentedState: Accessor<SeatVisibleMatchState>;
  readonly ui: UiState;
  readonly setUi: SetStoreFunction<UiState>;
  readonly isResolving: Accessor<boolean>;
  readonly inspectorTarget: Accessor<InspectTarget | null>;
  readonly openMenuSeat: Accessor<Seat | null>;
  readonly openPile: Accessor<OpenPile | null>;
  readonly replayOpen: Accessor<boolean>;
  readonly replayCursor: Accessor<number>;
  readonly replayFollowingLive: Accessor<boolean>;
  readonly replayClientActivity: Accessor<ReplayClientActivity>;
  readonly turnFlowRunning: Accessor<boolean>;
  readonly actions: {
    bindPresentationSink: (sink: MatchPresentationSink) => () => void;
    presentOpening: (block: SeatPresentationBlock) => void;
    requestPresentationFastForward: () => boolean;
    openInspector: (target: InspectTarget) => void;
    closeInspector: () => void;
    setOpenMenuSeat: (seat: Seat | null) => void;
    setOpenPile: (pile: OpenPile | null) => void;
    setReplayOpen: (open: boolean | ((current: boolean) => boolean)) => void;
    setReplayCursor: (cursor: number) => void;
    setReplayFollowingLive: (following: boolean) => void;
    setReplayClientActivity: (activity: ReplayClientActivity) => void;
  };
}

const PlayUiCtx = createContext<PlayUiContextValue>();

export const PlayUiProvider = (props: {
  readonly children: JSX.Element;
}) => {
  const match = useMatchSession();
  const [presentedState, setPresentedState] = createSignal(
    match.snapshot().state,
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
  const [inspectorTarget, setInspectorTarget] =
    createSignal<InspectTarget | null>(null);
  const [openMenuSeat, setOpenMenuSeat] = createSignal<Seat | null>(null);
  const [openPile, setOpenPile] = createSignal<OpenPile | null>(null);
  const [replayOpen, setReplayOpen] = createSignal(false);
  const [replayCursor, setReplayCursor] = createSignal(0);
  const [replayFollowingLive, setReplayFollowingLive] = createSignal(true);
  const [replayClientActivity, setReplayClientActivity] =
    createSignal<ReplayClientActivity>(null);
  const [turnFlowRunning, setTurnFlowRunning] = createSignal(false);
  let presentationSink: MatchPresentationSink | null = null;
  const blockQueue: SeatPresentationBlock[] = [];
  let draining = false;
  let disposed = false;

  const adoptFrame = (
    frame: SeatTransactionTimeline['frames'][number],
  ): void => {
    setPresentedState(() => match.actions.presentationStateForFrame(frame));
  };

  const snapToEnd = (timeline: SeatTransactionTimeline): void => {
    const finalFrame = timeline.frames.at(-1);
    setPresentedState(() => finalFrame
      ? match.actions.presentationStateForFrame(finalFrame)
      : timeline.finalState);
  };

  const director = new PresentationDirector({
    cursor: {
      advance: adoptFrame,
      snapToEnd,
    },
    onFrameSettled: (frame, timing) => {
      if (!frame.event) return;
      match.actions.recordFramePresentationTiming({
        transactionId: frame.transactionId,
        frame: frame.frame,
        eventType: frame.event.type,
        beatKind: frame.event.type,
        ...timing,
      });
    },
  });

  const finishPresentationQueue = (): void => {
    if (disposed || blockQueue.length > 0 || director.activeGeneration !== null) {
      return;
    }
    batch(() => {
      setUi('isFlipped', false);
      setPresentedState(() => match.snapshot().state);
      setPresentationBusy(false);
      setTurnFlowRunning(false);
      setReplayClientActivity(null);
    });
  };

  const drainPresentationQueue = async (): Promise<void> => {
    if (draining || disposed || !presentationSink) return;
    draining = true;
    batch(() => {
      setPresentationBusy(true);
      setTurnFlowRunning(true);
      setReplayClientActivity({ kind: 'PLAYING_ANIMATIONS' });
    });
    try {
      while (!disposed && presentationSink && blockQueue.length > 0) {
        const block = blockQueue.shift()!;
        const timeline = seatPresentationBlockToTransactionTimeline(block);
        const sink = presentationSink;
        try {
          await director.present(timeline, sink);
        } catch (error) {
          // Authority is already committed and the director has snapped the
          // visible cursor. Surface the presentation defect without blocking
          // later committed transactions.
          if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
            console.error('Committed timeline presentation failed', error);
          }
        } finally {
          await match.actions.acknowledgePresentationBlock(block);
        }
      }
    } finally {
      draining = false;
      finishPresentationQueue();
      if (!disposed && presentationSink && blockQueue.length > 0) {
        void drainPresentationQueue();
      }
    }
  };

  const enqueueBlock = (block: SeatPresentationBlock): void => {
    if (disposed) return;
    batch(() => {
      setPresentationBusy(true);
      setTurnFlowRunning(true);
      if (block.frames.some(
        frame => frame.event?.type === 'TURN_RESOLUTION_STARTED',
      )) {
        // Remote CARD_STAGED frames canonically precede resolution start, but
        // the local lock beat must paint before any hidden opposing card flies.
        setUi('isFlipped', true);
      }
    });
    blockQueue.push(block);
    void drainPresentationQueue();
  };

  const unsubscribeCommitted = match.subscribePresentationBlocks(
    enqueueBlock,
  );
  onCleanup(() => {
    disposed = true;
    unsubscribeCommitted();
    blockQueue.length = 0;
    presentationSink = null;
    director.dispose();
  });

  createEffect(() => {
    const next = match.snapshot().state;
    if (!presentationBusy()) setPresentedState(() => next);
  });

  const value: PlayUiContextValue = {
    presentedState,
    ui,
    setUi,
    isResolving: () =>
      presentationBusy() || presentedState().phase === 'RESOLVING',
    inspectorTarget,
    openMenuSeat,
    openPile,
    replayOpen,
    replayCursor,
    replayFollowingLive,
    replayClientActivity,
    turnFlowRunning,
    actions: {
      bindPresentationSink: (sink) => {
        if (presentationSink && presentationSink !== sink) {
          director.fastForward();
        }
        presentationSink = sink;
        void drainPresentationQueue();
        return () => {
          if (presentationSink !== sink) return;
          director.cancel();
          presentationSink = null;
          finishPresentationQueue();
        };
      },
      presentOpening: (block) => {
        // The opening transaction committed before this provider subscribed.
        // Lock presentation first, then promote the authoritative snapshot to
        // that already-committed end state. The visible cursor remains on the
        // setup state until the director adopts the opening frames.
        enqueueBlock(block);
        match.actions.refreshSnapshot();
      },
      requestPresentationFastForward: () => director.fastForward(),
      openInspector: target => setInspectorTarget(target),
      closeInspector: () => setInspectorTarget(null),
      setOpenMenuSeat,
      setOpenPile,
      setReplayOpen,
      setReplayCursor,
      setReplayFollowingLive,
      setReplayClientActivity,
    },
  };

  return (
    <PlayUiCtx.Provider value={value}>
      {props.children}
    </PlayUiCtx.Provider>
  );
};

export const usePlayUi = (): PlayUiContextValue => {
  const value = useContext(PlayUiCtx);
  if (!value) throw new Error('usePlayUi must be used inside <PlayUiProvider>');
  return value;
};

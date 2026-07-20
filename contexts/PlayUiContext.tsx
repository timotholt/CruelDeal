import {
  batch,
  createContext,
  createEffect,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';
import { useMatchSession } from './MatchSessionContext';
import type { FramePresentationTiming } from '@/services/playgame/runtime/performanceTelemetry';
import type {
  SeatTransactionFrame,
  SeatVisibleMatchState,
} from '@/services/playgame/runtime/projection';
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
    beginTurnPresentation: () => void;
    presentCommittedFrame: (frame: SeatTransactionFrame) => void;
    recordFramePresentationTiming: (
      timing: FramePresentationTiming,
    ) => void;
    finishTurnPresentation: () => void;
    openInspector: (target: InspectTarget) => void;
    closeInspector: () => void;
    setOpenMenuSeat: (seat: Seat | null) => void;
    setOpenPile: (pile: OpenPile | null) => void;
    setReplayOpen: (open: boolean | ((current: boolean) => boolean)) => void;
    setReplayCursor: (cursor: number) => void;
    setReplayFollowingLive: (following: boolean) => void;
    setReplayClientActivity: (activity: ReplayClientActivity) => void;
    setTurnFlowRunning: (running: boolean) => void;
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
      beginTurnPresentation: () => setPresentationBusy(true),
      presentCommittedFrame: (frame) => {
        batch(() => {
          if (frame.event?.type === 'TURN_RESOLUTION_STARTED') {
            setUi('isFlipped', true);
          }
          setPresentedState(() =>
            match.actions.presentationStateForFrame(frame),
          );
        });
      },
      recordFramePresentationTiming:
        timing => match.actions.recordFramePresentationTiming(timing),
      finishTurnPresentation: () => {
        batch(() => {
          setUi('isFlipped', false);
          match.actions.refreshSnapshot();
          setPresentedState(() => match.snapshot().state);
          setPresentationBusy(false);
        });
      },
      openInspector: target => setInspectorTarget(target),
      closeInspector: () => setInspectorTarget(null),
      setOpenMenuSeat,
      setOpenPile,
      setReplayOpen,
      setReplayCursor,
      setReplayFollowingLive,
      setReplayClientActivity,
      setTurnFlowRunning,
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

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

export interface PlayUiContextValue {
  readonly presentedState: Accessor<SeatVisibleMatchState>;
  readonly ui: UiState;
  readonly setUi: SetStoreFunction<UiState>;
  readonly isResolving: Accessor<boolean>;
  readonly actions: {
    beginTurnPresentation: () => void;
    presentCommittedFrame: (frame: SeatTransactionFrame) => void;
    recordFramePresentationTiming: (
      timing: FramePresentationTiming,
    ) => void;
    finishTurnPresentation: () => void;
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

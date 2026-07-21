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
import type { Manifest } from '@/services/playgame/engine/manifest/types';
import { otherSeat, type LaneId, type Seat } from '@/services/playgame/engine/types/ids';
import type { MatchSession } from '@/services/playgame/runtime/matchSession';
import type {
  FramePresentationTiming,
  MatchPerformanceProfile,
} from '@/services/playgame/runtime/performanceTelemetry';
import { LocalMatchSessionAdapter } from '@/services/playgame/runtime/localMatchSessionAdapter';
import type {
  SeatCardStatReadModel,
  SeatLanePowerReadModel,
} from '@/services/playgame/runtime/seatReadModels';
import type {
  SeatBootstrap,
  SeatCardToken,
  SeatMatchSnapshot,
  SeatReplayTimeline,
  SeatTransactionFrame,
  SeatTransactionTimeline,
} from '@/services/playgame/runtime/projection';

export interface MatchSessionContextValue {
  readonly bootstrap: SeatBootstrap;
  readonly manifest: Manifest;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly snapshot: Accessor<SeatMatchSnapshot>;
  readonly openingTimeline: SeatTransactionTimeline;
  readonly subscribeCommittedTransactions: (
    subscriber: (timeline: SeatTransactionTimeline) => void,
  ) => () => void;
  readonly debug: {
    readonly performanceProfile: Accessor<MatchPerformanceProfile>;
    readonly replay: Accessor<SeatReplayTimeline>;
  } | null;
  readonly actions: {
    stageCardInLane: (token: SeatCardToken, lane: LaneId) => Promise<boolean>;
    undoPending: () => Promise<boolean>;
    undoPendingCard: (token: SeatCardToken) => Promise<boolean>;
    endTurn: (onWaitingForSeat?: (seat: Seat) => void) => Promise<boolean>;
    refreshSnapshot: () => void;
    presentationStateForFrame: (
      frame: SeatTransactionFrame,
    ) => SeatTransactionFrame['after'];
    cardStatReadModel: (
      token: SeatCardToken,
    ) => SeatCardStatReadModel | null;
    lanePowerReadModel: (
      lane: LaneId,
      owner: Seat,
    ) => SeatLanePowerReadModel | null;
    recordFramePresentationTiming: (
      timing: FramePresentationTiming,
    ) => void;
  };
}

const MatchSessionCtx = createContext<MatchSessionContextValue>();

export const MatchSessionProvider = (props: {
  readonly children: JSX.Element;
  readonly session: MatchSession;
}) => {
  const session = untrack(() => props.session);
  const adapter = new LocalMatchSessionAdapter(session);
  const initialization = adapter.initialization();
  const localSeat = adapter.bootstrap.viewerSeat;
  const remoteSeat = otherSeat(localSeat);
  const [snapshot, setSnapshot] = createSignal(initialization.setup, {
    equals: false,
  });
  const [performanceRevision, setPerformanceRevision] = createSignal(0);
  const [replayRevision, setReplayRevision] = createSignal(0);
  const debugEnabled =
    (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
  let providerDisposed = false;
  const transactionSubscribers = new Set<
    (timeline: SeatTransactionTimeline) => void
  >();

  const refreshSnapshot = (): void => {
    if (providerDisposed) return;
    setSnapshot(adapter.snapshot());
    setReplayRevision(revision => revision + 1);
  };

  const unsubscribeAdapter = adapter.subscribeCommittedTransactions(timeline =>
    untrack(() => {
      if (providerDisposed) return;
      batch(() => {
        setSnapshot({
          version: 1,
          matchId: timeline.matchId,
          revision: timeline.revision,
          frame: timeline.frames.at(-1)?.frame ?? snapshot().frame,
          viewerSeat: localSeat,
          state: timeline.finalState,
        });
        setReplayRevision(revision => revision + 1);

        for (const subscriber of [...transactionSubscribers]) {
          try {
            subscriber(timeline);
          } catch {
            // A presentation consumer cannot interrupt authoritative publication
            // or prevent the remaining consumers from observing the transaction.
          }
        }
      });
    }),
  );

  const subscribeCommittedTransactions = (
    subscriber: (timeline: SeatTransactionTimeline) => void,
  ): (() => void) => {
    if (providerDisposed) return () => undefined;
    transactionSubscribers.add(subscriber);
    return () => transactionSubscribers.delete(subscriber);
  };

  const accepted = async (
    command: Promise<{ readonly status: string }>,
  ): Promise<boolean> => {
    const result = await command;
    if (providerDisposed || result.status !== 'accepted') return false;
    refreshSnapshot();
    return true;
  };

  const value: MatchSessionContextValue = {
    bootstrap: adapter.bootstrap,
    manifest: adapter.manifest,
    localSeat,
    remoteSeat,
    snapshot,
    openingTimeline: initialization.opening,
    subscribeCommittedTransactions,
    debug: debugEnabled
      ? {
          replay: () => {
            void replayRevision();
            return adapter.replay();
          },
          performanceProfile: () => {
            void performanceRevision();
            return adapter.performanceProfile();
          },
        }
      : null,
    actions: {
      stageCardInLane: (token, lane) => accepted(adapter.stageCard(token, lane)),
      undoPending: () => accepted(adapter.undoLastStagedCard()),
      undoPendingCard: token => accepted(adapter.unstageCard(token)),
      endTurn: async (onWaitingForSeat) => {
        const result = await adapter.endTurn();
        if (providerDisposed || result.status !== 'accepted') {
          refreshSnapshot();
          return false;
        }
        if (result.commit === 'PRIVATE') {
          refreshSnapshot();
          onWaitingForSeat?.(remoteSeat);
        }
        return true;
      },
      refreshSnapshot,
      presentationStateForFrame:
        frame => adapter.presentationStateForFrame(frame),
      cardStatReadModel: token => adapter.cardStatReadModel(token),
      lanePowerReadModel: (lane, owner) =>
        adapter.lanePowerReadModel(lane, owner),
      recordFramePresentationTiming: (timing) => {
        adapter.recordFramePresentationTiming(timing);
        setPerformanceRevision(revision => revision + 1);
      },
    },
  };

  let uninstallDebug = (): void => undefined;
  if (
    debugEnabled
    && typeof window !== 'undefined'
  ) {
    void import('@/services/playgame/debug/installSnapDebug').then(
      ({ installSnapDebug }) => {
        if (!providerDisposed) {
          uninstallDebug = installSnapDebug(
            session.runtime,
            session.manifest,
            session.exportReplay,
          );
        }
      },
    );
  }
  onCleanup(() => {
    providerDisposed = true;
    transactionSubscribers.clear();
    unsubscribeAdapter();
    uninstallDebug();
  });

  return (
    <MatchSessionCtx.Provider value={value}>
      {props.children}
    </MatchSessionCtx.Provider>
  );
};

export const useMatchSession = (): MatchSessionContextValue => {
  const value = useContext(MatchSessionCtx);
  if (!value) {
    throw new Error(
      'useMatchSession must be used inside <MatchSessionProvider>',
    );
  }
  return value;
};

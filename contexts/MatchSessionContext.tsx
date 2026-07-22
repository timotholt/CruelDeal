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
import type { MatchContentCatalog } from '@/services/playgame/client/contentCatalog';
import type { MatchClient } from '@/services/playgame/client/matchClient';
import { continueAfterIntentPendingPaint } from '@/services/playgame/client/intentSubmission';
import { otherSeat, type LaneId, type Seat } from '@/services/playgame/engine/types/ids';
import type {
  FramePresentationTiming,
  MatchPerformanceProfile,
} from '@/services/playgame/runtime/performanceTelemetry';
import type {
  SeatCardStatReadModel,
  SeatLanePowerReadModel,
} from '@/services/playgame/runtime/seatReadModels';
import type {
  SeatBootstrap,
  SeatCardToken,
  SeatMatchSnapshot,
  SeatPresentationBlock,
  SeatTransactionFrame,
} from '@/services/playgame/runtime/projection';
import {
  applySeatPresentationBlock,
  overlaySeatPrivatePlan,
} from '@/services/playgame/runtime/projection';
import type { DebugReplayTimeline } from '@/services/playgame/debug/replayContracts';

export interface MatchSessionContextValue {
  readonly bootstrap: SeatBootstrap;
  readonly content: MatchContentCatalog;
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly snapshot: Accessor<SeatMatchSnapshot>;
  readonly intentActivity: Accessor<MatchIntentActivity>;
  readonly openingBlock: SeatPresentationBlock;
  readonly subscribePresentationBlocks: (
    subscriber: (block: SeatPresentationBlock) => void,
  ) => () => void;
  readonly debug: {
    readonly performanceProfile: Accessor<MatchPerformanceProfile>;
    readonly replay: Accessor<DebugReplayTimeline>;
  } | null;
  readonly actions: {
    stageCardInLane: (token: SeatCardToken, lane: LaneId) => Promise<boolean>;
    undoPending: () => Promise<boolean>;
    undoPendingCard: (token: SeatCardToken) => Promise<boolean>;
    endTurn: () => Promise<boolean>;
    refreshSnapshot: () => void;
    presentationStateForFrame: (
      frame: SeatTransactionFrame,
    ) => SeatTransactionFrame['after'];
    acknowledgePresentationBlock: (
      block: SeatPresentationBlock,
    ) => Promise<void>;
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

export type MatchIntentActivity =
  | {
      readonly kind: 'PROCESSING_INTENT';
      readonly intent: 'END_TURN';
    }
  | {
      readonly kind: 'WAITING_FOR_PLAYER';
      readonly intent: 'END_TURN';
      readonly seat: Seat;
    }
  | null;

const MatchSessionCtx = createContext<MatchSessionContextValue>();

export const MatchSessionProvider = (props: {
  readonly children: JSX.Element;
  readonly client: MatchClient;
}) => {
  const client = untrack(() => props.client);
  const initialization = client.initialization();
  const localSeat = client.bootstrap.viewerSeat;
  const remoteSeat = otherSeat(localSeat);
  const [snapshot, setSnapshot] = createSignal(initialization.setup, {
    equals: false,
  });
  const [intentActivity, setIntentActivity] =
    createSignal<MatchIntentActivity>(null);
  const [performanceRevision, setPerformanceRevision] = createSignal(0);
  const [replayRevision, setReplayRevision] = createSignal(0);
  let providerDisposed = false;
  const presentationBlockSubscribers = new Set<
    (block: SeatPresentationBlock) => void
  >();

  const refreshSnapshot = (): void => {
    if (providerDisposed) return;
    setSnapshot(client.snapshot());
    setReplayRevision(revision => revision + 1);
  };

  const unsubscribeClient = client.subscribePresentationBlocks(block =>
    untrack(() => {
      if (providerDisposed) return;
      batch(() => {
        setIntentActivity(null);
        const current = snapshot();
        const nextSnapshot = current.publicRevision === block.basePublicRevision
          ? applySeatPresentationBlock(current, block)
          : {
              version: 2 as const,
              matchId: block.matchId,
              publicRevision: block.publicRevision,
              planRevision: current.planRevision,
              frame: block.lastFrame,
              viewerSeat: block.viewerSeat,
              interactionStatus: block.postState.result === null
                ? 'PLANNING' as const
                : 'TERMINAL' as const,
              state: block.postState,
            };
        setSnapshot(nextSnapshot);
        setReplayRevision(revision => revision + 1);

        for (const subscriber of [...presentationBlockSubscribers]) {
          try {
            subscriber(block);
          } catch {
            // A presentation consumer cannot interrupt authoritative publication
            // or prevent the remaining consumers from observing the transaction.
          }
        }
      });
    }),
  );

  const subscribePresentationBlocks = (
    subscriber: (block: SeatPresentationBlock) => void,
  ): (() => void) => {
    if (providerDisposed) return () => undefined;
    presentationBlockSubscribers.add(subscriber);
    return () => presentationBlockSubscribers.delete(subscriber);
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
    bootstrap: client.bootstrap,
    content: client.content,
    localSeat,
    remoteSeat,
    snapshot,
    intentActivity,
    openingBlock: initialization.opening,
    subscribePresentationBlocks,
    debug: client.debug
      ? {
          replay: () => {
            void replayRevision();
            return client.debug!.replay();
          },
          performanceProfile: () => {
            void performanceRevision();
            return client.debug!.performanceProfile();
          },
        }
      : null,
    actions: {
      stageCardInLane: (token, lane) => accepted(client.stageCard(token, lane)),
      undoPending: () => accepted(client.undoLastStagedCard()),
      undoPendingCard: token => accepted(client.unstageCard(token)),
      endTurn: async () => {
        if (intentActivity() !== null) return false;
        setIntentActivity({ kind: 'PROCESSING_INTENT', intent: 'END_TURN' });
        await continueAfterIntentPendingPaint();
        if (providerDisposed) return false;
        let result: Awaited<ReturnType<MatchClient['endTurn']>>;
        try {
          result = await client.endTurn();
        } catch (error) {
          if (!providerDisposed) setIntentActivity(null);
          throw error;
        }
        if (providerDisposed || result.status !== 'accepted') {
          setIntentActivity(null);
          refreshSnapshot();
          return false;
        }
        if (
          (result.commit === 'PRIVATE' || result.commit === 'WAITING')
          && intentActivity()?.kind === 'PROCESSING_INTENT'
        ) {
          batch(() => {
            setIntentActivity({
              kind: 'WAITING_FOR_PLAYER',
              intent: 'END_TURN',
              seat: remoteSeat,
            });
            refreshSnapshot();
          });
        }
        return true;
      },
      refreshSnapshot,
      presentationStateForFrame:
        frame => overlaySeatPrivatePlan(
          frame.after,
          snapshot().state,
          localSeat,
        ),
      acknowledgePresentationBlock: async (block) => {
        await client.acknowledgePresentationBlock({
          version: 2,
          matchId: block.matchId,
          viewerSeat: block.viewerSeat,
          publicRevision: block.publicRevision,
          frame: block.lastFrame,
          postStateHash: block.postStateHash,
        });
      },
      cardStatReadModel: token => client.cardStatReadModel(token),
      lanePowerReadModel: (lane, owner) =>
        client.lanePowerReadModel(lane, owner),
      recordFramePresentationTiming: (timing) => {
        client.debug?.recordFramePresentationTiming(timing);
        setPerformanceRevision(revision => revision + 1);
      },
    },
  };

  let uninstallDebug = (): void => undefined;
  if (
    client.debug
    && typeof window !== 'undefined'
  ) {
    void client.debug?.installBrowserDebug?.().then((uninstall) => {
      if (providerDisposed) uninstall();
      else uninstallDebug = uninstall;
    });
  }
  onCleanup(() => {
    providerDisposed = true;
    presentationBlockSubscribers.clear();
    unsubscribeClient();
    uninstallDebug();
    client.dispose();
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

import type { LaneId, Seat } from '../engine/types/ids';
import type { FramePresentationTiming, MatchPerformanceProfile } from '../runtime/performanceTelemetry';
import type {
  SeatBootstrap,
  SeatCardToken,
  SeatMatchSnapshot,
  SeatTransactionFrame,
  SeatTransactionTimeline,
} from '../runtime/projection';
import type {
  SeatCardStatReadModel,
  SeatLanePowerReadModel,
} from '../runtime/seatReadModels';
import type { MatchContentCatalog } from './contentCatalog';
import type { DebugReplayTimeline } from '../debug/replayContracts';

export interface SeatMatchInitialization {
  readonly setup: SeatMatchSnapshot;
  readonly opening: SeatTransactionTimeline;
}

interface SeatCommandIdentity {
  readonly matchId: string;
  readonly seat: Seat;
  readonly intentId: string;
}

export type SeatCommandReceipt =
  | (SeatCommandIdentity & {
      readonly status: 'accepted';
      readonly revision: number;
      readonly commit: 'PRIVATE' | 'COMMITTED';
    })
  | (SeatCommandIdentity & {
      readonly status: 'illegal';
      readonly currentRevision: number;
      readonly code:
        | 'MATCH_MISMATCH'
        | 'SEAT_AUTHORITY'
        | 'TERMINAL_MATCH'
        | 'PHASE_INVALID'
        | 'RULES_INVALID';
      readonly message?: string;
    })
  | (SeatCommandIdentity & {
      readonly status: 'stale';
      readonly expectedRevision: number;
      readonly currentRevision: number;
    });

export type SeatCommandResult =
  | SeatCommandReceipt
  | (SeatCommandIdentity & {
      readonly status: 'duplicate';
      readonly original: SeatCommandReceipt;
    });

export interface MatchClientDebug {
  /** Canonical authority events, available only after developer authorization. */
  replay(): DebugReplayTimeline;
  performanceProfile(): MatchPerformanceProfile;
  recordFramePresentationTiming(timing: FramePresentationTiming): void;
  installBrowserDebug?(): Promise<() => void>;
}

/**
 * Complete player-facing match port. Implementations may be local or remote,
 * but consumers only receive projected snapshots and complete committed
 * presentation blocks.
 */
export interface MatchClient {
  readonly bootstrap: SeatBootstrap;
  readonly content: MatchContentCatalog;
  readonly debug: MatchClientDebug | null;

  initialization(): SeatMatchInitialization;
  snapshot(): SeatMatchSnapshot;
  subscribeCommittedTransactions(
    subscriber: (timeline: SeatTransactionTimeline) => void,
  ): () => void;
  stageCard(token: SeatCardToken, lane: LaneId): Promise<SeatCommandResult>;
  unstageCard(token: SeatCardToken): Promise<SeatCommandResult>;
  undoLastStagedCard(): Promise<SeatCommandResult>;
  endTurn(): Promise<SeatCommandResult>;
  presentationStateForFrame(
    frame: SeatTransactionFrame,
  ): SeatTransactionFrame['after'];
  cardStatReadModel(token: SeatCardToken): SeatCardStatReadModel | null;
  lanePowerReadModel(lane: LaneId, owner: Seat): SeatLanePowerReadModel | null;
  dispose(): void;
}

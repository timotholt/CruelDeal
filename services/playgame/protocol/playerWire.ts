import type { LaneId, Seat } from '../engine/types/ids';
import type { PlanRevision, PublicRevision } from '../runtime/contracts';
import type {
  SeatCardToken,
  SeatMatchSnapshot,
  SeatPresentationBlock,
} from '../runtime/projection';

export type SeatCommand =
  | {
      readonly type: 'STAGE_CARD';
      readonly token: SeatCardToken;
      readonly lane: LaneId;
    }
  | {
      readonly type: 'UNSTAGE_CARD';
      readonly token: SeatCardToken;
    }
  | { readonly type: 'UNDO_TURN' }
  | { readonly type: 'END_TURN' }
  | { readonly type: 'CONCEDE' };

export interface SeatCommandEnvelope {
  readonly version: 2;
  readonly matchId: string;
  readonly commandId: string;
  readonly expectedPublicRevision: PublicRevision;
  readonly expectedPlanRevision: PlanRevision;
  readonly command: SeatCommand;
}

export interface SeatBlockAck {
  readonly version: 2;
  readonly matchId: string;
  readonly viewerSeat: Seat;
  readonly publicRevision: PublicRevision;
  readonly frame: number;
  readonly postStateHash: string;
}

export interface SeatResyncRequest {
  readonly version: 2;
  readonly matchId: string;
  readonly viewerSeat: Seat;
  readonly publicRevision: PublicRevision;
  readonly planRevision: PlanRevision;
  readonly frame: number;
  readonly postStateHash: string | null;
}

export type SeatResyncResponse =
  | {
      readonly type: 'SNAPSHOT';
      readonly snapshot: SeatMatchSnapshot;
    }
  | {
      readonly type: 'PRESENTATION_BLOCK';
      readonly block: SeatPresentationBlock;
    };

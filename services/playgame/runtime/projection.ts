import type { MatchState } from '../engine/types/state';
import type { Seat } from '../engine/types/ids';
import type {
  CommittedTransactionRecord,
  MatchBootstrap,
  MatchEventFrame,
  MatchRevision,
} from './contracts';

const bootstrapPayload: unique symbol = Symbol('trusted projected bootstrap payload');
const statePayload: unique symbol = Symbol('trusted projected state payload');
const framePayload: unique symbol = Symbol('trusted projected frame payload');
const transactionPayload: unique symbol = Symbol('trusted projected transaction payload');

/** Explicit player-facing bootstrap type; canonical payload stays opaque. */
export interface ProjectedBootstrap {
  readonly kind: 'projected-bootstrap';
  readonly viewerSeat: Seat;
  readonly [bootstrapPayload]: MatchBootstrap;
}

/** Explicit player-facing state type; canonical state and log stay opaque. */
export interface ProjectedState {
  readonly kind: 'projected-state';
  readonly viewerSeat: Seat;
  readonly [statePayload]: MatchState;
}

interface TrustedProjectedTransactionPayload {
  readonly transaction: CommittedTransactionRecord;
  readonly frames: readonly MatchEventFrame[];
}

/** Explicit player-facing frame type; canonical event/state stay opaque. */
export interface SeatTransactionFrame {
  readonly kind: 'projected-transaction-frame';
  readonly viewerSeat: Seat;
  readonly transactionId: string;
  readonly index: number;
  readonly [framePayload]: MatchEventFrame;
}

/** Explicit player-facing transaction type; canonical events/frames stay opaque. */
export interface ProjectedTransaction {
  readonly kind: 'projected-transaction';
  readonly viewerSeat: Seat;
  readonly transactionId: string;
  readonly revision: MatchRevision;
  readonly frames: readonly SeatTransactionFrame[];
  readonly [transactionPayload]: TrustedProjectedTransactionPayload;
}

/** Plan-name compatibility while projected payload policy remains deferred. */
export type SeatBootstrap = ProjectedBootstrap;
export type SeatMatchState = ProjectedState;

/**
 * TRUSTED LOCAL PASS-THROUGH — the only projection implementation in CP1.
 * It performs no redaction. Hidden-information policy and serialization are
 * deferred; normal APIs still receive only the opaque ProjectedBootstrap type.
 */
export function projectBootstrapForTrustedLocalPlay(
  bootstrap: MatchBootstrap,
  viewerSeat: Seat = bootstrap.viewerSeat,
): ProjectedBootstrap {
  return {
    kind: 'projected-bootstrap',
    viewerSeat,
    [bootstrapPayload]: bootstrap,
  };
}

/** TRUSTED LOCAL PASS-THROUGH — performs no redaction and does not clone. */
export function projectStateForTrustedLocalPlay(
  state: MatchState,
  viewerSeat: Seat,
): ProjectedState {
  return {
    kind: 'projected-state',
    viewerSeat,
    [statePayload]: state,
  };
}

/**
 * TRUSTED LOCAL PASS-THROUGH — performs no event/state redaction and retains
 * the structurally shared frame references supplied by the caller.
 */
export function projectTransactionForTrustedLocalPlay(
  transaction: CommittedTransactionRecord,
  frames: readonly MatchEventFrame[],
  viewerSeat: Seat,
): ProjectedTransaction {
  const projectedFrames = frames.map((frame): SeatTransactionFrame => ({
    kind: 'projected-transaction-frame',
    viewerSeat,
    transactionId: frame.transactionId,
    index: frame.index,
    [framePayload]: frame,
  }));
  return {
    kind: 'projected-transaction',
    viewerSeat,
    transactionId: transaction.transactionId,
    revision: transaction.revision,
    frames: projectedFrames,
    [transactionPayload]: { transaction, frames },
  };
}

/** Explicit trusted/debug escape hatch; never expose through a player API. */
export function readTrustedLocalBootstrap(projected: ProjectedBootstrap): MatchBootstrap {
  return projected[bootstrapPayload];
}

/** Explicit trusted/debug escape hatch; never expose through a player API. */
export function readTrustedLocalState(projected: ProjectedState): MatchState {
  return projected[statePayload];
}

/** Explicit trusted/debug escape hatch; never expose through a player API. */
export function readTrustedLocalTransaction(
  projected: ProjectedTransaction,
): TrustedProjectedTransactionPayload {
  return projected[transactionPayload];
}

/** Explicit trusted/debug escape hatch; never expose through a player API. */
export function readTrustedLocalFrame(projected: SeatTransactionFrame): MatchEventFrame {
  return projected[framePayload];
}

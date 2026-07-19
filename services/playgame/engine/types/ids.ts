/**
 * Brand types for engine identifiers. See spec §3.1.
 *
 * Branded strings prevent accidental swaps between CardId and LocationCardInstanceId at
 * type-check time. Use `mkCardId(...)` etc. at the boundary; internal engine
 * code just passes them around as opaque.
 */

export type CardId = string & { readonly __brand: 'CardId' };
export type LocationCardInstanceId = string & {
  readonly __brand: 'LocationCardInstanceId';
};

export type Seat = 'P0' | 'P1';
export type Owner = Seat;
/**
 * Stable, match-local lane identity.
 *
 * A LaneId is allocated monotonically and is never reused. Its numeric value
 * is not the lane's current left-to-right position; position is derived from
 * MatchState.activeLaneOrder.
 */
export type LaneId = number;

export const otherSeat = (seat: Seat): Seat => (seat === 'P0' ? 'P1' : 'P0');

export const mkCardId = (s: string): CardId => s as CardId;
export const mkLocationCardInstanceId = (s: string): LocationCardInstanceId =>
  s as LocationCardInstanceId;
export const mkLaneId = (value: number): LaneId => value;

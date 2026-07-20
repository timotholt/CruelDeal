import type { LaneId, Seat } from '../engine/types/ids';
import type { SeatCardToken } from './projection';

export interface SeatPowerHistoryRow {
  readonly turn: number;
  readonly frame: number;
  readonly sourceLabel: string;
  readonly delta: number;
  readonly total: number;
}

export interface SeatCostHistoryRow {
  readonly turn: number;
  readonly frame: number;
  readonly sourceLabel: string;
  readonly delta: number;
  readonly total: number;
}

export interface SeatLiveModifierRow {
  readonly sourceLabel: string;
  readonly delta: number;
}

export interface SeatCardStatReadModel {
  readonly token: SeatCardToken;
  readonly name: string;
  readonly basePower: number | null;
  readonly effectivePower: number | null;
  readonly powerHistory: readonly SeatPowerHistoryRow[];
  readonly livePowerModifiers: readonly SeatLiveModifierRow[];
  readonly baseCost: number;
  readonly effectiveCost: number;
  readonly costHistory: readonly SeatCostHistoryRow[];
  readonly liveCostModifiers: readonly SeatLiveModifierRow[];
}

export interface SeatLaneCardPowerRow {
  readonly label: string;
  readonly basePower: number;
  readonly permanentDelta: number;
  readonly ongoingDelta: number;
  readonly finalPower: number;
}

export interface SeatLanePowerReadModel {
  readonly lane: LaneId;
  readonly owner: Seat;
  readonly cards: readonly SeatLaneCardPowerRow[];
  readonly cardSubtotal: number;
  readonly laneAdditions: readonly SeatLiveModifierRow[];
  readonly subtotalAfterAdditions: number;
  readonly multipliers: readonly {
    readonly sourceLabel: string;
    readonly factor: number;
  }[];
  readonly effectiveMultiplier: number;
  readonly total: number;
}

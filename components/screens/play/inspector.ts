import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';
import type { SeatLanePowerReadModel } from '@/services/playgame/runtime/seatReadModels';

export type InspectTarget =
  | {
      kind: 'card';
      card: ResolvedCard;
      zone: 'hand' | 'board';
      side: 'local' | 'remote' | 'top' | 'bottom';
      laneIdx?: number;
      element: HTMLElement;
    }
  | {
      kind: 'location';
      location: ResolvedLocation;
      laneIdx: number;
      bottomPower: number;
      topPower: number;
      bottomBreakdown: SeatLanePowerReadModel;
      topBreakdown: SeatLanePowerReadModel;
      element: HTMLElement;
    };

import type { JSX } from 'solid-js';
import type { SeatLanePowerReadModel } from '@/services/playgame/runtime/seatReadModels';
import type { LaneId, Seat } from '@/services/playgame/engine/types/ids';
import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';
import { LaneSlots } from './LaneSlots';
import { LocationTile } from './LocationTile';

interface LaneColumnProps {
  laneId: LaneId;
  order: number;
  activeLaneCount: number;
  location: ResolvedLocation;
  topCards: ResolvedCard[];
  bottomCards: ResolvedCard[];
  topPower: number;
  bottomPower: number;
  topBreakdown: SeatLanePowerReadModel;
  bottomBreakdown: SeatLanePowerReadModel;
  interactive: boolean;
  inspectable: boolean;
  viewerSeat: Seat;
  stagedCardIds: readonly string[];
  resolutionLocked: boolean;
}

export const laneCenterPercent = (order: number, activeLaneCount: number): number => {
  const count = Math.min(3, Math.max(1, Math.trunc(activeLaneCount)));
  const safeOrder = Math.min(count - 1, Math.max(0, Math.trunc(order)));
  return ((safeOrder + 0.5) / count) * 100;
};

/**
 * Stable vertical lane ownership boundary.
 *
 * Its width and height never depend on active-lane count. Only `--lane-order`
 * and `--active-lane-count` change, allowing CSS to slide the same keyed lane
 * DOM node horizontally when lanes are added or removed.
 */
export const LaneColumn = (props: LaneColumnProps) => {
  const mapStyle = (): JSX.CSSProperties => ({
    'background-image': props.location.mapArt ? `url("${props.location.mapArt}")` : 'none',
  });

  return (
    <section
      class="lane-column"
      data-lane-column
      data-lane={props.laneId}
      style={{
        '--lane-order': props.order,
        '--lane-center': `${laneCenterPercent(props.order, props.activeLaneCount)}%`,
      }}
    >
      <div
        class="lane-map"
        data-lane={props.laneId}
        data-revealed={String(props.location.revealed)}
        style={mapStyle()}
        aria-hidden="true"
      />
      <LaneSlots
        side="top"
        laneIdx={props.laneId}
        cards={props.topCards}
        interactive={props.interactive}
        inspectable={props.inspectable}
        viewerSeat={props.viewerSeat}
        stagedCardIds={props.stagedCardIds}
        resolutionLocked={props.resolutionLocked}
      />
      <LocationTile
        location={props.location}
        laneIdx={props.laneId}
        bottomPower={props.bottomPower}
        topPower={props.topPower}
        bottomBreakdown={props.bottomBreakdown}
        topBreakdown={props.topBreakdown}
        interactive={props.inspectable}
      />
      <LaneSlots
        side="bottom"
        laneIdx={props.laneId}
        cards={props.bottomCards}
        interactive={props.interactive}
        inspectable={props.inspectable}
        viewerSeat={props.viewerSeat}
        stagedCardIds={props.stagedCardIds}
        resolutionLocked={props.resolutionLocked}
      />
    </section>
  );
};

import { For, Show } from 'solid-js';
import type { LaneId, Seat } from '@/services/playgame/engine/types/ids';
import type { SeatLanePowerReadModel } from '@/services/playgame/runtime/seatReadModels';
import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';
import { LaneColumn } from './LaneColumn';

interface LaneGridProps {
  readonly laneIds: readonly LaneId[];
  readonly location: (lane: LaneId) => ResolvedLocation;
  readonly topCards: (lane: LaneId) => ResolvedCard[];
  readonly bottomCards: (lane: LaneId) => ResolvedCard[];
  readonly topPower: (lane: LaneId) => number;
  readonly bottomPower: (lane: LaneId) => number;
  readonly topBreakdown: (lane: LaneId) => SeatLanePowerReadModel;
  readonly bottomBreakdown: (lane: LaneId) => SeatLanePowerReadModel;
  readonly interactive: boolean;
  readonly inspectable: boolean;
  readonly viewerSeat: Seat;
  readonly stagedCardIds: readonly string[];
  readonly resolutionLocked: boolean;
  readonly replayAvailable: boolean;
  readonly replayOpen: boolean;
  readonly onToggleReplay: () => void;
  readonly stageRef: (element: HTMLElement) => void;
  readonly bindMapRef: (lane: LaneId) => (element: HTMLElement) => void;
  readonly bindLocationRef: (lane: LaneId) => (element: HTMLElement) => void;
}

/**
 * Stable keyed lane owner. The keyed values remain primitive lane IDs so
 * projection changes update descendants without remounting lane/card DOM.
 */
export const LaneGrid = (props: LaneGridProps) => (
  <main class="board-stage board-game-area" ref={props.stageRef}>
    <Show when={props.replayAvailable}>
      <button
        class="replay-toggle replay-float-toggle"
        type="button"
        onClick={() => props.onToggleReplay()}
      >
        {props.replayOpen ? 'Hide Replay' : 'Replay'}
      </button>
    </Show>

    <div class="lane-track" data-active-lane-count={props.laneIds.length}>
      <For each={props.laneIds}>
        {(laneId, order) => (
          <LaneColumn
            laneId={laneId}
            order={order()}
            activeLaneCount={props.laneIds.length}
            location={props.location(laneId)}
            topCards={props.topCards(laneId)}
            bottomCards={props.bottomCards(laneId)}
            topPower={props.topPower(laneId)}
            bottomPower={props.bottomPower(laneId)}
            topBreakdown={props.topBreakdown(laneId)}
            bottomBreakdown={props.bottomBreakdown(laneId)}
            interactive={props.interactive}
            inspectable={props.inspectable}
            viewerSeat={props.viewerSeat}
            stagedCardIds={props.stagedCardIds}
            resolutionLocked={props.resolutionLocked}
            mapRef={props.bindMapRef(laneId)}
            locationRef={props.bindLocationRef(laneId)}
          />
        )}
      </For>
    </div>
  </main>
);

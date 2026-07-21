/**
 * LocationTile — one of the three strips in the locations row.
 *
 * Renders face-down ("???") until the reveal cinematic flips it. Clicking
 * any state opens the zoom inspector.
 */

import type { ResolvedLocation } from '@/services/playgame/view';
import type { SeatLanePowerReadModel } from '@/services/playgame/runtime/seatReadModels';
import { usePlayUi } from '@/contexts/PlayUiContext';

interface LocationTileProps {
  location: ResolvedLocation;
  laneIdx: number;
  bottomPower: number;
  topPower: number;
  bottomBreakdown: SeatLanePowerReadModel;
  topBreakdown: SeatLanePowerReadModel;
  interactive?: boolean;
  elementRef?: (element: HTMLElement) => void;
}

export const LocationTile = (props: LocationTileProps) => {
  const { actions } = usePlayUi();
  const onClick = (e: MouseEvent): void => {
    if (props.interactive === false) return;
    e.stopPropagation();
    actions.openInspector({
      kind: 'location',
      location: props.location,
      laneIdx: props.laneIdx,
      bottomPower: props.bottomPower,
      topPower: props.topPower,
      bottomBreakdown: props.bottomBreakdown,
      topBreakdown: props.topBreakdown,
      element: e.currentTarget as HTMLElement,
    });
  };
  return (
    <div
      ref={(element) => props.elementRef?.(element)}
      class={'location' + (props.location.revealed ? '' : ' location--hidden')}
      data-lane={props.laneIdx}
      onClick={onClick}
      style={{ cursor: props.interactive === false ? 'default' : 'pointer' }}
    >
      <div class="lane-score enemy-score">{props.topPower}</div>
      <div class="loc-name">{props.location.revealed ? props.location.name : '???'}</div>
      <div class="loc-desc">{props.location.revealed ? props.location.desc : ''}</div>
      <div class="lane-score player-score">{props.bottomPower}</div>
    </div>
  );
};

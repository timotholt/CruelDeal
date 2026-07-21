import type { JSX } from 'solid-js';

import type { LaneId } from '@/services/playgame/engine/types/ids';
import type { ResolvedLocation } from '@/services/playgame/view';

interface LaneMapProps {
  readonly laneId: LaneId;
  readonly location: ResolvedLocation;
  readonly elementRef?: (element: HTMLDivElement) => void;
}

/** Declarative map artwork owned by the same stable DOM node as its lane. */
export const LaneMap = (props: LaneMapProps): JSX.Element => (
  <div
    ref={(element) => props.elementRef?.(element)}
    class="lane-map"
    data-lane={props.laneId}
    data-revealed={String(props.location.revealed)}
    style={{
      'background-image': props.location.mapArt
        ? `url("${props.location.mapArt}")`
        : 'none',
    }}
    aria-hidden="true"
  />
);

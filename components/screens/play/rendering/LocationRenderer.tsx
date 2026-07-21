import type { LaneVisualModel } from '@/components/game-surfaces/contracts';
import { LocationSurface } from '@/components/game-surfaces/location/LocationSurface';

interface LocationRendererProps {
  readonly model: LaneVisualModel;
}

/** Lane composition owns scores; LocationSurface owns only location pixels. */
export const LocationRenderer = (props: LocationRendererProps) => {
  return (
    <svg
      class="lane-surface-composition"
      viewBox="0 0 700 525"
      preserveAspectRatio="none"
      overflow="visible"
    >
      <foreignObject x="0" y="0" width="700" height="525" overflow="visible">
        <div class="lane-surface__canvas">
          <LocationSurface model={props.model.location} />
          <div class="lane-score enemy-score" data-lane-score="top">{props.model.topScore.value}</div>
          <div class="lane-score player-score" data-lane-score="bottom">{props.model.bottomScore.value}</div>
        </div>
      </foreignObject>
    </svg>
  );
};

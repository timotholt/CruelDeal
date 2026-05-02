import { Show } from 'solid-js';
import type { DistrictLandmark } from '@/services/playgame/city-map';
import { placeVenueTooltip, type Size, type VenueTooltipLayout } from './useCityMapHover';

export interface LandmarkTooltipProps {
  landmark: DistrictLandmark | null;
  board: Size;
  layout?: VenueTooltipLayout;
}

export const LandmarkTooltip = (props: LandmarkTooltipProps) => {
  const layout = () => props.landmark
    ? props.layout ?? placeVenueTooltip(props.landmark.centroid, props.board)
    : null;

  return (
    <Show when={props.landmark && layout()}>
      {(placed) => {
        const landmark = () => props.landmark as DistrictLandmark;
        const icon = () => landmark().iconKey.slice(0, 2).toUpperCase();

        return (
          <>
            <svg
              class="venue-tooltip-link"
              viewBox={`0 0 ${props.board.width} ${props.board.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1={placed().connectorStart.x}
                y1={placed().connectorStart.y}
                x2={placed().connectorEnd.x}
                y2={placed().connectorEnd.y}
              />
            </svg>
            <div
              class="venue-tooltip venue-tooltip--landmark"
              style={{
                left: `${(placed().x / props.board.width) * 100}%`,
                top: `${(placed().y / props.board.height) * 100}%`,
                width: `${(placed().width / props.board.width) * 100}%`,
                height: `${(placed().height / props.board.height) * 100}%`,
              }}
              role="status"
              aria-live="polite"
            >
              <div class="venue-tooltip__icon" aria-hidden="true">{icon()}</div>
              <div class="venue-tooltip__body">
                <div class="venue-tooltip__name">{landmark().name}</div>
                <div class="venue-tooltip__bonus">{landmark().effectPlaceholder}</div>
              </div>
            </div>
          </>
        );
      }}
    </Show>
  );
};

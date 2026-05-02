import { Show } from 'solid-js';
import type { DistrictLandmark } from '@/services/playgame/city-map';
import { placeVenueTooltip, type Size, type VenueTooltipLayout } from './useCityMapHover';
import type { CityMapViewport } from './camera';

export interface LandmarkTooltipProps {
  landmark: DistrictLandmark | null;
  board: Size;
  viewport?: CityMapViewport;
  layout?: VenueTooltipLayout;
}

export const LandmarkTooltip = (props: LandmarkTooltipProps) => {
  const viewport = () => props.viewport || { x: 0, y: 0, width: props.board.width, height: props.board.height };
  const visibleBoard = () => ({ width: viewport().width, height: viewport().height });
  const localAnchor = () => props.landmark
    ? { x: props.landmark.centroid.x - viewport().x, y: props.landmark.centroid.y - viewport().y }
    : null;
  const layout = () => props.landmark
    ? props.layout ?? placeVenueTooltip(localAnchor()!, visibleBoard())
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
              viewBox={`${viewport().x} ${viewport().y} ${viewport().width} ${viewport().height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1={viewport().x + placed().connectorStart.x}
                y1={viewport().y + placed().connectorStart.y}
                x2={landmark().centroid.x}
                y2={landmark().centroid.y}
              />
            </svg>
            <div
              class="venue-tooltip venue-tooltip--landmark"
              style={{
                left: `${(placed().x / viewport().width) * 100}%`,
                top: `${(placed().y / viewport().height) * 100}%`,
                width: `${(placed().width / viewport().width) * 100}%`,
                height: `${(placed().height / viewport().height) * 100}%`,
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

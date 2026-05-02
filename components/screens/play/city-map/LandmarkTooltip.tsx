import { Show } from 'solid-js';
import type { DistrictLandmark } from '@/services/playgame/city-map';
import { placeVenueTooltip, type Size, type VenueTooltipLayout } from './useCityMapHover';
import type { CityMapViewport } from './camera';

export interface LandmarkTooltipProps {
  landmark: DistrictLandmark | null;
  board: Size;
  screenSize?: Size;
  viewport?: CityMapViewport;
  layout?: VenueTooltipLayout;
}

export const LandmarkTooltip = (props: LandmarkTooltipProps) => {
  const viewport = () => props.viewport || { x: 0, y: 0, width: props.board.width, height: props.board.height };
  const screen = () => props.screenSize || props.board;
  const screenAnchor = () => props.landmark
    ? {
      x: ((props.landmark.centroid.x - viewport().x) / viewport().width) * screen().width,
      y: ((props.landmark.centroid.y - viewport().y) / viewport().height) * screen().height,
    }
    : null;
  const layout = () => props.landmark
    ? props.layout ?? placeVenueTooltip(screenAnchor()!, screen())
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
              viewBox={`0 0 ${screen().width} ${screen().height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1={placed().connectorStart.x}
                y1={placed().connectorStart.y}
                x2={screenAnchor()!.x}
                y2={screenAnchor()!.y}
              />
            </svg>
            <div
              class="venue-tooltip venue-tooltip--landmark"
              style={{
                left: `${placed().x}px`,
                top: `${placed().y}px`,
                width: `${placed().width}px`,
                height: `${placed().height}px`,
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

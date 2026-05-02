import { Show } from 'solid-js';
import type { CitySlot } from '@/services/playgame/city-map';
import type { CityMapViewport } from './camera';
import { CityMapSvg } from './CityMapSvg';
import { CityMapLandmarks } from './CityMapLandmarks';
import { CityMapSlots } from './CityMapSlots';
import { CompositionDebugOverlay } from './CompositionDebugOverlay';
import { RouteDemoLayer } from './RouteDemoLayer';
import type { CityMapDebugState } from './CityMapDebugDock';
import type { CityMapRenderModel } from './render-model';

export interface CityMapSvgRendererProps {
  model: CityMapRenderModel;
  viewport: CityMapViewport;
  debugState: CityMapDebugState;
  interactive: boolean;
  hoveredDistrictId?: string | null;
  hoveredLandmarkId?: string | null;
  selectedSlotId?: string | null;
  onSlotClick?: (slot: CitySlot) => void;
}

export const CityMapSvgRenderer = (props: CityMapSvgRendererProps) => {
  const viewBox = () => `${props.viewport.x} ${props.viewport.y} ${props.viewport.width} ${props.viewport.height}`;

  return (
    <>
      <Show when={props.debugState.showMap}>
        <CityMapSvg
          city={props.model.city}
          width={props.model.world.width}
          height={props.model.world.height}
          viewport={props.viewport}
          hoveredDistrictId={props.hoveredDistrictId}
          debug={{
            showLabels: props.debugState.showLabels,
            showBuildings: props.debugState.showBuildings,
            showRoads: props.debugState.showRoads,
            showSlots: false,
          }}
        />
      </Show>
      <RouteDemoLayer
        city={props.model.city}
        active={props.debugState.showRouteDemo}
        width={props.model.world.width}
        height={props.model.world.height}
        viewport={props.viewport}
      />
      <Show when={props.debugState.showComposition}>
        <CompositionDebugOverlay
          city={props.model.city}
          width={props.model.world.width}
          height={props.model.world.height}
          viewport={props.viewport}
        />
      </Show>
      <svg
        class="city-map-board__slot-layer"
        viewBox={viewBox()}
        preserveAspectRatio="none"
        aria-hidden={!props.interactive}
      >
        <Show when={props.debugState.showLandmarks}>
          <CityMapLandmarks landmarks={props.model.landmarks} hoveredLandmarkId={props.hoveredLandmarkId} />
        </Show>
        <Show when={props.debugState.showSlots}>
          <CityMapSlots
            slots={props.model.slots}
            selectedSlotId={props.selectedSlotId}
            interactive={props.interactive}
            onSlotClick={(slot) => props.onSlotClick?.(slot)}
          />
        </Show>
      </svg>
    </>
  );
};


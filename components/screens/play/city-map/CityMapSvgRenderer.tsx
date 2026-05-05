import { Show } from 'solid-js';
import type { CitySlot } from '@/services/playgame/city-map';
import type { CityMapViewport, Size } from './camera';
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
  surfaceSize: Size;
  debugState: CityMapDebugState;
  cameraMotion: 'idle' | 'pan' | 'zoom';
  interactive: boolean;
  hoveredDistrictId?: string | null;
  hoveredLandmarkId?: string | null;
  selectedSlotId?: string | null;
  onSlotClick?: (slot: CitySlot) => void;
}

export const CityMapSvgRenderer = (props: CityMapSvgRendererProps) => {
  const fullViewBox = () => `0 0 ${props.model.world.width} ${props.model.world.height}`;
  const worldTransform = () => {
    const scaleX = props.model.world.width / Math.max(0.001, props.viewport.width);
    const scaleY = props.model.world.height / Math.max(0.001, props.viewport.height);
    const tx = (-props.viewport.x / Math.max(0.001, props.viewport.width)) * props.surfaceSize.width;
    const ty = (-props.viewport.y / Math.max(0.001, props.viewport.height)) * props.surfaceSize.height;
    return `matrix(${scaleX}, 0, 0, ${scaleY}, ${tx}, ${ty})`;
  };
  const simplifyForCameraMove = () => props.debugState.simplifyDuringCameraMove && props.cameraMotion !== 'idle';
  const simplifyForZoom = () => props.debugState.simplifyDuringCameraMove && props.cameraMotion === 'zoom';

  return (
    <div
      classList={{
        'city-map-world-layer': true,
        'city-map-world-layer--camera-simplified': simplifyForCameraMove(),
        'city-map-world-layer--zoom-simplified': simplifyForZoom(),
      }}
      style={{ transform: worldTransform() }}
    >
      <Show when={props.debugState.showMap}>
        <CityMapSvg
          city={props.model.city}
          width={props.model.world.width}
          height={props.model.world.height}
          hoveredDistrictId={props.hoveredDistrictId}
          debug={{
            showLabels: props.debugState.showLabels && !simplifyForCameraMove(),
            showBuildings: props.debugState.showBuildings && !simplifyForCameraMove(),
            showRoads: props.debugState.showRoads && !simplifyForZoom(),
            showRoadCorridors: props.debugState.showRoadCorridors && !simplifyForZoom(),
            showSlots: false,
          }}
        />
      </Show>
      <RouteDemoLayer
        city={props.model.city}
        active={props.debugState.showRouteDemo && !simplifyForZoom()}
        width={props.model.world.width}
        height={props.model.world.height}
      />
      <Show when={props.debugState.showComposition && !simplifyForZoom()}>
        <CompositionDebugOverlay
          city={props.model.city}
          width={props.model.world.width}
          height={props.model.world.height}
        />
      </Show>
      <svg
        class="city-map-board__slot-layer"
        viewBox={fullViewBox()}
        preserveAspectRatio="none"
        aria-hidden={!props.interactive}
      >
        <Show when={props.debugState.showLandmarks && !simplifyForZoom()}>
          <CityMapLandmarks landmarks={props.model.landmarks} hoveredLandmarkId={props.hoveredLandmarkId} />
        </Show>
        <Show when={props.debugState.showSlots && !simplifyForZoom()}>
          <CityMapSlots
            slots={props.model.slots}
            selectedSlotId={props.selectedSlotId}
            interactive={props.interactive}
            onSlotClick={(slot) => props.onSlotClick?.(slot)}
          />
        </Show>
      </svg>
    </div>
  );
};

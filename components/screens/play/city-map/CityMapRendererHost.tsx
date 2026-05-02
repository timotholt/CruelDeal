import type { CitySlot } from '@/services/playgame/city-map';
import type { CityMapViewport, Size } from './camera';
import type { CityMapDebugState } from './CityMapDebugDock';
import { CityMapSvgRenderer } from './CityMapSvgRenderer';
import type { CityMapRenderModel, CityMapRendererMode } from './render-model';

export interface CityMapRendererHostProps {
  mode: CityMapRendererMode;
  model: CityMapRenderModel;
  viewport: CityMapViewport;
  surfaceSize: Size;
  debugState: CityMapDebugState;
  interactive: boolean;
  hoveredDistrictId?: string | null;
  hoveredLandmarkId?: string | null;
  selectedSlotId?: string | null;
  onSlotClick?: (slot: CitySlot) => void;
}

export const CityMapRendererHost = (props: CityMapRendererHostProps) => {
  // Phase 2 only creates the renderer seam. Three mode intentionally falls
  // through to SVG until the Three renderer exists behind this host.
  return (
    <>
      {props.mode === 'three'
        ? (
          <CityMapSvgRenderer
            model={props.model}
            viewport={props.viewport}
            surfaceSize={props.surfaceSize}
            debugState={props.debugState}
            interactive={props.interactive}
            hoveredDistrictId={props.hoveredDistrictId}
            hoveredLandmarkId={props.hoveredLandmarkId}
            selectedSlotId={props.selectedSlotId}
            onSlotClick={props.onSlotClick}
          />
        )
        : (
          <CityMapSvgRenderer
            model={props.model}
            viewport={props.viewport}
            surfaceSize={props.surfaceSize}
            debugState={props.debugState}
            interactive={props.interactive}
            hoveredDistrictId={props.hoveredDistrictId}
            hoveredLandmarkId={props.hoveredLandmarkId}
            selectedSlotId={props.selectedSlotId}
            onSlotClick={props.onSlotClick}
          />
        )}
    </>
  );
};

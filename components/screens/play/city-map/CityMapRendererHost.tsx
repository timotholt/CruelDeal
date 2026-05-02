import { lazy, Suspense } from 'solid-js';
import type { CitySlot } from '@/services/playgame/city-map';
import type { CityMapViewport, Size } from './camera';
import type { CityMapDebugState } from './CityMapDebugDock';
import { CityMapSvgRenderer } from './CityMapSvgRenderer';
import type { CityMapRenderModel, CityMapRendererMode } from './render-model';

const CityMapThreeRenderer = lazy(async () => {
  const module = await import('./three/CityMapThreeRenderer');
  return { default: module.CityMapThreeRenderer };
});

export interface CityMapRendererHostProps {
  mode: CityMapRendererMode;
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

export const CityMapRendererHost = (props: CityMapRendererHostProps) => {
  return (
    <>
      {props.mode === 'three'
        ? (
          <Suspense fallback={null}>
            <CityMapThreeRenderer
              model={props.model}
              viewport={props.viewport}
              surfaceSize={props.surfaceSize}
            />
          </Suspense>
        )
        : (
          <CityMapSvgRenderer
            model={props.model}
            viewport={props.viewport}
            surfaceSize={props.surfaceSize}
            debugState={props.debugState}
            cameraMotion={props.cameraMotion}
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

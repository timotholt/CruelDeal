import { Show, createMemo, createSignal, untrack } from 'solid-js';
import { buildCityMap, type CityDistrict, type CityMap, type Point } from '@/services/playgame/city-map';
import { pointInPolygon } from '@/services/playgame/city-map/geometry';
import { CityMapSvg } from './CityMapSvg';
import { CityMapLandmarks } from './CityMapLandmarks';
import { CityMapSlots } from './CityMapSlots';
import { LandmarkTooltip } from './LandmarkTooltip';
import { useCityMapLandmarkHover } from './useCityMapHover';
import { useCityMapHighlight } from './useCityMapHighlight';
import { CityMapDebugDock, type CityMapDebugState } from './CityMapDebugDock';
import { RouteDemoLayer } from './RouteDemoLayer';
import { CompositionDebugOverlay } from './CompositionDebugOverlay';
import './cityMapStyles.css';

export interface CityMapBoardProps {
  seed?: string | number;
  city?: CityMap;
  width?: number;
  height?: number;
  interactive?: boolean;
  showVenueTooltips?: boolean;
  debug?: {
    showLabels?: boolean;
    showBuildings?: boolean;
    showRoads?: boolean;
    showLandmarks?: boolean;
    showSlots?: boolean;
  };
}

export const CityMapBoard = (props: CityMapBoardProps) => {
  const [selectedSlotId, setSelectedSlotId] = createSignal<string | null>(null);
  const initialDebug = untrack(() => props.debug);
  const [debugState, setDebugState] = createSignal<CityMapDebugState>({
    showMap: true,
    showBuildings: initialDebug?.showBuildings ?? true,
    showRoads: initialDebug?.showRoads ?? true,
    showLabels: initialDebug?.showLabels ?? true,
    showLandmarks: initialDebug?.showLandmarks ?? true,
    showSlots: initialDebug?.showSlots ?? true,
    showRouteDemo: false,
    showComposition: false,
    showTerrainDebug: false,
    showDistrictDebug: false,
    showArterialsDebug: false,
    showIslandDebug: false,
    showMassDebug: false,
    showSeedDebug: false,
  });
  const city = createMemo(() => props.city || buildCityMap(props.seed ?? 'new-game-city'));
  const width = () => props.width || city().width;
  const height = () => props.height || city().height;
  const slots = createMemo(() => city().districts.flatMap((district) => district.slots || []));
  const landmarks = createMemo(() => city().landmarks || city().districts.flatMap((district) => district.landmarks || []));
  const interactive = () => props.interactive ?? true;
  const highlight = useCityMapHighlight({ mode: () => 'hover' });
  const hover = useCityMapLandmarkHover({
    landmarks,
    board: () => ({ width: width(), height: height() }),
    enabled: () => interactive() && debugState().showLandmarks && (props.showVenueTooltips ?? true),
  });
  const districtAtPoint = (point: Point) => {
    for (const district of city().districts as Array<CityDistrict & { playable?: boolean }>) {
      if (district.playable === false) continue;
      const polygons = district.ownershipPolygons?.length ? district.ownershipPolygons : district.polygons;
      if (polygons.some((polygon) => pointInPolygon(point, polygon))) return district.id;
    }
    return null;
  };
  const boardPointFromPointer = (event: PointerEvent & { currentTarget: Element }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * width() : 0,
      y: rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * height() : 0,
    };
  };
  const onPointerMove = (event: PointerEvent & { currentTarget: Element }) => {
    hover.bind.onPointerMove(event);
    highlight.onDistrictHover(interactive() ? districtAtPoint(boardPointFromPointer(event)) : null);
  };
  const clearHover = () => {
    hover.clearHover();
    highlight.onDistrictHover(null);
  };
  const toggleDebug = (key: keyof CityMapDebugState) => {
    setDebugState((state) => ({ ...state, [key]: !state[key] }));
  };

  return (
    <section class="city-map-board" aria-label="City map board">
      <div
        class="city-map-board__surface"
        onPointerMove={onPointerMove}
        onPointerLeave={clearHover}
        onPointerCancel={clearHover}
      >
        <Show when={debugState().showMap}>
          <CityMapSvg
            city={city()}
            width={width()}
            height={height()}
            hoveredDistrictId={highlight.hoveredDistrictId()}
            debug={{
              showLabels: debugState().showLabels,
              showBuildings: debugState().showBuildings,
              showRoads: debugState().showRoads,
              showSlots: false,
            }}
          />
        </Show>
        <RouteDemoLayer city={city()} active={debugState().showRouteDemo} width={width()} height={height()} />
        <Show when={debugState().showComposition}>
          <CompositionDebugOverlay city={city()} width={width()} height={height()} />
        </Show>
        <svg
          class="city-map-board__slot-layer"
          viewBox={`0 0 ${width()} ${height()}`}
          preserveAspectRatio="none"
          aria-hidden={!interactive()}
        >
          <Show when={debugState().showLandmarks}>
            <CityMapLandmarks landmarks={landmarks()} hoveredLandmarkId={hover.hoveredLandmarkId()} />
          </Show>
          <Show when={debugState().showSlots}>
            <CityMapSlots
              slots={slots()}
              selectedSlotId={selectedSlotId()}
              interactive={interactive()}
              onSlotClick={(slot) => setSelectedSlotId(slot.id)}
            />
          </Show>
        </svg>
        <LandmarkTooltip
          landmark={hover.hoveredLandmark()}
          board={{ width: width(), height: height() }}
        />
        <CityMapDebugDock state={debugState()} onToggle={toggleDebug} />
      </div>
    </section>
  );
};

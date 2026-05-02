import { Show, createMemo, createSignal, onCleanup, onMount, untrack } from 'solid-js';
import { buildCityMap, type CityDistrict, type CityMap, type Point } from '@/services/playgame/city-map';
import { pointInPolygon } from '@/services/playgame/city-map/geometry';
import {
  cameraToViewport,
  clampCamera,
  createInitialCityMapCamera,
  normalizedPointFromClient,
  panCameraByScreenDelta,
  screenToWorld,
  zoomCameraAt,
  type CityMapCameraState,
} from './camera';
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
  const worldSize = () => ({ width: width(), height: height() });
  const [surfaceAspect, setSurfaceAspect] = createSignal(width() / height());
  const [camera, setCamera] = createSignal<CityMapCameraState>(createInitialCityMapCamera(worldSize()));
  const viewport = createMemo(() => cameraToViewport(camera(), worldSize(), surfaceAspect()));
  const slots = createMemo(() => city().districts.flatMap((district) => district.slots || []));
  const landmarks = createMemo(() => city().landmarks || city().districts.flatMap((district) => district.landmarks || []));
  const interactive = () => props.interactive ?? true;
  const highlight = useCityMapHighlight({ mode: () => 'hover' });
  const hover = useCityMapLandmarkHover({
    landmarks,
    board: () => ({ width: width(), height: height() }),
    viewport,
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
    return screenToWorld({ x: event.clientX, y: event.clientY }, rect, viewport());
  };
  let surfaceEl: HTMLDivElement | undefined;
  let panDrag: { pointerId: number; lastX: number; lastY: number; moved: boolean } | null = null;
  let suppressNextClick = false;

  onMount(() => {
    if (!surfaceEl) return;
    const updateAspect = () => {
      const rect = surfaceEl!.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nextAspect = rect.width / rect.height;
        setSurfaceAspect(nextAspect);
        setCamera((current) => clampCamera(current, worldSize(), nextAspect));
      }
    };
    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(surfaceEl);
    onCleanup(() => observer.disconnect());
  });

  const isControlTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest('.city-map-debug-dock');
  const onWheel = (event: WheelEvent & { currentTarget: Element }) => {
    if (!interactive() || isControlTarget(event.target)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorWorld = screenToWorld({ x: event.clientX, y: event.clientY }, rect, viewport());
    const anchorScreen = normalizedPointFromClient({ x: event.clientX, y: event.clientY }, rect);
    const zoomFactor = Math.exp(-event.deltaY * 0.0018);
    setCamera((current) => zoomCameraAt(current, anchorWorld, anchorScreen, current.zoom * zoomFactor, worldSize(), surfaceAspect()));
  };
  const onPointerDown = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (!interactive() || isControlTarget(event.target) || event.button !== 0) return;
    panDrag = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent & { currentTarget: Element }) => {
    if (panDrag?.pointerId === event.pointerId) {
      const dx = event.clientX - panDrag.lastX;
      const dy = event.clientY - panDrag.lastY;
      if (Math.hypot(dx, dy) > 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        setCamera((current) => panCameraByScreenDelta(current, { x: dx, y: dy }, rect, viewport(), worldSize(), surfaceAspect()));
        panDrag.lastX = event.clientX;
        panDrag.lastY = event.clientY;
        panDrag.moved = panDrag.moved || Math.hypot(dx, dy) > 3;
      }
    }
    hover.bind.onPointerMove(event);
    highlight.onDistrictHover(interactive() ? districtAtPoint(boardPointFromPointer(event)) : null);
  };
  const onPointerUp = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (panDrag?.pointerId !== event.pointerId) return;
    if (panDrag.moved) {
      suppressNextClick = true;
      window.setTimeout(() => {
        suppressNextClick = false;
      }, 0);
    }
    panDrag = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const clearHover = () => {
    panDrag = null;
    hover.clearHover();
    highlight.onDistrictHover(null);
  };
  const onClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const toggleDebug = (key: keyof CityMapDebugState) => {
    setDebugState((state) => ({ ...state, [key]: !state[key] }));
  };

  return (
    <section class="city-map-board" aria-label="City map board">
      <div
        ref={(el) => {
          surfaceEl = el;
        }}
        class="city-map-board__surface"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={clearHover}
        onPointerCancel={clearHover}
        onClickCapture={onClickCapture}
      >
        <Show when={debugState().showMap}>
          <CityMapSvg
            city={city()}
            width={width()}
            height={height()}
            viewport={viewport()}
            hoveredDistrictId={highlight.hoveredDistrictId()}
            debug={{
              showLabels: debugState().showLabels,
              showBuildings: debugState().showBuildings,
              showRoads: debugState().showRoads,
              showSlots: false,
            }}
          />
        </Show>
        <RouteDemoLayer city={city()} active={debugState().showRouteDemo} width={width()} height={height()} viewport={viewport()} />
        <Show when={debugState().showComposition}>
          <CompositionDebugOverlay city={city()} width={width()} height={height()} viewport={viewport()} />
        </Show>
        <svg
          class="city-map-board__slot-layer"
          viewBox={`${viewport().x} ${viewport().y} ${viewport().width} ${viewport().height}`}
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
          viewport={viewport()}
        />
        <CityMapDebugDock state={debugState()} onToggle={toggleDebug} />
      </div>
    </section>
  );
};

import { createMemo, createSignal, Show, onCleanup, onMount, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { buildCityMap, type CityBlock, type CityDistrict, type CityMap, type Point } from '@/services/playgame/city-map';
import { pointInPolygon } from '@/services/playgame/city-map/geometry';
import { polygonToPath } from '@/services/playgame/city-map/paths';
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
import { CityMapRendererHost } from './CityMapRendererHost';
import { LandmarkTooltip } from './LandmarkTooltip';
import { useCityMapLandmarkHover } from './useCityMapHover';
import { useCityMapHighlight } from './useCityMapHighlight';
import { CityMapDebugDock, type CityMapDebugState } from './CityMapDebugDock';
import { createCityMapRenderModel, type CityMapRendererMode } from './render-model';
import './cityMapStyles.css';

export interface CityMapBoardProps {
  seed?: string | number;
  city?: CityMap;
  width?: number;
  height?: number;
  interactive?: boolean;
  rendererMode?: CityMapRendererMode;
  showVenueTooltips?: boolean;
  debug?: {
    showLabels?: boolean;
    showBuildings?: boolean;
    showRoads?: boolean;
    showLandmarks?: boolean;
    showSlots?: boolean;
    simplifyDuringCameraMove?: boolean;
  };
}

export const CityMapBoard = (props: CityMapBoardProps) => {
  const [selectedSlotId, setSelectedSlotId] = createSignal<string | null>(null);
  const [planningHover, setPlanningHover] = createSignal<{
    block: CityBlock & Record<string, any>;
    x: number;
    y: number;
  } | null>(null);
  const initialDebug = untrack(() => props.debug);
  const initialRendererMode = untrack(() => props.rendererMode);
  const [debugState, setDebugState] = createSignal<CityMapDebugState>({
    showMap: true,
    useThreeRenderer: initialRendererMode === 'three',
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
    simplifyDuringCameraMove: initialDebug?.simplifyDuringCameraMove ?? false,
  });
  const city = createMemo(() => props.city || buildCityMap(props.seed ?? 'new-game-city'));
  const width = () => props.width || city().width;
  const height = () => props.height || city().height;
  const renderModel = createMemo(() => createCityMapRenderModel(city(), width(), height()));
  const worldSize = () => ({ width: width(), height: height() });
  const [surfaceAspect, setSurfaceAspect] = createSignal(width() / height());
  const [surfaceSize, setSurfaceSize] = createSignal(worldSize());
  const [camera, setCamera] = createSignal<CityMapCameraState>(createInitialCityMapCamera(worldSize()));
  const viewport = createMemo(() => cameraToViewport(camera(), worldSize(), surfaceAspect()));
  const landmarks = () => renderModel().landmarks;
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
  const blockAtPoint = (point: Point) => {
    for (const block of city().cells as Array<CityBlock & Record<string, any>>) {
      if (!block.buildable) continue;
      if (pointInPolygon(point, block.polygon)) return block;
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
  let queuedCamera: CityMapCameraState | null = null;
  let cameraFrameId: number | null = null;
  let cameraMovingTimeoutId: number | null = null;
  type CameraMotion = 'idle' | 'pan' | 'zoom';
  const [cameraMotion, setCameraMotion] = createSignal<CameraMotion>('idle');
  const planningZoomMax = 64;
  const gameplayZoomMax = 4;
  const cameraDockStorageKey = 'cruel-deal.city-map.camera-dock-position';
  const [cameraDockPosition, setCameraDockPosition] = createSignal<{ x: number; y: number } | null>(null);
  let cameraDockEl: HTMLDivElement | undefined;

  const markCameraMoving = (motion: Exclude<CameraMotion, 'idle'>) => {
    setCameraMotion(motion);
    if (cameraMovingTimeoutId != null) window.clearTimeout(cameraMovingTimeoutId);
    cameraMovingTimeoutId = window.setTimeout(() => {
      cameraMovingTimeoutId = null;
      setCameraMotion('idle');
    }, 140);
  };

  const scheduleCamera = (next: CityMapCameraState, motion: Exclude<CameraMotion, 'idle'>) => {
    markCameraMoving(motion);
    queuedCamera = next;
    if (cameraFrameId != null) return;
    cameraFrameId = window.requestAnimationFrame(() => {
      cameraFrameId = null;
      if (!queuedCamera) return;
      setCamera(queuedCamera);
      queuedCamera = null;
    });
  };
  const updateCamera = (
    project: (current: CityMapCameraState) => CityMapCameraState,
    motion: Exclude<CameraMotion, 'idle'>,
  ) => {
    scheduleCamera(project(queuedCamera ?? camera()), motion);
  };

  onCleanup(() => {
    if (cameraFrameId != null) window.cancelAnimationFrame(cameraFrameId);
    if (cameraMovingTimeoutId != null) window.clearTimeout(cameraMovingTimeoutId);
  });

  onMount(() => {
    try {
      const raw = window.localStorage.getItem(cameraDockStorageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { x?: number; y?: number };
        if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          setCameraDockPosition({ x: Math.max(0, saved.x!), y: Math.max(0, saved.y!) });
        }
      }
    } catch {
      // Ignore corrupt localStorage.
    }
    if (!surfaceEl) return;
    const updateAspect = () => {
      const rect = surfaceEl!.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nextAspect = rect.width / rect.height;
        setSurfaceSize({ width: rect.width, height: rect.height });
        setSurfaceAspect(nextAspect);
        setCamera((current) => clampCamera({ ...current, maxZoom: debugState().showComposition ? planningZoomMax : gameplayZoomMax }, worldSize(), nextAspect));
      }
    };
    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(surfaceEl);
    onCleanup(() => observer.disconnect());
  });

  const isControlTarget = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('.city-map-debug-dock, .city-map-camera-dock');
  const onWheel = (event: WheelEvent & { currentTarget: Element }) => {
    if (!interactive() || isControlTarget(event.target)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorWorld = screenToWorld({ x: event.clientX, y: event.clientY }, rect, viewport());
    const anchorScreen = normalizedPointFromClient({ x: event.clientX, y: event.clientY }, rect);
    const zoomFactor = Math.exp(-event.deltaY * 0.0018);
    const size = worldSize();
    const aspect = surfaceAspect();
    updateCamera((current) => zoomCameraAt(current, anchorWorld, anchorScreen, current.zoom * zoomFactor, size, aspect), 'zoom');
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
        const size = worldSize();
        const aspect = surfaceAspect();
        updateCamera(
          (current) => panCameraByScreenDelta(
            current,
            { x: dx, y: dy },
            rect,
            cameraToViewport(current, size, aspect),
            size,
            aspect,
          ),
          'pan',
        );
        panDrag.lastX = event.clientX;
        panDrag.lastY = event.clientY;
        panDrag.moved = panDrag.moved || Math.hypot(dx, dy) > 3;
        return;
      }
    }
    hover.bind.onPointerMove(event);
    const point = boardPointFromPointer(event);
    highlight.onDistrictHover(interactive() ? districtAtPoint(point) : null);
    if (interactive() && debugState().showComposition) {
      const rect = event.currentTarget.getBoundingClientRect();
      const block = blockAtPoint(point);
      setPlanningHover(block ? { block, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
    } else {
      setPlanningHover(null);
    }
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
    setPlanningHover(null);
  };
  const onClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const toggleDebug = (key: keyof CityMapDebugState) => {
    setDebugState((state) => {
      const next = { ...state, [key]: !state[key] };
      if (key === 'showComposition') {
        const maxZoom = next.showComposition ? planningZoomMax : gameplayZoomMax;
        setCamera((current) => clampCamera({ ...current, maxZoom }, worldSize(), surfaceAspect()));
      }
      return next;
    });
  };
  const nudgeCamera = (dx: number, dy: number) => {
    const size = worldSize();
    const aspect = surfaceAspect();
    updateCamera((current) => {
      const view = cameraToViewport(current, size, aspect);
      return clampCamera({
        ...current,
        center: {
          x: current.center.x + dx * view.width,
          y: current.center.y + dy * view.height,
        },
      }, size, aspect);
    }, 'pan');
  };
  const zoomCameraFromDock = (factor: number) => {
    const size = worldSize();
    const aspect = surfaceAspect();
    updateCamera((current) => zoomCameraAt(
      current,
      current.center,
      { x: 0.5, y: 0.5 },
      current.zoom * factor,
      size,
      aspect,
    ), 'zoom');
  };
  const resetCamera = () => {
    const size = worldSize();
    const aspect = surfaceAspect();
    updateCamera((current) => clampCamera({
      ...current,
      center: { x: size.width / 2, y: size.height / 2 },
      zoom: 1,
      maxZoom: debugState().showComposition ? planningZoomMax : gameplayZoomMax,
    }, size, aspect), 'zoom');
  };
  const saveCameraDockPosition = (next: { x: number; y: number }) => {
    try {
      window.localStorage.setItem(cameraDockStorageKey, JSON.stringify(next));
    } catch {
      // Ignore storage failures; drag should still work.
    }
  };
  const dragCameraDock = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button') || !cameraDockEl) return;
    event.preventDefault();
    const rect = cameraDockEl.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    let latest = { x: rect.left, y: rect.top };
    const onMove = (moveEvent: PointerEvent) => {
      latest = {
        x: Math.max(0, Math.min(window.innerWidth - rect.width, moveEvent.clientX - offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - rect.height, moveEvent.clientY - offsetY)),
      };
      setCameraDockPosition(latest);
    };
    const onUp = () => {
      saveCameraDockPosition(latest);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
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
        <CityMapRendererHost
          mode={debugState().useThreeRenderer ? 'three' : 'svg'}
          model={renderModel()}
          viewport={viewport()}
          surfaceSize={surfaceSize()}
          debugState={debugState()}
          cameraMotion={cameraMotion()}
          interactive={interactive()}
          hoveredDistrictId={highlight.hoveredDistrictId()}
          hoveredLandmarkId={hover.hoveredLandmarkId()}
          selectedSlotId={selectedSlotId()}
          onSlotClick={(slot) => setSelectedSlotId(slot.id)}
        />
        <LandmarkTooltip
          landmark={hover.hoveredLandmark()}
          board={{ width: width(), height: height() }}
          screenSize={surfaceSize()}
          viewport={viewport()}
        />
        <Show when={debugState().showComposition && planningHover()}>
          {(hovered) => (
            <svg
              class="city-map-planning-highlight"
              viewBox={`${viewport().x} ${viewport().y} ${viewport().width} ${viewport().height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={polygonToPath(hovered().block.polygon)} />
            </svg>
          )}
        </Show>
        <Show when={debugState().showComposition && planningHover()}>
          {(hovered) => {
            const planning = () => hovered().block.planning || {};
            const label = () => `${String(planning().use || 'unknown').toUpperCase()} / ${String(planning().age || 'unknown').toUpperCase()}`;
            return (
              <div
                class="city-map-planning-tooltip"
                style={{
                  left: `${Math.min(surfaceSize().width - 176, hovered().x + 12)}px`,
                  top: `${Math.min(surfaceSize().height - 190, hovered().y + 12)}px`,
                }}
              >
                <div class="city-map-planning-tooltip__title">{label()}</div>
                <div class="city-map-planning-tooltip__row">block {hovered().block.id}</div>
                <div class="city-map-planning-tooltip__row">area {Math.round(Number(hovered().block.area || 0))}</div>
                <div class="city-map-planning-tooltip__row">
                  road {Number(planning().roadPriority || 0)} / mod {Number(planning().modernityScore || 0).toFixed(2)}
                </div>
                <Show when={planning().frontageRoadClass || planning().frontageScore}>
                  <div class="city-map-planning-tooltip__row">
                    frontage {String(planning().frontageRoadClass || 'n/a')} / {Math.round(Number(planning().frontageScore || 0))}
                  </div>
                </Show>
                <Show when={planning().frontageDivisionCount}>
                  <div class="city-map-planning-tooltip__row">
                    divisions {planning().frontageDivisionCount} / length {Math.round(Number(planning().frontageLength || 0))}
                  </div>
                </Show>
                <Show when={planning().layoutStrategy}>
                  <div class="city-map-planning-tooltip__row">layout {planning().layoutStrategy}</div>
                </Show>
                <Show when={planning().shapeFamily}>
                  <div class="city-map-planning-tooltip__row">
                    shape {planning().shapeFamily} / {planning().shapeOrientation || 'unknown'} / {Math.round(Number(planning().shapeConfidence || 0) * 100)}%
                  </div>
                </Show>
                <Show when={planning().shapeSideCount}>
                  <div class="city-map-planning-tooltip__row">
                    sides {planning().shapeSideCount} / {Array.isArray(planning().shapeSideKinds) ? planning().shapeSideKinds.join(',') : 'n/a'}
                  </div>
                </Show>
                <Show when={Array.isArray(planning().shapeCornerAngles) && planning().shapeCornerAngles.length}>
                  <div class="city-map-planning-tooltip__row">
                    angles {planning().shapeCornerAngles.slice(0, 6).map((angle: number) => Math.round(angle)).join('/')}
                  </div>
                </Show>
                <Show when={planning().triangleOrientation}>
                  <div class="city-map-planning-tooltip__row">
                    triangle {planning().triangleOrientation}
                  </div>
                </Show>
                <Show when={planning().selectedTemplate}>
                  <div class="city-map-planning-tooltip__row">template {planning().selectedTemplate}</div>
                </Show>
                <Show when={planning().shapeFallbackReason}>
                  <div class="city-map-planning-tooltip__row">shape fallback {planning().shapeFallbackReason}</div>
                </Show>
                <Show when={Array.isArray(planning().shapeReasons) && planning().shapeReasons.length}>
                  <div class="city-map-planning-tooltip__row">why {planning().shapeReasons.slice(0, 2).join(' / ')}</div>
                </Show>
                <Show when={planning().placedCount != null}>
                  <div class="city-map-planning-tooltip__row">
                    placed {planning().placedCount} / coverage {Math.round(Number(planning().envelopeCoverage || 0) * 100)}%
                  </div>
                </Show>
                <Show when={planning().frontageSetback != null}>
                  <div class="city-map-planning-tooltip__row">
                    setback {Number(planning().frontageSetback).toFixed(2)} / no-shrink {planning().bypassedRoadShrink ? 'yes' : 'no'}
                  </div>
                </Show>
                <Show when={planning().highValueFrontageUtilization != null}>
                  <div class="city-map-planning-tooltip__row">
                    frontage use {Math.round(Number(planning().highValueFrontageUtilization || 0) * 100)}%
                  </div>
                </Show>
                <Show when={planning().layoutFailure}>
                  <div class="city-map-planning-tooltip__row">failure {planning().layoutFailure}</div>
                </Show>
              </div>
            );
          }}
        </Show>
        <CityMapDebugDock state={debugState()} onToggle={toggleDebug} />
      </div>
      <Show when={debugState().showComposition}>
        <Portal mount={document.body}>
          <div
            ref={(el) => {
              cameraDockEl = el;
            }}
            class="city-map-camera-dock"
            aria-label="Planning camera controls"
            onPointerDown={dragCameraDock}
            style={{
              ...(cameraDockPosition() ? {
                left: `${cameraDockPosition()!.x}px`,
                top: `${cameraDockPosition()!.y}px`,
              } : {
                left: '10px',
                top: '10px',
              }),
            }}
          >
            <button type="button" aria-label="Pan up" onClick={() => nudgeCamera(0, -0.18)}>^</button>
            <div class="city-map-camera-dock__middle">
              <button type="button" aria-label="Pan left" onClick={() => nudgeCamera(-0.18, 0)}>&lt;</button>
              <button type="button" aria-label="Reset camera" onClick={resetCamera}>o</button>
              <button type="button" aria-label="Pan right" onClick={() => nudgeCamera(0.18, 0)}>&gt;</button>
            </div>
            <button type="button" aria-label="Pan down" onClick={() => nudgeCamera(0, 0.18)}>v</button>
            <div class="city-map-camera-dock__zoom">
              <button type="button" aria-label="Zoom out" onClick={() => zoomCameraFromDock(0.78)}>-</button>
              <button type="button" aria-label="Zoom in" onClick={() => zoomCameraFromDock(1.28)}>+</button>
            </div>
          </div>
        </Portal>
      </Show>
    </section>
  );
};

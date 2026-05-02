import type { Point } from '@/services/playgame/city-map';

export interface Size {
  width: number;
  height: number;
}

export interface CityMapCameraState {
  center: Point;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface CityMapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createInitialCityMapCamera(world: Size): CityMapCameraState {
  return {
    center: { x: world.width / 2, y: world.height / 2 },
    zoom: 1,
    minZoom: 1,
    maxZoom: 4,
  };
}

export function cameraToViewport(camera: CityMapCameraState, world: Size, aspect = world.width / world.height): CityMapViewport {
  const safeZoom = Math.max(0.001, camera.zoom);
  const worldAspect = world.width / world.height;
  const viewport = aspect >= worldAspect
    ? {
      width: world.width / safeZoom,
      height: (world.width / safeZoom) / Math.max(0.001, aspect),
    }
    : {
      width: (world.height / safeZoom) * Math.max(0.001, aspect),
      height: world.height / safeZoom,
    };

  return {
    x: camera.center.x - viewport.width / 2,
    y: camera.center.y - viewport.height / 2,
    width: viewport.width,
    height: viewport.height,
  };
}

export function clampCamera(camera: CityMapCameraState, world: Size, aspect = world.width / world.height): CityMapCameraState {
  const zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);
  const viewport = cameraToViewport({ ...camera, zoom }, world, aspect);
  const halfW = viewport.width / 2;
  const halfH = viewport.height / 2;
  const center = {
    x: viewport.width >= world.width ? world.width / 2 : clamp(camera.center.x, halfW, world.width - halfW),
    y: viewport.height >= world.height ? world.height / 2 : clamp(camera.center.y, halfH, world.height - halfH),
  };

  return { ...camera, center, zoom };
}

export function normalizedPointFromClient(client: ScreenPoint, rect: DOMRect): NormalizedPoint {
  return {
    x: rect.width > 0 ? clamp((client.x - rect.left) / rect.width, 0, 1) : 0,
    y: rect.height > 0 ? clamp((client.y - rect.top) / rect.height, 0, 1) : 0,
  };
}

export function screenToWorld(client: ScreenPoint, rect: DOMRect, viewport: CityMapViewport): Point {
  const normalized = normalizedPointFromClient(client, rect);
  return {
    x: viewport.x + normalized.x * viewport.width,
    y: viewport.y + normalized.y * viewport.height,
  };
}

export function worldToScreen(point: Point, rect: DOMRect, viewport: CityMapViewport): ScreenPoint {
  return {
    x: rect.left + ((point.x - viewport.x) / viewport.width) * rect.width,
    y: rect.top + ((point.y - viewport.y) / viewport.height) * rect.height,
  };
}

export function panCameraByScreenDelta(
  camera: CityMapCameraState,
  delta: ScreenPoint,
  rect: DOMRect,
  viewport: CityMapViewport,
  world: Size,
  aspect = world.width / world.height,
): CityMapCameraState {
  const dx = rect.width > 0 ? (delta.x / rect.width) * viewport.width : 0;
  const dy = rect.height > 0 ? (delta.y / rect.height) * viewport.height : 0;
  return clampCamera({
    ...camera,
    center: {
      x: camera.center.x - dx,
      y: camera.center.y - dy,
    },
  }, world, aspect);
}

export function zoomCameraAt(
  camera: CityMapCameraState,
  anchorWorld: Point,
  anchorScreen: NormalizedPoint,
  nextZoom: number,
  world: Size,
  aspect = world.width / world.height,
): CityMapCameraState {
  const zoom = clamp(nextZoom, camera.minZoom, camera.maxZoom);
  const nextViewport = cameraToViewport({ ...camera, zoom }, world, aspect);

  return clampCamera({
    ...camera,
    zoom,
    center: {
      x: anchorWorld.x - (anchorScreen.x - 0.5) * nextViewport.width,
      y: anchorWorld.y - (anchorScreen.y - 0.5) * nextViewport.height,
    },
  }, world, aspect);
}


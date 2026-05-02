import { createMemo, createSignal, type Accessor } from 'solid-js';
import type { CitySlot, DistrictLandmark, Point } from '@/services/playgame/city-map';

export interface Size {
  width: number;
  height: number;
}

export interface VenueTooltipLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  connectorStart: Point;
  connectorEnd: Point;
  placement: 'above' | 'below';
}

export interface VenueTooltipPlacementOptions {
  width?: number;
  height?: number;
  padding?: number;
  offset?: number;
  slotClearance?: number;
}

export interface CityMapHoverOptions {
  slots: Accessor<readonly CitySlot[]>;
  board: Accessor<Size>;
  enabled?: Accessor<boolean>;
  radius?: Accessor<number>;
}

export interface CityMapLandmarkHoverOptions {
  landmarks: Accessor<readonly DistrictLandmark[]>;
  board: Accessor<Size>;
  enabled?: Accessor<boolean>;
  radius?: Accessor<number>;
}

const DEFAULT_HOVER_RADIUS = 18;
const DEFAULT_TOOLTIP_WIDTH = 164;
const DEFAULT_TOOLTIP_HEIGHT = 48;
const DEFAULT_TOOLTIP_PADDING = 8;
const DEFAULT_TOOLTIP_OFFSET = 30;
const DEFAULT_SLOT_CLEARANCE = 16;

function finitePoint(point: Point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function squaredDistance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function nearestHoverSlot(
  point: Point,
  slots: readonly CitySlot[],
  radius = DEFAULT_HOVER_RADIUS,
): CitySlot | null {
  if (!finitePoint(point) || !Number.isFinite(radius) || radius < 0) return null;

  let best: CitySlot | null = null;
  let bestD = Infinity;

  for (const slot of slots) {
    if (!finitePoint(slot)) continue;
    const d = squaredDistance(point, slot);
    if (d < bestD) {
      best = slot;
      bestD = d;
    }
  }

  return best && bestD <= radius * radius ? best : null;
}

export function nearestHoverLandmark(
  point: Point,
  landmarks: readonly DistrictLandmark[],
  radius = DEFAULT_HOVER_RADIUS,
): DistrictLandmark | null {
  if (!finitePoint(point) || !Number.isFinite(radius) || radius < 0) return null;

  let best: DistrictLandmark | null = null;
  let bestD = Infinity;

  for (const landmark of landmarks) {
    if (!finitePoint(landmark.centroid)) continue;
    const d = squaredDistance(point, landmark.centroid);
    if (d < bestD) {
      best = landmark;
      bestD = d;
    }
  }

  return best && bestD <= radius * radius ? best : null;
}

export function placeVenueTooltip(
  anchor: Point,
  board: Size,
  options: VenueTooltipPlacementOptions = {},
): VenueTooltipLayout {
  const padding = options.padding ?? DEFAULT_TOOLTIP_PADDING;
  const offset = options.offset ?? DEFAULT_TOOLTIP_OFFSET;
  const slotClearance = options.slotClearance ?? DEFAULT_SLOT_CLEARANCE;
  const boardWidth = Math.max(0, board.width);
  const boardHeight = Math.max(0, board.height);
  const width = Math.max(0, Math.min(options.width ?? DEFAULT_TOOLTIP_WIDTH, boardWidth - padding * 2));
  const height = Math.max(0, Math.min(options.height ?? DEFAULT_TOOLTIP_HEIGHT, boardHeight - padding * 2));
  const maxX = Math.max(padding, boardWidth - width - padding);
  const maxY = Math.max(padding, boardHeight - height - padding);
  const fitsAbove = anchor.y - offset - height >= padding;
  const placement: VenueTooltipLayout['placement'] = fitsAbove ? 'above' : 'below';
  const side = anchor.x > boardWidth / 2 ? -1 : 1;
  const idealX = anchor.x + side * (slotClearance + width * 0.16) - width / 2;
  const idealY = placement === 'above'
    ? anchor.y - offset - height
    : anchor.y + offset;

  const x = clamp(idealX, padding, maxX);
  const y = clamp(idealY, padding, maxY);
  const connectorInset = Math.min(12, Math.max(0, width / 2));
  const connectorX = anchor.x < x
    ? x + connectorInset
    : anchor.x > x + width
      ? x + width - connectorInset
      : clamp(anchor.x, x + connectorInset, x + width - connectorInset);

  return {
    x,
    y,
    width,
    height,
    placement,
    connectorStart: {
      x: connectorX,
      y: y + height,
    },
    connectorEnd: anchor,
  };
}

export function useCityMapHover(options: CityMapHoverOptions) {
  const [pointerPoint, setPointerPoint] = createSignal<Point | null>(null);

  const enabled = () => options.enabled?.() ?? true;
  const radius = () => options.radius?.() ?? DEFAULT_HOVER_RADIUS;
  const hoveredSlot = createMemo(() => {
    const point = pointerPoint();
    return point && enabled() ? nearestHoverSlot(point, options.slots(), radius()) : null;
  });

  const onPointerMove = (event: PointerEvent & { currentTarget: Element }) => {
    if (!enabled()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const board = options.board();
    const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * board.width : 0;
    const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * board.height : 0;
    setPointerPoint({ x, y });
  };

  const clearHover = () => setPointerPoint(null);

  return {
    hoveredSlot,
    hoveredSlotId: () => hoveredSlot()?.id ?? null,
    pointerPoint,
    setPointerPoint,
    clearHover,
    bind: {
      onPointerMove,
      onPointerLeave: clearHover,
      onPointerCancel: clearHover,
    },
  };
}

export function useCityMapLandmarkHover(options: CityMapLandmarkHoverOptions) {
  const [pointerPoint, setPointerPoint] = createSignal<Point | null>(null);

  const enabled = () => options.enabled?.() ?? true;
  const radius = () => options.radius?.() ?? DEFAULT_HOVER_RADIUS;
  const hoveredLandmark = createMemo(() => {
    const point = pointerPoint();
    return point && enabled() ? nearestHoverLandmark(point, options.landmarks(), radius()) : null;
  });

  const onPointerMove = (event: PointerEvent & { currentTarget: Element }) => {
    if (!enabled()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const board = options.board();
    const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * board.width : 0;
    const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * board.height : 0;
    setPointerPoint({ x, y });
  };

  const clearHover = () => setPointerPoint(null);

  return {
    hoveredLandmark,
    hoveredLandmarkId: () => hoveredLandmark()?.id ?? null,
    pointerPoint,
    setPointerPoint,
    clearHover,
    bind: {
      onPointerMove,
      onPointerLeave: clearHover,
      onPointerCancel: clearHover,
    },
  };
}

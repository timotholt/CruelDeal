/**
 * Lane-map overlay setup for the /play board.
 *
 * One `.lane-map` div per active lane is positioned over that lane's current
 * screen region. It carries the "full lane" art visible when a location is
 * revealed. Layout recomputes on resize.
 *
 * Lives in its own module so additions (fog of war, active-lane glow) can
 * be made without disturbing the main board layout file.
 */

/** Fallback accent tile when a lane has no location asset yet. */
const FALLBACK_MAP: string = '/art/maps/Cathedrawl.png';

/** Fisher–Yates shuffle (kept for callers that still want randomness). */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface LaneMapsHandle {
  /** Reconcile paths, visibility, and topology without replacing stable nodes. */
  update(lanes: readonly LaneMapSpec[]): void;
  /** Cleanup: remove overlays + stop observing resize. */
  dispose(): void;
  /** The active lane-map elements, in projected lane order. */
  elements: readonly HTMLDivElement[];
}

export interface LaneMapSpec {
  readonly laneId: number;
  readonly path: string | null;
  readonly revealed: boolean;
}

/**
 * Create the active `.lane-map` overlays on `boardEl` and keep them sized
 * to match the combined enemy+player row footprint of each lane.
 *
 * `lanes` contains the active lanes in projected order and the art path for
 * each lane's location. Pass `null` to fall back to a generic tile (e.g. the
 * lane's location asset hasn't loaded yet). The art is
 * pulled from `manifest.locations[defId].cosmetic.art.map.path` by the
 * caller — do NOT randomise here. Image ↔ location must match exactly,
 * otherwise the revealed location card says "Cathedral" while the
 * overlay still shows the jungle.
 */
export function setupLaneMaps(
  boardEl: HTMLElement,
  initialLanes: readonly LaneMapSpec[],
): LaneMapsHandle {
  const mapByLane = new Map<number, HTMLDivElement>();
  let lanes = initialLanes;

  const layout = (): void => {
    const boardRect = boardEl.getBoundingClientRect();
    for (const { laneId } of lanes) {
      const top = boardEl.querySelector(`.enemy-row [data-lane="${laneId}"]`) as HTMLElement | null;
      const bot = boardEl.querySelector(`.player-row [data-lane="${laneId}"]`) as HTMLElement | null;
      const map = mapByLane.get(laneId);
      if (!top || !bot || !map) continue;
      const topRect = top.getBoundingClientRect();
      const botRect = bot.getBoundingClientRect();
      map.style.left = `${topRect.left - boardRect.left}px`;
      map.style.top = `${topRect.top - boardRect.top}px`;
      map.style.width = `${topRect.width}px`;
      map.style.height = `${botRect.bottom - topRect.top}px`;
    }
  };

  const update = (nextLanes: readonly LaneMapSpec[]): void => {
    lanes = nextLanes;
    const activeIds = new Set(nextLanes.map(({ laneId }) => laneId));
    for (const [laneId, element] of mapByLane) {
      if (activeIds.has(laneId)) continue;
      element.remove();
      mapByLane.delete(laneId);
    }

    for (const { laneId, path, revealed } of nextLanes) {
      let element = mapByLane.get(laneId);
      if (!element) {
        element = document.createElement('div');
        element.className = 'lane-map';
        element.dataset.lane = String(laneId);
        boardEl.prepend(element);
        mapByLane.set(laneId, element);
      }
      const src = path ?? FALLBACK_MAP;
      element.dataset.revealed = String(revealed);
      element.style.backgroundImage = `url("${src}")`;
    }

    requestAnimationFrame(layout);
  };

  const ro = new ResizeObserver(layout);
  ro.observe(boardEl);
  update(initialLanes);

  return {
    update,
    get elements(): readonly HTMLDivElement[] {
      return lanes.flatMap(({ laneId }) => {
        const element = mapByLane.get(laneId);
        return element ? [element] : [];
      });
    },
    dispose(): void {
      ro.disconnect();
      mapByLane.forEach((element) => element.remove());
      mapByLane.clear();
    },
  };
}

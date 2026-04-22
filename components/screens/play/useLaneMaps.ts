/**
 * Lane-map overlay setup for the /play board.
 *
 * Three `.lane-map` divs are absolutely positioned over each of the 3 lane
 * columns. They carry the "full lane" art visible when a location is
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
  /** Cleanup: remove overlays + stop observing resize. */
  dispose(): void;
  /** The three lane-map elements, in lane order. */
  elements: readonly HTMLDivElement[];
}

/**
 * Create the three `.lane-map` overlays on `boardEl` and keep them sized
 * to match the combined enemy+player row footprint of each lane.
 *
 * `lanePaths` must be 3 entries, each the art path for the location
 * assigned to that lane. Pass `null` entries to fall back to a generic
 * tile (e.g. the lane's location asset hasn't loaded yet). The art is
 * pulled from `manifest.locations[defId].cosmetic.art.map.path` by the
 * caller — do NOT randomise here. Image ↔ location must match exactly,
 * otherwise the revealed location card says "Cathedral" while the
 * overlay still shows the jungle.
 */
export function setupLaneMaps(
  boardEl: HTMLElement,
  lanePaths: readonly [string | null, string | null, string | null],
): LaneMapsHandle {
  const mapEls: HTMLDivElement[] = lanePaths.map((path, i) => {
    const src = path ?? FALLBACK_MAP;
    const el = document.createElement('div');
    el.className = 'lane-map';
    el.dataset.lane = String(i);
    el.style.cssText = `position:absolute; pointer-events:none; background-image:url("${src}")`;
    boardEl.prepend(el);
    return el;
  });

  const layout = (): void => {
    const boardRect = boardEl.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      const top = boardEl.querySelector(`.enemy-row [data-lane="${i}"]`) as HTMLElement | null;
      const bot = boardEl.querySelector(`.player-row [data-lane="${i}"]`) as HTMLElement | null;
      const map = mapEls[i];
      if (!top || !bot || !map) continue;
      const topRect = top.getBoundingClientRect();
      const botRect = bot.getBoundingClientRect();
      map.style.left = `${topRect.left - boardRect.left}px`;
      map.style.top = `${topRect.top - boardRect.top}px`;
      map.style.width = `${topRect.width}px`;
      map.style.height = `${botRect.bottom - topRect.top}px`;
    }
  };

  requestAnimationFrame(layout);
  const ro = new ResizeObserver(layout);
  ro.observe(boardEl);

  return {
    elements: mapEls,
    dispose(): void {
      ro.disconnect();
      mapEls.forEach((el) => el.remove());
    },
  };
}

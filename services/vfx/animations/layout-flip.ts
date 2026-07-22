/** Capture-only half of FLIP layout motion. Compiled presentation timelines
 * own the inversion/play phase so reflow shares the same master clock as card
 * actors instead of creating an independent CSS transition and timer. */

/** Capture the current bounding rect for each id that still has a live ref. */
export function captureCardRects(
  ids: readonly string[],
  cardElMap: Map<string, HTMLElement>,
): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const id of ids) {
    const el = cardElMap.get(id);
    if (el && el.isConnected) rects.set(id, el.getBoundingClientRect());
  }
  return rects;
}

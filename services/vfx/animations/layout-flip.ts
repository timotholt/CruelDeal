/**
 * Layout-slide helper — the "FLIP" animation technique.
 *
 * When a keyed list changes (draw / play a card, hand reflows), surviving
 * items can snap to their new positions. This helper makes the reflow
 * smooth:
 *
 *   1. CAPTURE  — before the mutation, record each survivor's bounding rect.
 *   2. MUTATE   — caller does the state change (Solid re-renders automatically).
 *   3. SLIDE    — after the next paint, for each survivor:
 *                   - compute delta (oldRect - newRect)
 *                   - apply `translate: -delta` instantly (appears in old spot)
 *                   - transition `translate` back to 0 (slides into new spot)
 *
 * Uses the CSS `translate` property (NOT `transform: translate()`), so it
 * composes cleanly with existing `transform: scale()` / tilt rules.
 *
 * Ported from ccg/vfx-engine/project/ui/layout-flip.js.
 *
 * Solid usage pattern:
 *   const rects = captureCardRects(currentIds, cardRefs);
 *   setState(/* mutation * /);
 *   // After next microtask (so Solid has rendered):
 *   queueMicrotask(() => playCardLayoutSlide(rects, cardRefs));
 */

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

export interface LayoutSlideOpts {
  duration?: number;
  easing?: string;
}

const removeTransitionPart = (transition: string, property: 'all' | 'translate'): string => {
  if (!transition || transition === 'none') return transition;
  return transition
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      const firstToken = part.split(/\s+/)[0];
      return firstToken !== property;
    })
    .join(', ');
};

const withoutTranslateTransitions = (transition: string): string => (
  removeTransitionPart(removeTransitionPart(transition, 'translate'), 'all')
);

const appendTransition = (transition: string, addition: string): string => {
  if (!transition || transition === 'none') return addition;
  return `${transition}, ${addition}`;
};

const restoreTransition = (
  el: HTMLElement,
  expectedMergedTransition: string,
  previousTransition: string,
): void => {
  if (el.style.transition === expectedMergedTransition) {
    el.style.transition = previousTransition;
    return;
  }
  el.style.transition = removeTransitionPart(el.style.transition, 'translate');
};

/**
 * For each captured rect whose id still has a live element, animate the
 * element from its old position to its new one.
 */
export function playCardLayoutSlide(
  oldRects: Map<string, DOMRect>,
  cardElMap: Map<string, HTMLElement>,
  opts: LayoutSlideOpts = {},
): Promise<void> {
  const duration = opts.duration ?? 280;
  const easing = opts.easing ?? 'cubic-bezier(.4,0,.2,1)';
  const slides: Promise<void>[] = [];

  for (const [id, oldRect] of oldRects) {
    const newEl = cardElMap.get(id);
    if (!newEl || !newEl.isConnected) continue;
    const newRect = newEl.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

    // Instantly apply inverse offset (puts element in old position),
    // then transition it away to slide to new position. Keep existing
    // transform/hover transitions intact; only add and later remove translate.
    const previousTransition = newEl.style.transition;
    const slideTransition = `translate ${duration}ms ${easing}`;
    const mergedTransition = appendTransition(previousTransition, slideTransition);

    newEl.style.transition = withoutTranslateTransitions(previousTransition);
    newEl.style.translate = `${dx}px ${dy}px`;
    void newEl.offsetWidth; // force commit
    newEl.style.transition = mergedTransition;
    newEl.style.translate = '0px 0px';

    slides.push(new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        newEl.removeEventListener('transitionend', onEnd);
        restoreTransition(newEl, mergedTransition, previousTransition);
        newEl.style.translate = '';
        resolve();
      };
      const onEnd = (event: TransitionEvent): void => {
        if (event.target === newEl && event.propertyName === 'translate') finish();
      };
      const timeout = setTimeout(finish, duration + 100);
      newEl.addEventListener('transitionend', onEnd);
    }));
  }

  return Promise.all(slides).then(() => undefined);
}

import { JSX, createEffect, onCleanup } from 'solid-js';

export type ScaleToFitAlign = 'left' | 'center' | 'right';
export type ScaleToFitVerticalAlign = 'top' | 'center' | 'bottom';

/**
 * Box-fit: render arbitrary (possibly heterogeneous / rich) content at its natural
 * size, then apply ONE uniform transform scale so it fits the container, and anchor
 * it horizontally (left/center/right) and vertically (top/center/bottom).
 *
 * This is the counterpart to GameTextV2's glyph-fit. GameTextV2 measures a single
 * homogeneous text run with per-glyph cap/ink metrics (best for labels); ScaleToFit
 * scales any DOM subtree by its bounding box (best for rich blocks with mixed sizes,
 * e.g. h1/h2/rule/body). It centers the box, not the cap — fine for mixed content.
 *
 * Natural size is read from offsetWidth/offsetHeight, which ignore transforms, so
 * applying the scale never feeds back into the measurement (no layout loop).
 */
export const ScaleToFit = (props: {
  align?: ScaleToFitAlign;
  verticalAlign?: ScaleToFitVerticalAlign;
  maxScale?: number;
  minScale?: number;
  class?: string;
  children: JSX.Element;
}) => {
  let containerRef: HTMLDivElement | undefined;
  let innerRef: HTMLDivElement | undefined;

  const align = () => props.align ?? 'center';
  const verticalAlign = () => props.verticalAlign ?? 'center';
  const maxScale = () => props.maxScale ?? 1;
  const minScale = () => props.minScale ?? 0.1;

  createEffect(() => {
    const container = containerRef;
    const inner = innerRef;
    if (!container || !inner) return;
    // Subscribe so the effect re-runs (and re-applies) when alignment/scale change.
    align();
    verticalAlign();
    maxScale();
    minScale();

    const apply = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (containerWidth <= 0 || containerHeight <= 0) return;
      // offset sizes ignore transforms → this is the unscaled natural size.
      const naturalWidth = inner.offsetWidth;
      const naturalHeight = inner.offsetHeight;
      if (naturalWidth <= 0 || naturalHeight <= 0) return;

      const scale = Math.min(
        maxScale(),
        Math.max(minScale(), Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight)),
      );
      const scaledWidth = naturalWidth * scale;
      const scaledHeight = naturalHeight * scale;
      const translateX = align() === 'right'
        ? containerWidth - scaledWidth
        : align() === 'center'
        ? (containerWidth - scaledWidth) / 2
        : 0;
      const translateY = verticalAlign() === 'bottom'
        ? containerHeight - scaledHeight
        : verticalAlign() === 'center'
        ? (containerHeight - scaledHeight) / 2
        : 0;

      inner.style.transformOrigin = 'top left';
      inner.style.transform = `translate(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      inner.dataset.scaleFactor = scale.toFixed(4);
    };

    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(container);
    observer.observe(inner);

    const fontsReady = document.fonts?.ready;
    let disposed = false;
    void fontsReady?.then(() => {
      if (!disposed) apply();
    });

    onCleanup(() => {
      disposed = true;
      observer.disconnect();
    });
  });

  return (
    <div
      ref={(el) => { containerRef = el; }}
      data-scale-to-fit="container"
      class={`scale-to-fit ${props.class ?? ''}`}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div
        ref={(el) => { innerRef = el; }}
        data-scale-to-fit="inner"
        style={{ position: 'absolute', top: '0', left: '0', 'max-width': '100%', 'will-change': 'transform' }}
      >
        {props.children}
      </div>
    </div>
  );
};

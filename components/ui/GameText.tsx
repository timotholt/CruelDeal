import { createEffect, onCleanup } from 'solid-js';

interface GameTextProps {
  text: string;
  class?: string;
  baseFontSize: number; // in rem
  maxScale?: number;
  minScale?: number;
  skewFactor?: number; 
  maxLines?: number;
  italic?: boolean;
  letterSpacing?: string; // e.g. "0.1em" or "-0.02em"
}

const MEASUREMENT_CACHE: Record<string, { w: number, h: number }> = {};

/**
 * GameText Component
 * Dynamically scales text to fit its container using ResizeObserver and a measurement cache.
 */
export const GameText = (props: GameTextProps) => {
  let containerRef: HTMLDivElement | undefined;
  let textRef: HTMLDivElement | undefined;
  let currentScale = 1;

  const maxScale = () => props.maxScale ?? 1.0;
  const minScale = () => props.minScale ?? 0.2;
  const skewFactor = () => props.skewFactor ?? 1.0;
  const maxLines = () => props.maxLines ?? 1;
  const italic = () => props.italic ?? true;
  const letterSpacing = () => props.letterSpacing ?? "-0.05em";

  const isMultiLine = () => maxLines() > 1;
  const isLeftAligned = () => props.class?.includes('justify-start') ?? false;

  createEffect(() => {
    const container = containerRef;
    const textEl = textRef;
    if (!container || !textEl) return;

    const measure = () => {
      const containerW = container.getBoundingClientRect().width * skewFactor();
      const containerH = container.clientHeight;

      if (containerW <= 0 || containerH <= 0) return;

      const cacheKey = `${props.text}_${props.baseFontSize}_${skewFactor()}_${maxLines()}_${italic()}_${letterSpacing()}_${containerW}`;
      let dims = MEASUREMENT_CACHE[cacheKey];

      if (!dims) {
        const clone = document.createElement('div');
        clone.style.cssText = `
            position: absolute; visibility: hidden; left: -9999px; top: -9999px;
            font-size: ${props.baseFontSize}rem; line-height: 0.95;
            white-space: ${isMultiLine() ? 'normal' : 'pre'};
            width: ${isMultiLine() ? `${containerW}px` : 'auto'};
            font-family: "IBM Plex Sans Condensed", sans-serif; 
            font-weight: 900; 
            font-style: ${italic() ? 'italic' : 'normal'};
            text-transform: uppercase; 
            letter-spacing: ${letterSpacing()};
            padding-right: ${italic() ? '0.25em' : '0'};
        `;
        clone.innerText = props.text;
        document.body.appendChild(clone);
        dims = { w: clone.scrollWidth, h: clone.scrollHeight };
        document.body.removeChild(clone);
        MEASUREMENT_CACHE[cacheKey] = dims;
      }

      const safetyBuffer = italic() ? 0.92 : 1.0;
      const adjustedContainerW = containerW * safetyBuffer;

      const scaleW = isMultiLine() ? 1 : adjustedContainerW / (dims.w || 1);
      const scaleH = containerH / (dims.h || 1);
      
      const targetScale = Math.min(maxScale(), Math.max(minScale(), Math.min(scaleW, scaleH)));
      
      if (Math.abs(currentScale - targetScale) > 0.005) {
          currentScale = targetScale;
          textEl.style.transform = targetScale < 0.995 ? `scale(${targetScale})` : 'none';
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div 
        ref={(el) => containerRef = el}
        class={`w-full h-full flex items-center overflow-hidden pointer-events-none select-none ${isLeftAligned() ? 'justify-start text-left' : 'justify-center text-center'} ${props.class ?? ''}`}
        style={{ "font-size": `${props.baseFontSize}rem` }}
    >
      <div 
        ref={(el) => textRef = el}
        style={{ 
          transform: 'none',
          "transform-origin": isLeftAligned() ? 'left center' : 'center center',
          display: isMultiLine() ? '-webkit-box' : 'block', 
          width: isMultiLine() ? '100%' : 'max-content',
          "line-height": "0.95",
          "text-align": isLeftAligned() ? 'left' : 'center',
          "white-space": isMultiLine() ? 'normal' : 'pre',
          "font-style": italic() ? 'italic' : 'normal',
          "font-weight": 900,
          "letter-spacing": letterSpacing(),
          "will-change": 'transform',
          "-webkit-box-orient": 'vertical',
          "-webkit-line-clamp": maxLines(),
          "padding-right": italic() ? '0.2rem' : '0',
        }} 
      >
        {props.text}
      </div>
    </div>
  );
};

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
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  fontFamily?: string;
  fontWeight?: number | string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  lineHeight?: number;
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
  const align = () => props.align ?? ((props.class?.includes('justify-start') ?? false) ? 'left' : 'center');
  const verticalAlign = () => props.verticalAlign ?? 'center';
  const fontFamily = () => props.fontFamily ?? '"IBM Plex Sans Condensed", sans-serif';
  const fontWeight = () => props.fontWeight ?? 900;
  const textTransform = () => props.textTransform ?? 'uppercase';
  const lineHeight = () => props.lineHeight ?? 0.95;

  const isMultiLine = () => maxLines() > 1;
  const hasExplicitLineBreaks = () => props.text.includes('\n');
  const usesPreformattedLines = () => isMultiLine() && hasExplicitLineBreaks();
  const whiteSpace = () => usesPreformattedLines() ? 'pre' : isMultiLine() ? 'pre-line' : 'pre';
  const horizontalClass = () => align() === 'left'
    ? 'justify-start text-left'
    : align() === 'right'
    ? 'justify-end text-right'
    : 'justify-center text-center';
  const verticalClass = () => verticalAlign() === 'top'
    ? 'items-start'
    : verticalAlign() === 'bottom'
    ? 'items-end'
    : 'items-center';
  const transformOrigin = () => `${align()} ${verticalAlign()}`;

  createEffect(() => {
    const container = containerRef;
    const textEl = textRef;
    if (!container || !textEl) return;

    const measure = () => {
      const containerW = container.getBoundingClientRect().width * skewFactor();
      const containerH = container.clientHeight;

      if (containerW <= 0 || containerH <= 0) return;

      const cacheKey = [
        props.text,
        props.baseFontSize,
        skewFactor(),
        maxLines(),
        italic(),
        letterSpacing(),
        containerW,
        fontFamily(),
        fontWeight(),
        textTransform(),
        lineHeight(),
      ].join('_');
      let dims = MEASUREMENT_CACHE[cacheKey];

      if (!dims) {
        const clone = document.createElement('div');
        clone.style.cssText = `
            position: absolute; visibility: hidden; left: -9999px; top: -9999px;
            font-size: ${props.baseFontSize}rem; line-height: ${lineHeight()};
            white-space: ${whiteSpace()};
            width: auto;
            max-width: ${isMultiLine() && !usesPreformattedLines() ? `${containerW}px` : 'none'};
            font-family: ${fontFamily()};
            font-weight: ${fontWeight()};
            font-style: ${italic() ? 'italic' : 'normal'};
            text-transform: ${textTransform()};
            letter-spacing: ${letterSpacing()};
            padding-left: ${italic() ? '0.15rem' : '0'};
            padding-right: ${italic() ? '0.25rem' : '0'};
        `;
        clone.innerText = props.text;
        document.body.appendChild(clone);
        dims = { w: clone.scrollWidth, h: clone.scrollHeight };
        document.body.removeChild(clone);
        MEASUREMENT_CACHE[cacheKey] = dims;
      }

      const safetyBuffer = italic() ? 0.96 : 0.98;
      const adjustedContainerW = containerW * safetyBuffer;

      const scaleW = adjustedContainerW / (dims.w || 1);
      const scaleH = containerH / (dims.h || 1);
      
      const targetScale = Math.min(maxScale(), Math.max(minScale(), Math.min(scaleW, scaleH)));
      
      if (Math.abs(currentScale - targetScale) > 0.005) {
          currentScale = targetScale;
          textEl.style.transform = targetScale < 0.995 ? `scale(${targetScale})` : 'none';
          textEl.dataset.gameTextScale = targetScale.toFixed(4);
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
        data-game-text="container"
        class={`w-full h-full flex overflow-hidden pointer-events-none select-none ${verticalClass()} ${horizontalClass()} ${props.class ?? ''}`}
        style={{ "font-size": `${props.baseFontSize}rem` }}
    >
      <div 
        ref={(el) => textRef = el}
        data-game-text="inner"
        data-game-text-scale="1.0000"
        style={{ 
          transform: 'none',
          "transform-origin": transformOrigin(),
          display: isMultiLine() && !usesPreformattedLines() ? '-webkit-box' : 'block',
          width: isMultiLine() && !usesPreformattedLines() ? '100%' : 'max-content',
          "line-height": lineHeight(),
          "text-align": align(),
          "white-space": whiteSpace(),
          "font-style": italic() ? 'italic' : 'normal',
          "font-family": fontFamily(),
          "font-weight": fontWeight(),
          "letter-spacing": letterSpacing(),
          "text-transform": textTransform(),
          "will-change": 'transform',
          "-webkit-box-orient": 'vertical',
          "-webkit-line-clamp": maxLines(),
          "padding-left": italic() ? '0.15rem' : '0',
          "padding-right": italic() ? '0.25rem' : '0',
        }} 
      >
        {props.text}
      </div>
    </div>
  );
};

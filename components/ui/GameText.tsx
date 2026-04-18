import React, { useLayoutEffect, useRef } from 'react';

interface GameTextProps {
  text: string;
  className?: string;
  baseFontSize: number; // in rem
  maxScale?: number;
  minScale?: number;
  skewFactor?: number; 
  maxLines?: number;
  italic?: boolean;
  letterSpacing?: string; // e.g. "0.1em" or "-0.02em"
}

const MEASUREMENT_CACHE: Record<string, { w: number, h: number }> = {};

export const GameText: React.FC<GameTextProps> = React.memo(({ 
  text, 
  className = '', 
  baseFontSize,
  maxScale = 1.0,
  minScale = 0.2,
  skewFactor = 1.0,
  maxLines = 1,
  italic = true,
  letterSpacing = "-0.05em" // Default game theme spacing
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const currentScaleRef = useRef(1);

  const isMultiLine = maxLines > 1;
  const isLeftAligned = className.includes('justify-start');

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      const containerW = container.getBoundingClientRect().width * skewFactor;
      const containerH = container.clientHeight;

      if (containerW <= 0 || containerH <= 0) return;

      const cacheKey = `${text}_${baseFontSize}_${skewFactor}_${maxLines}_${italic}_${letterSpacing}_${containerW}`;
      let dims = MEASUREMENT_CACHE[cacheKey];

      if (!dims) {
        const clone = document.createElement('div');
        clone.style.cssText = `
            position: absolute; visibility: hidden; left: -9999px; top: -9999px;
            font-size: ${baseFontSize}rem; line-height: 0.95;
            white-space: ${isMultiLine ? 'normal' : 'pre'};
            width: ${isMultiLine ? `${containerW}px` : 'auto'};
            font-family: "IBM Plex Sans Condensed", sans-serif; 
            font-weight: 900; 
            font-style: ${italic ? 'italic' : 'normal'};
            text-transform: uppercase; 
            letter-spacing: ${letterSpacing};
            padding-right: ${italic ? '0.25em' : '0'};
        `;
        clone.innerText = text;
        document.body.appendChild(clone);
        dims = { w: clone.scrollWidth, h: clone.scrollHeight };
        document.body.removeChild(clone);
        MEASUREMENT_CACHE[cacheKey] = dims;
      }

      const safetyBuffer = italic ? 0.92 : 1.0;
      const adjustedContainerW = containerW * safetyBuffer;

      const scaleW = isMultiLine ? 1 : adjustedContainerW / (dims.w || 1);
      const scaleH = containerH / (dims.h || 1);
      
      const targetScale = Math.min(maxScale, Math.max(minScale, Math.min(scaleW, scaleH)));
      
      if (Math.abs(currentScaleRef.current - targetScale) > 0.005) {
          currentScaleRef.current = targetScale;
          textEl.style.transform = targetScale < 0.995 ? `scale(${targetScale})` : 'none';
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text, baseFontSize, maxScale, minScale, skewFactor, maxLines, italic, isMultiLine, letterSpacing]);

  return (
    <div 
        ref={containerRef}
        className={`w-full h-full flex items-center overflow-hidden pointer-events-none select-none ${isLeftAligned ? 'justify-start text-left' : 'justify-center text-center'} ${className}`}
        style={{ fontSize: `${baseFontSize}rem` }}
    >
      <div 
        ref={textRef}
        style={{ 
          transform: 'none',
          transformOrigin: isLeftAligned ? 'left center' : 'center center',
          display: isMultiLine ? '-webkit-box' : 'block', 
          width: isMultiLine ? '100%' : 'max-content',
          lineHeight: 0.95,
          textAlign: isLeftAligned ? 'left' : 'center',
          whiteSpace: isMultiLine ? 'normal' : 'pre',
          fontStyle: italic ? 'italic' : 'normal',
          fontWeight: 900,
          letterSpacing: letterSpacing,
          willChange: 'transform',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: maxLines,
          paddingRight: italic ? '0.2em' : '0',
        }} 
      >
        {text}
      </div>
    </div>
  );
});
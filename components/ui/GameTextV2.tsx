import { createEffect, onCleanup } from 'solid-js';

export type GameTextV2FitMode = 'single-line' | 'fixed-lines' | 'paragraph';
export type GameTextV2Align = 'left' | 'center' | 'right';
export type GameTextV2VerticalAlign = 'top' | 'center' | 'bottom';

export interface GameTextV2Style {
  fontFamily?: string;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: string;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface GameTextV2Props {
  text: string;
  class?: string;
  baseFontSize: number;
  fitMode?: GameTextV2FitMode;
  maxLines?: number;
  minScale?: number;
  maxScale?: number;
  align?: GameTextV2Align;
  verticalAlign?: GameTextV2VerticalAlign;
  textStyle?: GameTextV2Style;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  skewFactor?: number;
  safetyScale?: number;
}

interface Measurement {
  width: number;
  height: number;
}

const measurementCache = new Map<string, Measurement>();

const defaultTextStyle: Required<GameTextV2Style> = {
  fontFamily: '"IBM Plex Sans Condensed", sans-serif',
  fontWeight: 900,
  fontStyle: 'italic',
  letterSpacing: '-0.05em',
  lineHeight: 0.95,
  textTransform: 'uppercase',
};

const resolvedStyle = (style?: GameTextV2Style): Required<GameTextV2Style> => ({
  fontFamily: style?.fontFamily ?? defaultTextStyle.fontFamily,
  fontWeight: style?.fontWeight ?? defaultTextStyle.fontWeight,
  fontStyle: style?.fontStyle ?? defaultTextStyle.fontStyle,
  letterSpacing: style?.letterSpacing ?? defaultTextStyle.letterSpacing,
  lineHeight: style?.lineHeight ?? defaultTextStyle.lineHeight,
  textTransform: style?.textTransform ?? defaultTextStyle.textTransform,
});

const resolvedMode = (text: string, maxLines: number, fitMode?: GameTextV2FitMode): GameTextV2FitMode => {
  if (fitMode) return fitMode;
  if (maxLines <= 1) return 'single-line';
  return text.includes('\n') ? 'fixed-lines' : 'paragraph';
};

const whiteSpaceForMode = (mode: GameTextV2FitMode) => {
  if (mode === 'paragraph') return 'pre-wrap';
  return 'pre';
};

const displayForMode = (mode: GameTextV2FitMode) => {
  if (mode === 'paragraph') return '-webkit-box';
  return 'block';
};

const widthForMode = (mode: GameTextV2FitMode) => {
  if (mode === 'paragraph') return '100%';
  return 'max-content';
};

const inlinePaddingForStyle = (style: Required<GameTextV2Style>) => {
  if (style.fontStyle !== 'italic') return { start: '0', end: '0' };
  return { start: '0.16em', end: '0.28em' };
};

const horizontalClass = (align: GameTextV2Align) => {
  if (align === 'left') return 'justify-start text-left';
  if (align === 'right') return 'justify-end text-right';
  return 'justify-center text-center';
};

const verticalClass = (align: GameTextV2VerticalAlign) => {
  if (align === 'top') return 'items-start';
  if (align === 'bottom') return 'items-end';
  return 'items-center';
};

const measureText = (
  text: string,
  style: Required<GameTextV2Style>,
  baseFontSize: number,
  mode: GameTextV2FitMode,
  maxLines: number,
  containerWidth: number,
  lang?: string,
  dir?: 'ltr' | 'rtl' | 'auto',
) => {
  const cacheKey = JSON.stringify({
    text,
    style,
    baseFontSize,
    mode,
    maxLines,
    containerWidth: mode === 'paragraph' ? Math.round(containerWidth * 100) / 100 : 0,
    lang,
    dir,
  });
  const cached = measurementCache.get(cacheKey);
  if (cached) return cached;

  const clone = document.createElement('div');
  const inlinePadding = inlinePaddingForStyle(style);
  clone.lang = lang ?? '';
  clone.dir = dir ?? 'auto';
  clone.style.cssText = `
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    left: -9999px;
    top: -9999px;
    box-sizing: border-box;
    display: ${displayForMode(mode)};
    width: ${mode === 'paragraph' ? `${containerWidth}px` : 'auto'};
    max-width: ${mode === 'paragraph' ? `${containerWidth}px` : 'none'};
    overflow: visible;
    font-size: ${baseFontSize}rem;
    font-family: ${style.fontFamily};
    font-weight: ${style.fontWeight};
    font-style: ${style.fontStyle};
    line-height: ${style.lineHeight};
    letter-spacing: ${style.letterSpacing};
    text-transform: ${style.textTransform};
    text-align: inherit;
    white-space: ${whiteSpaceForMode(mode)};
    overflow-wrap: normal;
    word-break: normal;
    padding-inline-start: ${inlinePadding.start};
    padding-inline-end: ${inlinePadding.end};
    -webkit-box-orient: vertical;
    -webkit-line-clamp: ${maxLines};
  `;
  clone.textContent = text;
  document.body.appendChild(clone);

  const rect = clone.getBoundingClientRect();
  const measurement = {
    width: Math.max(rect.width, clone.scrollWidth),
    height: Math.max(rect.height, clone.scrollHeight),
  };
  document.body.removeChild(clone);
  measurementCache.set(cacheKey, measurement);
  return measurement;
};

export const GameTextV2 = (props: GameTextV2Props) => {
  let containerRef: HTMLDivElement | undefined;
  let textRef: HTMLDivElement | undefined;
  let currentScale = 1;

  const maxLines = () => Math.max(1, props.maxLines ?? 1);
  const minScale = () => props.minScale ?? 0.2;
  const maxScale = () => props.maxScale ?? 1;
  const align = () => props.align ?? 'center';
  const verticalAlign = () => props.verticalAlign ?? 'center';
  const skewFactor = () => props.skewFactor ?? 1;
  const textStyle = () => resolvedStyle(props.textStyle);
  const fitMode = () => resolvedMode(props.text, maxLines(), props.fitMode);
  const transformOrigin = () => `${align()} ${verticalAlign()}`;

  createEffect(() => {
    const container = containerRef;
    const textEl = textRef;
    if (!container || !textEl) return;

    const applyMeasure = () => {
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width * skewFactor();
      const containerHeight = rect.height;
      if (containerWidth <= 0 || containerHeight <= 0) return;

      const mode = fitMode();
      const style = textStyle();
      const measurement = measureText(
        props.text,
        style,
        props.baseFontSize,
        mode,
        maxLines(),
        containerWidth,
        props.lang,
        props.dir,
      );
      const safetyScale = props.safetyScale ?? (style.fontStyle === 'italic' ? 0.96 : 0.98);
      const scaleX = (containerWidth * safetyScale) / Math.max(measurement.width, 1);
      const scaleY = containerHeight / Math.max(measurement.height, 1);
      const targetScale = Math.min(maxScale(), Math.max(minScale(), Math.min(scaleX, scaleY)));

      if (Math.abs(currentScale - targetScale) <= 0.005) return;
      currentScale = targetScale;
      textEl.style.transform = targetScale < 0.995 ? `scale(${targetScale})` : 'none';
      textEl.dataset.gameTextScale = targetScale.toFixed(4);
      textEl.dataset.gameTextMode = mode;
    };

    applyMeasure();

    const observer = new ResizeObserver(applyMeasure);
    observer.observe(container);

    const fontsReady = document.fonts?.ready;
    let disposed = false;
    void fontsReady?.then(() => {
      if (!disposed) applyMeasure();
    });

    onCleanup(() => {
      disposed = true;
      observer.disconnect();
    });
  });

  const style = () => textStyle();
  const mode = () => fitMode();
  const inlinePadding = () => inlinePaddingForStyle(style());

  return (
    <div
      ref={(el) => { containerRef = el; }}
      data-game-text="container"
      data-game-text-version="2"
      class={`w-full h-full flex overflow-hidden pointer-events-none select-none ${verticalClass(verticalAlign())} ${horizontalClass(align())} ${props.class ?? ''}`}
      style={{ 'font-size': `${props.baseFontSize}rem` }}
    >
      <div
        ref={(el) => { textRef = el; }}
        data-game-text="inner"
        data-game-text-version="2"
        data-game-text-mode={mode()}
        data-game-text-scale="1.0000"
        lang={props.lang}
        dir={props.dir ?? 'auto'}
        style={{
          transform: 'none',
          'transform-origin': transformOrigin(),
          display: displayForMode(mode()),
          width: widthForMode(mode()),
          'font-family': style().fontFamily,
          'font-size': `${props.baseFontSize}rem`,
          'font-weight': style().fontWeight,
          'font-style': style().fontStyle,
          'letter-spacing': style().letterSpacing,
          'line-height': style().lineHeight,
          'text-align': align(),
          'text-transform': style().textTransform,
          'white-space': whiteSpaceForMode(mode()),
          'overflow-wrap': 'normal',
          'word-break': 'normal',
          'padding-inline-start': inlinePadding().start,
          'padding-inline-end': inlinePadding().end,
          'will-change': 'transform',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': maxLines(),
        }}
      >
        {props.text}
      </div>
    </div>
  );
};

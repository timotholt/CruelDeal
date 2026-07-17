import { createEffect, onCleanup } from 'solid-js';

export type GameTextV2FitMode = 'single-line' | 'fixed-lines' | 'paragraph';
export type GameTextV2Align = 'left' | 'center' | 'right';
export type GameTextV2VerticalAlign = 'top' | 'center' | 'bottom';
export type GameTextV2VerticalMetric = 'line-box' | 'ink' | 'cap';

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
  verticalMetric?: GameTextV2VerticalMetric;
  textStyle?: GameTextV2Style;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  skewFactor?: number;
  safetyScale?: number;
}

interface Measurement {
  width: number;
  height: number;
  lineBox: TextVerticalMetric;
  ink?: TextVerticalMetric;
  cap?: TextVerticalMetric;
}

interface TextVerticalMetric {
  top: number;
  center: number;
  bottom: number;
  height: number;
}

const measurementCache = new Map<string, Measurement>();
let fontsReadyPromise: Promise<void> | undefined;

const whenDocumentFontsAreReady = () => {
  if (!document.fonts) return Promise.resolve();

  if (!fontsReadyPromise) {
    fontsReadyPromise = document.fonts.ready.then(() => {
      // A measurement taken while a web font is loading contains fallback-font
      // geometry. Never allow those dimensions to survive the font-ready pass.
      measurementCache.clear();
    });
  }

  return fontsReadyPromise;
};

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

const transformedText = (text: string, transform: Required<GameTextV2Style>['textTransform']) => {
  if (transform === 'uppercase') return text.toLocaleUpperCase();
  if (transform === 'lowercase') return text.toLocaleLowerCase();
  return text;
};

const textMetricFor = (
  context: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  lineHeight: number,
): TextVerticalMetric => {
  const metrics = context.measureText(text || ' ');
  const fontAscent = metrics.fontBoundingBoxAscent || fontSize * 0.8;
  const fontDescent = metrics.fontBoundingBoxDescent || fontSize * 0.2;
  const actualAscent = metrics.actualBoundingBoxAscent || fontAscent;
  const actualDescent = metrics.actualBoundingBoxDescent || fontDescent;
  const fontBox = fontAscent + fontDescent;
  const leading = Math.max(0, lineHeight - fontBox) / 2;
  const top = leading + Math.max(0, fontAscent - actualAscent);
  const bottom = top + actualAscent + actualDescent;
  return {
    top,
    center: (top + bottom) / 2,
    bottom,
    height: Math.max(1, bottom - top),
  };
};

const verticalMetricFor = (
  measurement: Measurement,
  metric: GameTextV2VerticalMetric,
  mode: GameTextV2FitMode,
) => {
  if (mode !== 'single-line') return measurement.lineBox;
  if (metric === 'cap') return measurement.cap ?? measurement.ink ?? measurement.lineBox;
  if (metric === 'ink') return measurement.ink ?? measurement.lineBox;
  return measurement.lineBox;
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
  const computed = getComputedStyle(clone);
  const lineHeight = Number.parseFloat(computed.lineHeight) || rect.height;
  const fontSize = Number.parseFloat(computed.fontSize) || baseFontSize * 16;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let ink: Measurement['ink'];
  let cap: Measurement['cap'];
  if (context) {
    context.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    ink = textMetricFor(context, transformedText(text, style.textTransform), fontSize, lineHeight);
    cap = textMetricFor(context, 'H', fontSize, lineHeight);
  }
  const measurement = {
    width: Math.max(rect.width, clone.scrollWidth),
    height: Math.max(rect.height, clone.scrollHeight),
    lineBox: {
      top: 0,
      center: Math.max(rect.height, clone.scrollHeight) / 2,
      bottom: Math.max(rect.height, clone.scrollHeight),
      height: Math.max(rect.height, clone.scrollHeight),
    },
    ink,
    cap,
  };
  document.body.removeChild(clone);
  measurementCache.set(cacheKey, measurement);
  return measurement;
};

let correctionContext: CanvasRenderingContext2D | null | undefined;
const getCorrectionContext = () => {
  if (correctionContext === undefined) {
    correctionContext = document.createElement('canvas').getContext('2d');
  }
  return correctionContext;
};

// Engine-agnostic vertical placement.
// The metric model in measureText() is computed from a hidden clone at base font
// size; it drifts from the real rendered line box because canvas font metrics differ
// across browser engines (Safari worst) and font-load timing can poison the cache.
// This computes the authoritative container-relative `top` from the LIVE element:
// same-engine font metrics locate the chosen metric (cap/ink) box inside each line,
// and the block is centered/anchored directly. It is absolute (no dependence on the
// prior top, no early-out), so it is deterministic regardless of when it runs
// relative to layout/font settling.
const verticalTopForMetric = (
  textEl: HTMLElement,
  container: HTMLElement,
  style: Required<GameTextV2Style>,
  text: string,
  metric: GameTextV2VerticalMetric,
  verticalAlign: GameTextV2VerticalAlign,
  scale: number,
): number | null => {
  const context = getCorrectionContext();
  if (!context) return null;
  const computed = getComputedStyle(textEl);
  const fontSize = Number.parseFloat(computed.fontSize);
  if (!fontSize) return null;
  const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize;
  context.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  const fm = context.measureText(transformedText(text, style.textTransform) || ' ');
  const fontAscent = fm.fontBoundingBoxAscent || fontSize * 0.8;
  const fontDescent = fm.fontBoundingBoxDescent || fontSize * 0.2;
  // CSS line-box layout: baseline sits half-leading below the content-box top.
  // Half-leading is allowed to be negative when line-height < font box.
  const baselineFromTop = (lineHeight + fontAscent - fontDescent) / 2;
  // Ink extent of a single line, measured from that line's box top. Uppercase
  // labels have no descenders, so cap-trim them; otherwise use the glyph ink box.
  const useCap = metric === 'cap' || style.textTransform === 'uppercase';
  const ascent = useCap
    ? (context.measureText('H').actualBoundingBoxAscent || fm.actualBoundingBoxAscent || fontAscent)
    : (fm.actualBoundingBoxAscent || fontAscent);
  const descent = useCap ? 0 : (fm.actualBoundingBoxDescent || 0);
  const lineInkTop = baselineFromTop - ascent;
  const lineInkBottom = baselineFromTop + descent;

  const containerHeight = container.getBoundingClientRect().height;
  // Span the ink across however many lines actually rendered, so multi-line blocks
  // center the same way single lines do. innerHeight is independent of `top`.
  const innerHeight = textEl.getBoundingClientRect().height;
  const lines = Math.max(1, Math.round(innerHeight / Math.max(lineHeight * scale, 1)));
  const inkTop = lineInkTop;
  const inkBottom = (lines - 1) * lineHeight + lineInkBottom;

  if (verticalAlign === 'bottom') return containerHeight - inkBottom * scale;
  if (verticalAlign === 'top') return -inkTop * scale;
  return containerHeight / 2 - ((inkTop + inkBottom) / 2) * scale;
};

export const GameTextV2 = (props: GameTextV2Props) => {
  let containerRef: HTMLDivElement | undefined;
  let textRef: HTMLDivElement | undefined;
  let currentTransform = 'none';

  const maxLines = () => Math.max(1, props.maxLines ?? 1);
  const minScale = () => props.minScale ?? 0.2;
  const maxScale = () => props.maxScale ?? 1;
  const align = () => props.align ?? 'center';
  const verticalAlign = () => props.verticalAlign ?? 'center';
  const verticalMetric = () => props.verticalMetric ?? (fitMode() === 'single-line' ? 'ink' : 'line-box');
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
      const verticalMetricBox = verticalMetricFor(measurement, verticalMetric(), mode);
      const scaleX = (containerWidth * safetyScale) / Math.max(measurement.width, 1);
      const scaleY = containerHeight / Math.max(verticalMetricBox.height, 1);
      const targetScale = Math.min(maxScale(), Math.max(minScale(), Math.min(scaleX, scaleY)));
      const top = verticalAlign() === 'bottom'
        ? containerHeight - verticalMetricBox.bottom * targetScale
        : verticalAlign() === 'center'
        ? containerHeight / 2 - verticalMetricBox.center * targetScale
        : -verticalMetricBox.top * targetScale;

      textEl.style.position = 'absolute';
      textEl.style.top = `${top.toFixed(3)}px`;
      textEl.style.transformOrigin = 'top left';
      textEl.dataset.gameTextMetricOffset = top.toFixed(3);
      textEl.dataset.gameTextVerticalMetric = verticalMetric();

      const transformParts: string[] = [];
      if (targetScale < 0.995) transformParts.push(`scale(${targetScale})`);
      const nextTransform = transformParts.length ? transformParts.join(' ') : 'none';

      if (currentTransform !== nextTransform) {
        currentTransform = nextTransform;
        textEl.style.transform = nextTransform;
      }

      // The clone is useful for choosing a scale, but the live element is the
      // authority for placement. Its width includes the browser's final font,
      // synthesized weight, letter spacing, padding, and transform. Positioning
      // from that width keeps every alignment on the same rendered geometry.
      const liveScaledWidth = textEl.getBoundingClientRect().width;
      const left = align() === 'right'
        ? rect.width - liveScaledWidth
        : align() === 'center'
        ? (rect.width - liveScaledWidth) / 2
        : 0;
      textEl.style.left = `${left.toFixed(3)}px`;

      textEl.dataset.gameTextScale = targetScale.toFixed(4);
      textEl.dataset.gameTextMode = mode;

      // Place against the real rendered line box (see verticalTopForMetric).
      const placed = verticalTopForMetric(
        textEl,
        container,
        style,
        props.text,
        verticalMetric(),
        verticalAlign(),
        targetScale,
      );
      if (placed !== null) {
        const liveScaledHeight = textEl.getBoundingClientRect().height;
        const boundedTop = Math.min(
          Math.max(0, rect.height - liveScaledHeight),
          Math.max(0, placed),
        );
        textEl.style.top = `${boundedTop.toFixed(3)}px`;
        textEl.dataset.gameTextMetricOffset = boundedTop.toFixed(3);
      }
    };

    applyMeasure();

    const observer = new ResizeObserver(applyMeasure);
    observer.observe(container);

    let disposed = false;
    void whenDocumentFontsAreReady().then(() => {
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
      class={`w-full h-full relative flex overflow-hidden pointer-events-none select-none ${verticalClass(verticalAlign())} ${horizontalClass(align())} ${props.class ?? ''}`}
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

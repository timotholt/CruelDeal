import { createEffect, onCleanup } from 'solid-js';
import { assertFontReady, resolveGameFontFace } from '../../services/fontManager';

// GameTextV3 — live-geometry fit engine.
//
// Design invariants (docs/font-manager-gametext-v3-spec.md):
// - The element that is measured IS the element that is painted. No hidden
//   clone, no document.body appends, no second source of geometric truth.
// - Fonts are boot-gated by services/fontManager.ts, so the first measurement
//   is final: there is no font-load re-measure path in this component.
// - `contain: strict` on the container firewalls every layout read/write to
//   this fixed-size subtree; fitting never invalidates page layout.
// - Static fit is applied as real font-size (native glyph rasterization),
//   never transform. Optical vertical correction uses position:relative
//   offsets, which are paint-only.

export type GameTextV3FitMode = 'single-line' | 'fixed-lines' | 'paragraph';
export type GameTextV3Align = 'left' | 'center' | 'right';
export type GameTextV3VerticalAlign = 'top' | 'center' | 'bottom';
export type GameTextV3VerticalMetric = 'line-box' | 'ink' | 'cap';

export interface GameTextV3Style {
  fontFamily?: string;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: string;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface GameTextV3Props {
  text: string;
  class?: string;
  baseFontSize: number;
  fitMode?: GameTextV3FitMode;
  maxLines?: number;
  minScale?: number;
  maxScale?: number;
  align?: GameTextV3Align;
  verticalAlign?: GameTextV3VerticalAlign;
  verticalMetric?: GameTextV3VerticalMetric;
  textStyle?: GameTextV3Style;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  skewFactor?: number;
  safetyScale?: number;
}

const defaultTextStyle: Required<GameTextV3Style> = {
  fontFamily: '"IBM Plex Sans Condensed", sans-serif',
  // IBM Plex Sans Condensed ships through weight 700. Requesting 900 silently
  // selected 700 anyway, so make the real painted face explicit.
  fontWeight: 700,
  fontStyle: 'italic',
  letterSpacing: '-0.05em',
  lineHeight: 0.95,
  textTransform: 'uppercase',
};

const resolvedStyle = (style?: GameTextV3Style): Required<GameTextV3Style> => ({
  fontFamily: style?.fontFamily ?? defaultTextStyle.fontFamily,
  fontWeight: style?.fontWeight ?? defaultTextStyle.fontWeight,
  fontStyle: style?.fontStyle ?? defaultTextStyle.fontStyle,
  letterSpacing: style?.letterSpacing ?? defaultTextStyle.letterSpacing,
  lineHeight: style?.lineHeight ?? defaultTextStyle.lineHeight,
  textTransform: style?.textTransform ?? defaultTextStyle.textTransform,
});

const resolvedMode = (text: string, maxLines: number, fitMode?: GameTextV3FitMode): GameTextV3FitMode => {
  if (fitMode) return fitMode;
  if (maxLines <= 1) return 'single-line';
  return text.includes('\n') ? 'fixed-lines' : 'paragraph';
};

const whiteSpaceForMode = (mode: GameTextV3FitMode) => (mode === 'paragraph' ? 'pre-wrap' : 'pre');
const displayForMode = (mode: GameTextV3FitMode) => (mode === 'single-line' ? 'block' : '-webkit-box');
const widthForMode = (mode: GameTextV3FitMode) => (mode === 'paragraph' ? '100%' : 'max-content');

// Italic glyphs overhang their advance widths; reserve room so the skewed
// extremes are neither clipped nor counted as overflow.
const inlinePaddingForStyle = (style: Required<GameTextV3Style>) => {
  if (style.fontStyle !== 'italic') return { start: '0', end: '0' };
  return { start: '0.16em', end: '0.28em' };
};

const transformedText = (text: string, transform: Required<GameTextV3Style>['textTransform']) => {
  if (transform === 'uppercase') return text.toLocaleUpperCase();
  if (transform === 'lowercase') return text.toLocaleLowerCase();
  return text;
};

const justifyForAlign = (align: GameTextV3Align) =>
  align === 'left' ? 'start' : align === 'right' ? 'end' : 'center';
const alignForVertical = (align: GameTextV3VerticalAlign) =>
  align === 'top' ? 'start' : align === 'bottom' ? 'end' : 'center';

let metricContext: CanvasRenderingContext2D | null | undefined;
const getMetricContext = () => {
  if (metricContext === undefined) metricContext = document.createElement('canvas').getContext('2d');
  return metricContext;
};

// Paint-only optical correction for single-line text. CSS grid has already
// aligned the element's line box; this returns the position:relative `top`
// offset that aligns the requested ink/cap box instead. Canvas metrics come
// from the same engine that painted the glyphs, and fonts are boot-gated, so
// this is exact — not an estimate needing later correction.
const opticalOffset = (
  textEl: HTMLElement,
  style: Required<GameTextV3Style>,
  text: string,
  metric: GameTextV3VerticalMetric,
  verticalAlign: GameTextV3VerticalAlign,
): number => {
  const context = getMetricContext();
  if (!context) return 0;
  const computed = getComputedStyle(textEl);
  const fontSize = Number.parseFloat(computed.fontSize);
  if (!fontSize) return 0;
  const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize;
  context.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  const fm = context.measureText(transformedText(text, style.textTransform) || ' ');
  const fontAscent = fm.fontBoundingBoxAscent || fontSize * 0.8;
  const fontDescent = fm.fontBoundingBoxDescent || fontSize * 0.2;
  // CSS line-box layout: baseline sits half-leading below the content-box top.
  const baselineFromTop = (lineHeight + fontAscent - fontDescent) / 2;
  // Uppercase labels have no descenders — cap-trim them.
  const useCap = metric === 'cap' || style.textTransform === 'uppercase';
  const ascent = useCap
    ? (context.measureText('H').actualBoundingBoxAscent || fm.actualBoundingBoxAscent || fontAscent)
    : (fm.actualBoundingBoxAscent || fontAscent);
  const descent = useCap ? 0 : (fm.actualBoundingBoxDescent || 0);
  const inkTop = baselineFromTop - ascent;
  const inkBottom = baselineFromTop + descent;
  const boxHeight = lineHeight;

  if (verticalAlign === 'top') return -inkTop;
  if (verticalAlign === 'bottom') return boxHeight - inkBottom;
  return boxHeight / 2 - (inkTop + inkBottom) / 2;
};

export const GameTextV3 = (props: GameTextV3Props) => {
  let containerRef: HTMLDivElement | undefined;
  let textRef: HTMLDivElement | undefined;

  const maxLines = () => Math.max(1, props.maxLines ?? 1);
  const minScale = () => props.minScale ?? 0.2;
  const maxScale = () => props.maxScale ?? 1;
  const align = () => props.align ?? 'center';
  const verticalAlign = () => props.verticalAlign ?? 'center';
  const fitMode = () => resolvedMode(props.text, maxLines(), props.fitMode);
  const verticalMetric = () => props.verticalMetric ?? (fitMode() === 'single-line' ? 'ink' : 'line-box');
  const skewFactor = () => props.skewFactor ?? 1;
  const textStyle = () => {
    const requested = resolvedStyle(props.textStyle);
    return {
      ...requested,
      ...resolveGameFontFace(requested.fontFamily, requested.fontWeight, requested.fontStyle),
    };
  };
  const renderedText = () => {
    if (fitMode() !== 'fixed-lines') return props.text;
    return props.text.split('\n').slice(0, maxLines()).join('\n');
  };

  createEffect(() => {
    const container = containerRef;
    const textEl = textRef;
    if (!container || !textEl) return;

    const style = textStyle();
    assertFontReady(style.fontFamily, style.fontWeight, style.fontStyle);

    const fit = () => {
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width * skewFactor();
      const containerHeight = rect.height;
      if (containerWidth <= 0 || containerHeight <= 0) return;

      const mode = fitMode();
      const safetyScale = props.safetyScale ?? (style.fontStyle === 'italic' ? 0.96 : 0.98);

      // Reset to base size so every fit starts from the same geometry.
      textEl.style.fontSize = `${props.baseFontSize}rem`;
      textEl.style.top = '0px';
      const basePx = Number.parseFloat(getComputedStyle(textEl).fontSize) || props.baseFontSize * 16;

      const measurements = () => {
        const r = textEl.getBoundingClientRect();
        const computed = getComputedStyle(textEl);
        return {
          width: Math.max(r.width, textEl.scrollWidth),
          height: Math.max(r.height, textEl.scrollHeight),
          lineHeight: Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) || 1,
        };
      };

      const fits = () => {
        const measured = measurements();
        // Paragraphs intentionally occupy the full container width so the
        // browser has a stable wrapping column. Their element box therefore
        // equals containerWidth even when the text is short; only scrollWidth
        // beyond that column is overflow. Applying safetyScale to the fixed
        // box made every paragraph fail, including at minScale.
        const allowedWidth = mode === 'paragraph'
          ? containerWidth
          : containerWidth * safetyScale;
        const allowedHeight = mode === 'paragraph'
          ? Math.min(containerHeight, measured.lineHeight * maxLines())
          : containerHeight;
        return measured.width <= allowedWidth + 0.5
          && measured.height <= allowedHeight + 1;
      };

      let scale: number;
      if (mode === 'paragraph') {
        // Wrapping is nonlinear in font size — binary-search the largest
        // fitting scale. Every probe is a scoped micro-layout of this subtree.
        const minimum = Math.min(minScale(), maxScale());
        const maximum = Math.max(minScale(), maxScale());
        let lo = minimum;
        let hi = maximum;
        textEl.style.fontSize = `${basePx * hi}px`;
        if (fits()) {
          scale = hi;
        } else {
          textEl.style.fontSize = `${basePx * lo}px`;
          if (!fits()) {
            // The content cannot fit even at the readability floor. Paint at
            // the floor and let maxLines/overflow clipping enforce the box.
            scale = lo;
          } else {
            for (let i = 0; i < 8; i += 1) {
              const mid = (lo + hi) / 2;
              textEl.style.fontSize = `${basePx * mid}px`;
              if (fits()) lo = mid;
              else hi = mid;
            }
            scale = lo;
          }
          textEl.style.fontSize = `${basePx * scale}px`;
        }
      } else {
        // Unwrapped text scales linearly with font size: one measurement at
        // base size determines the scale, one verify pass guards rounding.
        const measured = measurements();
        const scaleX = (containerWidth * safetyScale) / Math.max(measured.width, 1);
        const scaleY = containerHeight / Math.max(measured.height, 1);
        scale = Math.min(maxScale(), Math.max(minScale(), Math.min(scaleX, scaleY)));
        textEl.style.fontSize = `${basePx * scale}px`;
        if (!fits() && scale > minScale()) {
          const r2 = textEl.getBoundingClientRect();
          const shrink = Math.min(
            (containerWidth * safetyScale) / Math.max(r2.width, 1),
            containerHeight / Math.max(r2.height, 1),
            1,
          );
          scale = Math.max(minScale(), scale * shrink);
          textEl.style.fontSize = `${basePx * scale}px`;
        }
      }

      // Optical vertical correction (single-line only) — paint-only offset.
      if (mode === 'single-line' && verticalMetric() !== 'line-box') {
        const offset = opticalOffset(textEl, style, props.text, verticalMetric(), verticalAlign());
        // Keep the shifted rect inside the container so trimming never reads
        // as overflow.
        const elRect = textEl.getBoundingClientRect();
        const slackTop = rect.top - elRect.top;
        const slackBottom = rect.bottom - elRect.bottom;
        textEl.style.top = `${Math.min(Math.max(offset, slackTop), Math.max(slackBottom, slackTop)).toFixed(3)}px`;
      }

      textEl.dataset.gameTextScale = scale.toFixed(4);
      textEl.dataset.gameTextMode = mode;
    };

    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(container);
    onCleanup(() => observer.disconnect());
  });

  const style = () => textStyle();
  const mode = () => fitMode();
  const inlinePadding = () => inlinePaddingForStyle(style());

  return (
    <div
      ref={(el) => { containerRef = el; }}
      data-game-text="container"
      data-game-text-version="3"
      class={`w-full h-full relative pointer-events-none select-none ${props.class ?? ''}`}
      style={{
        display: 'grid',
        contain: 'strict',
        'justify-items': justifyForAlign(align()),
        'align-items': alignForVertical(verticalAlign()),
      }}
    >
      <div
        ref={(el) => { textRef = el; }}
        data-game-text="inner"
        data-game-text-version="3"
        data-game-text-mode={mode()}
        data-game-text-scale="1.0000"
        lang={props.lang}
        dir={props.dir ?? 'auto'}
        style={{
          position: 'relative',
          'box-sizing': 'border-box',
          display: displayForMode(mode()),
          width: widthForMode(mode()),
          'max-width': '100%',
          'min-width': '0',
          'min-height': '0',
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
          overflow: mode() === 'single-line' ? 'visible' : 'hidden',
          'padding-inline-start': inlinePadding().start,
          'padding-inline-end': inlinePadding().end,
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': maxLines(),
        }}
      >
        {renderedText()}
      </div>
    </div>
  );
};

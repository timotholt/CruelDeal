import { JSX, Match, Switch } from 'solid-js';
import {
  GameTextV3,
  type GameTextV3Align,
  type GameTextV3Style,
  type GameTextV3VerticalAlign,
  type GameTextV3VerticalMetric,
} from '../GameTextV3';
import { ScaleToFit } from '../ScaleToFit';

// Two orthogonal axes folded into one enum:
//   markup: raw (literal) vs cooked (parsed via richText)
//   sizing: flow (browser line box) vs fit (autoscale)
// raw      = literal + flow      rich     = cooked + flow
// fit      = literal + glyph-fit rich-fit = cooked + box-fit (ScaleToFit)
export type MaterialTextRenderMode = 'raw' | 'rich' | 'fit' | 'rich-fit';
export type MaterialTextFitMode = 'single-line' | 'fixed-lines' | 'paragraph';

export interface MaterialTextFitOptions {
  baseFontSize: number;
  minScale?: number;
  maxScale?: number;
  align?: GameTextV3Align;
  verticalAlign?: GameTextV3VerticalAlign;
  verticalMetric?: GameTextV3VerticalMetric;
  textStyle?: GameTextV3Style;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  safetyScale?: number;
}

export const MaterialTextContent = (props: {
  text: string;
  renderMode?: MaterialTextRenderMode;
  fitMode?: MaterialTextFitMode;
  maxLines?: number;
  fit?: MaterialTextFitOptions;
  class?: string;
  style?: JSX.CSSProperties;
  richText?: (value: string) => JSX.Element;
}) => {
  const renderMode = () => props.renderMode ?? 'raw';
  const fitMode = () => props.fitMode ?? (props.maxLines && props.maxLines > 1 ? 'paragraph' : 'single-line');

  return (
    <span
      class={`material-text-content material-text-content--${renderMode()} ${props.class ?? ''}`}
      data-material-text-render={renderMode()}
      data-material-text-fit={fitMode()}
      data-material-text-lines={props.maxLines ?? 1}
      style={props.style}
    >
      <Switch>
        <Match when={renderMode() === 'fit' && props.fit}>
          {(fit) => (
            <GameTextV3
              text={props.text}
              baseFontSize={fit().baseFontSize}
              minScale={fit().minScale}
              maxScale={fit().maxScale}
              fitMode={fitMode()}
              maxLines={props.maxLines}
              align={fit().align}
              verticalAlign={fit().verticalAlign}
              verticalMetric={fit().verticalMetric}
              textStyle={fit().textStyle}
              lang={fit().lang}
              dir={fit().dir}
              safetyScale={fit().safetyScale}
            />
          )}
        </Match>
        <Match when={renderMode() === 'rich-fit'}>
          <ScaleToFit
            align={props.fit?.align ?? 'center'}
            verticalAlign={props.fit?.verticalAlign ?? 'center'}
            maxScale={props.fit?.maxScale}
            minScale={props.fit?.minScale}
          >
            {props.richText?.(props.text) ?? props.text}
          </ScaleToFit>
        </Match>
        <Match when={renderMode() === 'rich'}>
          {props.richText?.(props.text) ?? props.text}
        </Match>
        <Match when={true}>
          {props.text}
        </Match>
      </Switch>
    </span>
  );
};

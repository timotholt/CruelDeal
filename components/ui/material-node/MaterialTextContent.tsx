import { JSX, Match, Switch } from 'solid-js';

export type MaterialTextRenderMode = 'raw' | 'rich' | 'fit';
export type MaterialTextFitMode = 'single-line' | 'fixed-lines' | 'paragraph';

export const MaterialTextContent = (props: {
  text: string;
  renderMode?: MaterialTextRenderMode;
  fitMode?: MaterialTextFitMode;
  maxLines?: number;
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

import { JSX, Match, Show, Switch } from 'solid-js';
import { resolveMaterialNodeContent } from './MaterialNodeBindings';
import { MaterialTextContent } from './MaterialTextContent';
import type { MaterialNodeRecipe, MaterialNodeRenderContext } from './MaterialNodeTypes';

export const MaterialNodeContentRenderer = (props: {
  node: MaterialNodeRecipe;
  context: MaterialNodeRenderContext;
  // When this content shares a flex column with sibling child nodes, fill the
  // remaining space and clip overflow (standard flexbox) so siblings stay visible.
  fill?: boolean;
}) => {
  const content = () => resolveMaterialNodeContent(props.node, props.context);
  const text = () => content().text ?? '';
  const mode = () => props.node.content?.mode ?? (props.node.kind === 'media' ? 'media' : 'plain');
  const textStyle = (): JSX.CSSProperties => (props.fill
    ? { flex: '1 1 0', 'min-height': '0', overflow: 'hidden', ...(props.node.content?.style ?? {}) }
    : (props.node.content?.style ?? {}));

  return (
    <Switch>
      <Match when={mode() === 'none'}>{null}</Match>
      <Match when={mode() === 'icon'}>
        {content().icon}
      </Match>
      <Match when={mode() === 'media'}>
        <Show when={content().mediaSrc}>
          {(src) => <img src={src()} alt={content().mediaAlt ?? ''} draggable={false} />}
        </Show>
      </Match>
      <Match when={mode() === 'rich'}>
        <MaterialTextContent
          text={text()}
          renderMode="rich"
          fitMode={props.node.content?.fitMode}
          maxLines={props.node.content?.maxLines}
          fit={props.node.content?.fit}
          class={props.node.content?.className}
          style={textStyle()}
          richText={props.node.content?.richText}
        />
      </Match>
      <Match when={true}>
        <MaterialTextContent
          text={text()}
          renderMode={props.node.content?.textRender ?? 'raw'}
          fitMode={props.node.content?.fitMode}
          maxLines={props.node.content?.maxLines}
          fit={props.node.content?.fit}
          class={props.node.content?.className}
          style={textStyle()}
          richText={props.node.content?.richText}
        />
      </Match>
    </Switch>
  );
};

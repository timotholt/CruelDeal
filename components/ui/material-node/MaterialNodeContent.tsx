import { Match, Show, Switch } from 'solid-js';
import { resolveMaterialNodeContent } from './MaterialNodeBindings';
import { MaterialTextContent } from './MaterialTextContent';
import type { MaterialNodeRecipe, MaterialNodeRenderContext } from './MaterialNodeTypes';

export const MaterialNodeContentRenderer = (props: {
  node: MaterialNodeRecipe;
  context: MaterialNodeRenderContext;
}) => {
  const content = () => resolveMaterialNodeContent(props.node, props.context);
  const text = () => content().text ?? '';
  const mode = () => props.node.content?.mode ?? (props.node.kind === 'media' ? 'media' : 'plain');

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
          style={props.node.content?.style}
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
          style={props.node.content?.style}
        />
      </Match>
    </Switch>
  );
};

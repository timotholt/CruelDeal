import { Match, Show, Switch } from 'solid-js';
import { resolveMaterialNodeContent } from './MaterialNodeBindings';
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
        {props.node.content?.richText?.(text()) ?? text()}
      </Match>
      <Match when={true}>
        {text()}
      </Match>
    </Switch>
  );
};

import { For } from 'solid-js';
import { MaterialNodeRenderer } from './MaterialNodeRenderer';
import type { MaterialNodeRecipe, MaterialNodeRenderContext } from './MaterialNodeTypes';

export const MaterialNodeButtonBar = (props: {
  nodes: MaterialNodeRecipe[];
  context: MaterialNodeRenderContext;
  class?: string;
}) => (
  <div class={props.class}>
    <For each={props.nodes}>
      {(node) => <MaterialNodeRenderer node={node} context={props.context} />}
    </For>
  </div>
);

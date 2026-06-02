import { For, Show } from 'solid-js';
import { MaterialNodeContentRenderer } from './MaterialNodeContent';
import { MaterialNodeFrame } from './MaterialNodeFrame';
import { MaterialNodeSurface } from './MaterialNodeSurface';
import type { MaterialNodeRecipe, MaterialNodeRenderContext, MaterialNodeRole } from './MaterialNodeTypes';

const roleForNode = (node: MaterialNodeRecipe): MaterialNodeRole => {
  if (node.role) return node.role;
  if (node.kind === 'button') return 'momentary';
  if (node.kind === 'container') return 'container';
  if (node.kind === 'text') return 'text';
  return 'static';
};

export const MaterialNodeRenderer = (props: {
  node: MaterialNodeRecipe;
  context: MaterialNodeRenderContext;
}) => {
  const role = () => roleForNode(props.node);
  const targetId = () => props.context.targetIdForNode?.(props.node) ?? `${props.context.treeId}:${props.node.id}`;
  const visualState = () => props.context.previewStateForNode?.(props.node, role()) ?? 'rest';
  const frameClass = () => [
    'material-node',
    `material-node--${props.node.kind}`,
    props.node.layout?.className,
    props.context.classForNode?.(props.node, role()),
    props.context.selectedClassForNode?.(props.node),
  ].filter(Boolean).join(' ');
  const surfaceClass = () => props.context.surfaceClassForNode?.(props.node, role()) ?? '';

  return (
    <MaterialNodeFrame node={props.node} role={role()} targetId={targetId()} class={frameClass()}>
      <MaterialNodeSurface
        node={props.node}
        role={role()}
        visualState={visualState()}
        context={props.context}
        class={surfaceClass()}
      >
        <Show when={props.node.content && props.node.content.mode !== 'none'}>
          <MaterialNodeContentRenderer node={props.node} context={props.context} />
        </Show>
        <For each={props.node.children || []}>
          {(child) => <MaterialNodeRenderer node={child} context={props.context} />}
        </For>
      </MaterialNodeSurface>
    </MaterialNodeFrame>
  );
};

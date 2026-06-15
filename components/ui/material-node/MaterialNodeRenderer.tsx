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
  const childStackClass = () => props.context.childStackClassForNode?.(props.node, role());
  const surfaceClass = () => props.context.surfaceClassForNode?.(props.node, role()) ?? '';
  const hasChildren = () => (props.node.children?.length ?? 0) > 0;
  const showContent = () => props.node.content && props.node.content.mode !== 'none';
  const renderedChildren = () => (
    <>
      <Show when={showContent()}>
        <MaterialNodeContentRenderer node={props.node} context={props.context} fill />
      </Show>
      <For each={props.node.children || []}>
        {(child) => <MaterialNodeRenderer node={child} context={props.context} />}
      </For>
    </>
  );

  return (
    <MaterialNodeFrame node={props.node} role={role()} targetId={targetId()} class={frameClass()}>
      <Show
        when={hasChildren()}
        fallback={(
          // Leaf: the surface wraps the content (text/button box).
          <MaterialNodeSurface
            node={props.node}
            role={role()}
            visualState={visualState()}
            context={props.context}
            class={surfaceClass()}
          >
            <Show when={showContent()}>
              <MaterialNodeContentRenderer node={props.node} context={props.context} />
            </Show>
          </MaterialNodeSurface>
        )}
      >
        {/* Container: surface is an absolute background; content + children are laid out
            by THIS frame, so their %/absolute positions resolve against the frame box. */}
        <Show when={props.node.surface}>
          <MaterialNodeSurface
            node={props.node}
            role={role()}
            visualState={visualState()}
            context={props.context}
            class={surfaceClass()}
            asBackground
          />
        </Show>
        <Show when={childStackClass()} fallback={renderedChildren()}>
          {(stackClass) => (
            <div class={stackClass()}>
              {renderedChildren()}
            </div>
          )}
        </Show>
      </Show>
    </MaterialNodeFrame>
  );
};

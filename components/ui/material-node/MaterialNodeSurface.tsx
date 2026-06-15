import { children, JSX, Match, Switch } from 'solid-js';
import {
  MaterialSurfaceHost,
  materialRecipeToInteractiveSurfaceProps,
  materialRecipeToStaticSurfaceProps,
  materialRecipeToSurfaceProps,
  type MaterialRecipeState,
} from '../material-lab';
import type { MaterialNodeRecipe, MaterialNodeRenderContext, MaterialNodeRole } from './MaterialNodeTypes';

export const materialNodeSurfaceProps = (
  node: MaterialNodeRecipe,
  role: MaterialNodeRole,
  visualState: MaterialRecipeState = 'rest',
) => {
  if (!node.surface) return {};
  return role === 'static' || role === 'container' || role === 'text'
    ? materialRecipeToStaticSurfaceProps(node.surface)
    : materialRecipeToSurfaceProps(node.surface, visualState);
};

export const materialNodeButtonProps = (
  node: MaterialNodeRecipe,
  _role: MaterialNodeRole,
  visualState: Exclude<MaterialRecipeState, 'hover'> = 'rest',
) => {
  if (!node.surface) return {};
  return materialRecipeToInteractiveSurfaceProps(node.surface, visualState);
};

export const MaterialNodeSurface = (props: {
  node: MaterialNodeRecipe;
  role: MaterialNodeRole;
  visualState: MaterialRecipeState;
  context: MaterialNodeRenderContext;
  class?: string;
  // When true, render the panel as an absolute background layer that fills the parent
  // frame (no children). Used by the two-layer container render so children are laid
  // out by the frame, not nested inside the surface.
  asBackground?: boolean;
  children?: JSX.Element;
}) => {
  const surfaceProps = () => props.context.surfacePropsForNode?.(props.node, props.role, props.visualState)
    ?? materialNodeSurfaceProps(props.node, props.role, props.visualState);
  const buttonProps = () => props.context.buttonPropsForNode?.(props.node, props.role, props.visualState)
    ?? materialNodeButtonProps(props.node, props.role, props.visualState === 'hover' ? 'rest' : props.visualState);
  const resolvedChildren = children(() => props.children);

  return (
    <Switch>
      <Match when={props.asBackground}>
        <MaterialSurfaceHost
          kind="panel"
          surfaceProps={surfaceProps()}
          padded={false}
          class={props.class}
          rootProps={{ style: { position: 'absolute', inset: '0', width: '100%', height: '100%', 'z-index': '0' } }}
        />
      </Match>
      <Match when={props.node.kind === 'button'}>
        <MaterialSurfaceHost
          kind="button"
          surfaceProps={buttonProps()}
          buttonType="button"
          buttonSize={props.context.buttonSizeForNode?.(props.node)}
          buttonFullWidth={props.context.buttonFullWidthForNode?.(props.node) ?? false}
          class={props.class}
          onClick={() => props.context.onNodeAction?.(props.node)}
          onPointerDown={(event) => props.context.onPointerDown?.(props.node, event)}
          onPointerUp={(event) => props.context.onPointerUp?.(props.node, event)}
          onPointerLeave={(event) => props.context.onPointerUp?.(props.node, event)}
          onPointerCancel={(event) => props.context.onPointerUp?.(props.node, event)}
          label={resolvedChildren()}
        />
      </Match>
      <Match when={props.node.kind === 'text' && !props.node.surface}>
        {resolvedChildren()}
      </Match>
      <Match when={props.node.kind === 'media' && !props.node.surface}>
        {resolvedChildren()}
      </Match>
      <Match when={props.node.kind === 'slot'}>
        {resolvedChildren()}
      </Match>
      <Match when={props.node.kind !== 'slot'}>
        <MaterialSurfaceHost
          kind="panel"
          surfaceProps={surfaceProps()}
          padded={false}
          class={props.class}
        >
          {resolvedChildren()}
        </MaterialSurfaceHost>
      </Match>
      <Match when={true}>
        {null}
      </Match>
    </Switch>
  );
};

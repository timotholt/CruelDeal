import { For, JSX, Match, Show, Switch } from 'solid-js';
import { MaterialSurfaceHost } from './MaterialSurfaceHost';
import { surfaceKindForType, uiLayoutToStyle } from './uiNodePresenter';
import type { UiActionPayload, UiNodePayload } from './uiNodeValidate';

// Host-supplied resolvers, keyed by the string ids carried in the payload.
// The wire sends intent (binding/action/icon ids); the client owns the values
// and handlers. Everything optional so a bare tree still renders structurally.
export interface UiNodeRenderContext {
  resolveBinding?: (binding: string, node: UiNodePayload) => JSX.Element | string | number | undefined;
  resolveImageSrc?: (node: UiNodePayload) => string | undefined;
  resolveImageAlt?: (node: UiNodePayload) => string | undefined;
  onAction?: (action: UiActionPayload, node: UiNodePayload) => void;
}

const nodeContent = (node: UiNodePayload, context?: UiNodeRenderContext): JSX.Element => {
  if (node.contentBinding && context?.resolveBinding) {
    const resolved = context.resolveBinding(node.contentBinding, node);
    if (resolved !== undefined) return resolved as JSX.Element;
  }
  return node.text ?? null;
};

/**
 * Render a validated UiNodePayload tree into the unified surface. Pure
 * interpreter: payload -> (surface kind, props, layout, content, action).
 * Assumes the payload was already validated by validateUiNode().
 */
export const UiNode = (props: { node: UiNodePayload; context?: UiNodeRenderContext }) => {
  const node = () => props.node;
  const kind = () => surfaceKindForType(node().type, !!node().surface);
  const style = () => uiLayoutToStyle(node().layout);
  const content = () => nodeContent(node(), props.context);
  const children = () => (
    <For each={node().children ?? []}>
      {(child) => <UiNode node={child} context={props.context} />}
    </For>
  );

  return (
    <div class={`ui-node ui-node--${node().type}`} data-ui-node-id={node().id} style={style()}>
      <Switch>
        <Match when={node().type === 'image'}>
          <Show when={props.context?.resolveImageSrc?.(node())}>
            {(src) => <img src={src()} alt={props.context?.resolveImageAlt?.(node()) ?? ''} draggable={false} />}
          </Show>
          {children()}
        </Match>
        <Match when={kind() === 'button'}>
          <MaterialSurfaceHost
            kind="button"
            surfaceProps={node().surface}
            label={content()}
            onClick={() => {
              const action = node().action;
              if (action) props.context?.onAction?.(action, node());
            }}
          />
        </Match>
        <Match when={kind() === 'panel'}>
          <MaterialSurfaceHost kind="panel" surfaceProps={node().surface} padded={false}>
            {content()}
            {children()}
          </MaterialSurfaceHost>
        </Match>
        <Match when={true}>
          {content()}
          {children()}
        </Match>
      </Switch>
    </div>
  );
};

/** Functional entry point mirroring the server-driven plan's renderUiNodeToSolid. */
export const renderUiNodeToSolid = (node: UiNodePayload, context?: UiNodeRenderContext): JSX.Element => (
  <UiNode node={node} context={context} />
);

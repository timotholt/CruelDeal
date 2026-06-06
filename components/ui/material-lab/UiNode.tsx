import { createMemo, createSignal, For, JSX, Match, Show, Switch } from 'solid-js';
import { MaterialSurfaceHost } from './MaterialSurfaceHost';
import { resolveSurfaceForMaterial } from './skinRegistry';
import { computeSurfaceStateVars } from './surfaceStateVars';
import { surfaceKindForType, uiLayoutToStyle } from './uiNodePresenter';
import type { UiActionPayload, UiNodePayload } from './uiNodeValidate';

// Host-supplied resolvers, keyed by the string ids carried in the payload.
// The wire sends intent (binding/action/icon ids); the client owns the values
// and handlers. Everything optional so a bare tree still renders structurally.
export interface UiNodeRenderContext {
  resolveBinding?: (binding: string, node: UiNodePayload) => JSX.Element | string | number | undefined;
  renderRichText?: (value: string, node: UiNodePayload) => JSX.Element;
  resolveActionParams?: (binding: string, node: UiNodePayload) => Record<string, string | number | boolean> | undefined;
  resolveActionTarget?: (binding: string, node: UiNodePayload) => UiActionPayload['target'] | undefined;
  resolveImageSrc?: (node: UiNodePayload) => string | undefined;
  resolveImageAlt?: (node: UiNodePayload) => string | undefined;
  onAction?: (action: UiActionPayload, node: UiNodePayload) => void;
}

const nodeContent = (node: UiNodePayload, context?: UiNodeRenderContext): JSX.Element => {
  const renderValue = (value: JSX.Element | string | number): JSX.Element => {
    if (typeof value !== 'string') return value as JSX.Element;
    const mode = node.contentMode ?? 'plain';
    const hasMarkup = /\[[a-z0-9/]+\]|\[(?:RULE|DIVIDER)\]/i.test(value);
    if ((mode === 'rich' || (mode === 'auto' && hasMarkup)) && context?.renderRichText) {
      return context.renderRichText(value, node);
    }
    return value;
  };

  if (node.contentBinding && context?.resolveBinding) {
    const resolved = context.resolveBinding(node.contentBinding, node);
    if (resolved !== undefined) return renderValue(resolved);
  }
  return node.text !== undefined ? renderValue(node.text) : null;
};

const resolveAction = (
  action: UiActionPayload,
  node: UiNodePayload,
  context?: UiNodeRenderContext,
): UiActionPayload => ({
  ...action,
  params: {
    ...(action.params || {}),
    ...(action.paramsBinding && context?.resolveActionParams
      ? context.resolveActionParams(action.paramsBinding, node) || {}
      : {}),
  },
  target: action.targetBinding && context?.resolveActionTarget
    ? context.resolveActionTarget(action.targetBinding, node) || action.target
    : action.target,
});

/**
 * Render a validated UiNodePayload tree into the unified surface. Pure
 * interpreter: payload -> (surface kind, props, layout, content, action).
 * Assumes the payload was already validated by validateUiNode().
 */
export const UiNode = (props: { node: UiNodePayload; context?: UiNodeRenderContext }) => {
  const [stateOpen, setStateOpen] = createSignal(false);
  const node = () => props.node;
  const style = () => uiLayoutToStyle(node().layout);
  const content = () => nodeContent(node(), props.context);
  const togglesActiveState = () => node().stateModel === 'selectable' || node().stateModel === 'disclosure';
  const surfaceProps = createMemo(() => {
    const resolved = resolveSurfaceForMaterial({ materialId: node().materialId, skinId: node().skinId });
    const base = resolved || node().surface
      ? { ...(resolved || {}), ...(node().surface || {}) }
      : undefined;
    if (!base) return undefined;
    const active = togglesActiveState() && stateOpen();
    const stateVars = computeSurfaceStateVars(base, node().surfaceStates);
    const mergedStateVars = { ...(base.stateVars || {}), ...stateVars };
    return {
      ...base,
      stateVars: Object.keys(mergedStateVars).length > 0 ? mergedStateVars : undefined,
      selected: active || base.selected,
      visualState: active ? 'active' : base.visualState,
    };
  });
  const kind = () => surfaceKindForType(node().type, !!surfaceProps());
  const children = () => (
    <For each={node().children ?? []}>
      {(child) => <UiNode node={child} context={props.context} />}
    </For>
  );

  return (
    <div
      class={`ui-node ui-node--${node().type}`}
      data-ui-node-id={node().id}
      data-ui-node-h-mode={node().layout?.hMode}
      style={style()}
    >
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
            surfaceProps={surfaceProps()}
            buttonSize="sm"
            buttonFullWidth
            label={content()}
            onClick={() => {
              if (togglesActiveState()) setStateOpen((open) => !open);
              const action = node().action;
              if (action) props.context?.onAction?.(resolveAction(action, node(), props.context), node());
            }}
          />
        </Match>
        <Match when={kind() === 'panel'}>
          <MaterialSurfaceHost kind="panel" surfaceProps={surfaceProps()} padded={false}>
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

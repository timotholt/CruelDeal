import { For, JSX, Show } from 'solid-js';
import {
  MaterialSurfaceHost,
  type MaterialRecipeState,
  type SurfaceOptions,
} from '../../ui/material-lab';
import {
  MaterialTextContent,
  type MaterialTextFitOptions,
  type MaterialTextFitMode,
} from '../../ui/material-node';
import type { PreviewTargetRole } from './mainMaterialInteractionModel';
import type { FeedCardNode } from './mainMaterialFeedModel';
import { FeedNodeFrame, type CssEmissionProbe } from './mainMaterialFeedFrame';

export interface ChromeFeedNodeRenderContext {
  targetIdForNode: (node: FeedCardNode) => string;
  previewStateForNode: (node: FeedCardNode, role: PreviewTargetRole) => MaterialRecipeState;
  roleForNode?: (node: FeedCardNode) => PreviewTargetRole;
  surfacePropsForNode?: (node: FeedCardNode, role: PreviewTargetRole, visualState: MaterialRecipeState) => SurfaceOptions | undefined;
  buttonPropsForNode?: (node: FeedCardNode, role: PreviewTargetRole, visualState: MaterialRecipeState) => SurfaceOptions;
  iconForNode?: (node: FeedCardNode, role: PreviewTargetRole) => JSX.Element | undefined;
  iconPositionForNode?: (node: FeedCardNode, role: PreviewTargetRole) => 'left' | 'right' | 'top' | undefined;
  classForNode?: (node: FeedCardNode, role: PreviewTargetRole) => string;
  surfaceClassForNode?: (node: FeedCardNode, role: PreviewTargetRole) => string;
  selectedClassForNode?: (node: FeedCardNode) => string;
  textForNode?: (node: FeedCardNode) => string;
  labelForNode?: (node: FeedCardNode) => JSX.Element | undefined;
  textFitForNode?: (node: FeedCardNode) => MaterialTextFitOptions | undefined;
  fitModeForNode?: (node: FeedCardNode) => MaterialTextFitMode;
  maxLinesForNode?: (node: FeedCardNode) => number;
  onNodeAction?: (node: FeedCardNode) => void;
}

export const ChromeFeedNodeTree = (props: {
  node: FeedCardNode;
  context: ChromeFeedNodeRenderContext;
  cssProbe?: CssEmissionProbe;
}) => {
  const nodeRole = (): PreviewTargetRole => props.context.roleForNode?.(props.node) ?? (props.node.type === 'button' ? 'momentary' : props.node.type === 'container' ? 'container' : 'text');
  const targetId = () => props.context.targetIdForNode(props.node);
  const visualState = () => props.context.previewStateForNode(props.node, nodeRole());
  const targetClass = () => [
    props.context.classForNode?.(props.node, nodeRole()),
    props.context.selectedClassForNode?.(props.node),
  ].filter(Boolean).join(' ');
  const surfaceClass = () => props.context.surfaceClassForNode?.(props.node, nodeRole()) || '';
  const text = () => props.context.textForNode?.(props.node) || '';
  const fittedChromeText = () => (
    <MaterialTextContent
      text={text()}
      renderMode="fit"
      fitMode={props.context.fitModeForNode?.(props.node) || 'single-line'}
      maxLines={props.context.maxLinesForNode?.(props.node) || 1}
      fit={props.context.textFitForNode?.(props.node)}
      class="main-material-chrome-node-label"
    />
  );
  const label = () => props.context.labelForNode?.(props.node) ?? fittedChromeText();

  return (
    <Show
      when={props.node.type === 'button'}
      fallback={(
        <Show
          when={props.node.type === 'text'}
          fallback={(
            <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
              <Show when={props.context.surfacePropsForNode?.(props.node, nodeRole(), visualState())}>
                {(surfaceProps) => (
                  <MaterialSurfaceHost
                    kind="panel"
                    surfaceProps={surfaceProps()}
                    padded={false}
                    class={`main-material-card-node-surface main-material-card-node-surface--background ${surfaceClass()}`}
                  />
                )}
              </Show>
              <div class="main-material-card-node-flow-stack">
                <For each={props.node.children || []}>
                  {(child) => <ChromeFeedNodeTree node={child} context={props.context} cssProbe={props.cssProbe} />}
                </For>
              </div>
            </FeedNodeFrame>
          )}
        >
          <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
            {fittedChromeText()}
          </FeedNodeFrame>
        </Show>
      )}
    >
      <FeedNodeFrame node={props.node} targetId={targetId()} role={nodeRole()} targetClass={targetClass()} cssProbe={props.cssProbe}>
        <MaterialSurfaceHost
          kind="button"
          surfaceProps={props.context.buttonPropsForNode?.(props.node, nodeRole(), visualState())}
          buttonSize="sm"
          buttonFullWidth
          icon={props.context.iconForNode?.(props.node, nodeRole())}
          iconPosition={props.context.iconPositionForNode?.(props.node, nodeRole())}
          class={`main-material-card-node-surface main-material-card-node-surface--button ${surfaceClass()}`}
          label={label()}
          onClick={() => props.context.onNodeAction?.(props.node)}
        />
      </FeedNodeFrame>
    </Show>
  );
};

import {
  createMaterialButtonEmissionPlan,
  createMaterialPanelEmissionPlan,
  measureEmissionPlan,
  serializeEmissionPlanCss,
  serializeEmissionPlanHtml,
  type EmissionMetrics,
  type EmittedLayer,
  type MaterialEmissionPlan,
  type MaterialRecipe,
  type MaterialRecipeState,
  type SurfaceOptions,
} from '../../ui/material-lab';
import { parseFeedMaterialTargetId } from './materialTargetIds';

export type MainMaterialExportTargetKind =
  | 'feed-button'
  | 'feed-panel'
  | 'workbench-button'
  | 'workbench-panel';

export interface MainMaterialExportNode {
  id: string;
  type: string;
  binding?: string;
  sizing?: 'auto' | 'fit' | 'flow';
  textRender?: 'auto' | 'rich' | 'fit' | 'raw';
  children?: MainMaterialExportNode[];
}

export interface MainMaterialExportFeedCardType<TNode extends MainMaterialExportNode = MainMaterialExportNode> {
  id: string;
  surface?: MaterialRecipe;
  children: TNode[];
}

export interface MainMaterialExportFeedStory {
  id: string;
  cardTypeId: string;
}

export interface MainMaterialGenericExportTarget {
  kind: 'button' | 'panel';
  recipe: MaterialRecipe;
  text?: string;
  className?: string;
  fullWidth?: boolean;
}

export interface MainMaterialExportPlannerContext<
  TNode extends MainMaterialExportNode = MainMaterialExportNode,
  TCardType extends MainMaterialExportFeedCardType<TNode> = MainMaterialExportFeedCardType<TNode>,
  TStory extends MainMaterialExportFeedStory = MainMaterialExportFeedStory,
> {
  selectedFeedStoryId: string;
  feedStories: TStory[];
  feedCardTypes: Record<string, TCardType | undefined>;
  fallbackStory: TStory;
  selectedState: MaterialRecipeState;
  surfaceRecipeForNode: (cardType: TCardType, node: TNode) => MaterialRecipe;
  surfacePropsForRecipe: (recipe: MaterialRecipe, state: MaterialRecipeState) => SurfaceOptions;
  textForNode: (story: TStory, node: TNode) => string;
  genericTargets?: Record<string, MainMaterialGenericExportTarget | undefined>;
}

export interface MainMaterialExportResult {
  kind: MainMaterialExportTargetKind;
  plan: MaterialEmissionPlan;
  html: string;
  css: string;
  metrics: EmissionMetrics;
}

const findExportNodeById = <TNode extends MainMaterialExportNode>(
  nodes: TNode[],
  nodeId: string,
): TNode | undefined => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findExportNodeById((node.children || []) as TNode[], nodeId);
    if (child) return child;
  }
  return undefined;
};

const cssIdentifier = (className: string) => className.replace(/([^a-zA-Z0-9_-])/g, '\\$1');

const fallbackEmissionCssRules = (plan: MaterialEmissionPlan) => {
  if (plan.cssRules?.length) return plan.cssRules;
  const styleEntries = Object.entries(plan.host.style || {}).filter(([, value]) => (
    value !== undefined && value !== null && value !== false && value !== ''
  ));
  if (!styleEntries.length) return [];
  const productClasses = plan.host.classNames?.filter((className) => className.startsWith('main-material-')) || [];
  const selectorClass = productClasses.at(-1)
    || plan.host.classNames?.find((className) => className === 'cd-button' || className === 'cd-panel')
    || plan.host.classNames?.[0];
  if (!selectorClass) return [];
  const declarations = styleEntries.map(([key, value]) => `  ${key}: ${value};`).join('\n');
  return [`.${cssIdentifier(selectorClass)} {\n${declarations}\n}`];
};

const createExportResult = (
  kind: MainMaterialExportTargetKind,
  plan: MaterialEmissionPlan,
): MainMaterialExportResult => {
  const planWithCss = {
    ...plan,
    cssRules: fallbackEmissionCssRules(plan),
  };
  return {
    kind,
    plan: planWithCss,
    html: serializeEmissionPlanHtml(planWithCss),
    css: serializeEmissionPlanCss(planWithCss),
    metrics: measureEmissionPlan(planWithCss),
  };
};

export const createMainMaterialExportPlan = <
  TNode extends MainMaterialExportNode,
  TCardType extends MainMaterialExportFeedCardType<TNode>,
  TStory extends MainMaterialExportFeedStory,
>(
  targetId: string,
  context: MainMaterialExportPlannerContext<TNode, TCardType, TStory>,
): MainMaterialExportResult | null => {
  const genericTarget = context.genericTargets?.[targetId];
  if (genericTarget) {
    const surfaceProps = context.surfacePropsForRecipe(genericTarget.recipe, context.selectedState);
    if (genericTarget.kind === 'button') {
      const plan = createMaterialButtonEmissionPlan({
        ...surfaceProps,
        size: 'sm',
        fullWidth: genericTarget.fullWidth ?? true,
        className: genericTarget.className,
        renderMode: 'export',
      }, genericTarget.text || '', 'export');
      return createExportResult('workbench-button', plan);
    }

    const plan = createMaterialPanelEmissionPlan({
      ...surfaceProps,
      padded: false,
      className: genericTarget.className,
      renderMode: 'export',
    }, genericTarget.text || '', 'export');
    return createExportResult('workbench-panel', plan);
  }

  const target = parseFeedMaterialTargetId(targetId);
  if (!target) return null;

  const cardType = context.feedCardTypes[target.cardTypeId];
  if (!cardType) return null;

  const story = context.feedStories.find((item) => item.id === context.selectedFeedStoryId)
    || context.feedStories.find((item) => item.cardTypeId === target.cardTypeId)
    || context.feedStories[0]
    || context.fallbackStory;
  if (!target.nodeId) {
    if (!cardType.surface) return null;
    const surfaceProps = context.surfacePropsForRecipe(cardType.surface, context.selectedState);
    const plan = createMaterialPanelEmissionPlan({
      ...surfaceProps,
      padded: false,
      className: 'main-material-card-node-surface main-material-card-node-surface--background main-material-card-node-surface--slide',
      renderMode: 'export',
    }, '', 'export');
    return createExportResult('feed-panel', plan);
  }

  const node = findExportNodeById(cardType.children, target.nodeId);
  if (!node) return null;

  const content = context.textForNode(story, node);
  const explicitFitting = node.sizing === 'fit' || node.textRender === 'fit';
  const surfaceRecipe = context.surfaceRecipeForNode(cardType, node);
  const surfaceProps = context.surfacePropsForRecipe(surfaceRecipe, context.selectedState);
  if (node.type !== 'button') {
    const nodeClass = node.type === 'text'
      ? `main-material-card-node-surface main-material-card-node-surface--text main-material-card-node--${node.binding || 'unbound'}`
      : 'main-material-card-node-surface main-material-card-node-surface--background';
    const panelPlan = createMaterialPanelEmissionPlan({
      ...surfaceProps,
      padded: false,
      className: nodeClass,
      renderMode: 'export',
    }, content, 'export');
    return createExportResult('feed-panel', panelPlan);
  }

  const plan = createMaterialButtonEmissionPlan({
    ...surfaceProps,
    size: 'sm',
    fullWidth: true,
    renderMode: 'export',
  }, content, 'export');
  const tagFitLabel = (layer: EmittedLayer): EmittedLayer => (
    layer.text === content
      ? { ...layer, classNames: [...(layer.classNames || []), 'material-text-content--fit'] }
      : { ...layer, children: layer.children?.map(tagFitLabel) }
  );
  const fittedPlan = explicitFitting
    ? { ...plan, host: { ...plan.host, children: plan.host.children?.map(tagFitLabel) } }
    : plan;
  return createExportResult('feed-button', fittedPlan);
};

import {
  createMaterialButtonEmissionPlan,
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

export type MainMaterialExportTargetKind = 'feed-button';

export interface MainMaterialExportNode {
  id: string;
  type: string;
  sizing?: 'auto' | 'fit' | 'flow';
  textRender?: 'auto' | 'rich' | 'fit' | 'raw';
  children?: MainMaterialExportNode[];
}

export interface MainMaterialExportFeedCardType<TNode extends MainMaterialExportNode = MainMaterialExportNode> {
  id: string;
  children: TNode[];
}

export interface MainMaterialExportFeedStory {
  id: string;
  cardTypeId: string;
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

const createExportResult = (
  kind: MainMaterialExportTargetKind,
  plan: MaterialEmissionPlan,
): MainMaterialExportResult => ({
  kind,
  plan,
  html: serializeEmissionPlanHtml(plan),
  css: serializeEmissionPlanCss(plan),
  metrics: measureEmissionPlan(plan),
});

export const createMainMaterialExportPlan = <
  TNode extends MainMaterialExportNode,
  TCardType extends MainMaterialExportFeedCardType<TNode>,
  TStory extends MainMaterialExportFeedStory,
>(
  targetId: string,
  context: MainMaterialExportPlannerContext<TNode, TCardType, TStory>,
): MainMaterialExportResult | null => {
  const target = parseFeedMaterialTargetId(targetId);
  if (!target?.nodeId) return null;

  const cardType = context.feedCardTypes[target.cardTypeId];
  const node = cardType ? findExportNodeById(cardType.children, target.nodeId) : undefined;
  if (!cardType || !node || node.type !== 'button') return null;

  const story = context.feedStories.find((item) => item.id === context.selectedFeedStoryId)
    || context.feedStories.find((item) => item.cardTypeId === target.cardTypeId)
    || context.feedStories[0]
    || context.fallbackStory;
  const content = context.textForNode(story, node);
  const explicitFitting = node.sizing === 'fit' || node.textRender === 'fit';
  const surfaceRecipe = context.surfaceRecipeForNode(cardType, node);
  const surfaceProps = context.surfacePropsForRecipe(surfaceRecipe, context.selectedState);
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

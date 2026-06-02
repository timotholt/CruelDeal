import type { MaterialEditorCapabilities, MaterialRecipe } from '../material-lab';
import type { MaterialNodeRecipe, MaterialNodeRole } from './MaterialNodeTypes';

export interface MaterialNodeEditableTarget {
  id: string;
  label: string;
  recipe: MaterialRecipe;
  capabilities: MaterialEditorCapabilities;
  interactionRole?: MaterialNodeRole;
  sharedStyleId?: string;
  onChange: (recipe: MaterialRecipe) => void;
  children?: MaterialNodeEditableTarget[];
}

export interface MaterialNodeTargetContext {
  fallbackCapabilities: MaterialEditorCapabilities;
  recipeForNode?: (node: MaterialNodeRecipe) => MaterialRecipe | undefined;
  capabilitiesForNode?: (node: MaterialNodeRecipe) => MaterialEditorCapabilities;
  targetIdForNode?: (node: MaterialNodeRecipe) => string;
  onChangeForNode: (node: MaterialNodeRecipe, recipe: MaterialRecipe) => void;
}

export const materialNodeTreeToEditableTargets = (
  nodes: readonly MaterialNodeRecipe[],
  context: MaterialNodeTargetContext,
): MaterialNodeEditableTarget[] => {
  const targets: MaterialNodeEditableTarget[] = [];
  nodes.forEach((node) => {
    const recipe = context.recipeForNode?.(node) ?? node.surface;
    if (!recipe) return;
    targets.push({
      id: context.targetIdForNode?.(node) ?? node.id,
      label: node.label,
      recipe,
      capabilities: context.capabilitiesForNode?.(node) ?? context.fallbackCapabilities,
      interactionRole: node.role,
      sharedStyleId: node.sharedStyle?.id,
      onChange: (nextRecipe: MaterialRecipe) => context.onChangeForNode(node, nextRecipe),
      children: node.children?.length ? materialNodeTreeToEditableTargets(node.children, context) : [],
    });
  });
  return targets;
};

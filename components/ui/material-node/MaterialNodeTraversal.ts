import type { MaterialNodeRecipe } from './MaterialNodeTypes';

export interface MaterialNodeTraversalEntry {
  node: MaterialNodeRecipe;
  depth: number;
  parent?: MaterialNodeRecipe;
}

export const walkMaterialNodeTree = (
  nodes: readonly MaterialNodeRecipe[],
  visit: (entry: MaterialNodeTraversalEntry) => void,
  depth = 0,
  parent?: MaterialNodeRecipe,
) => {
  nodes.forEach((node) => {
    visit({ node, depth, parent });
    if (node.children?.length) walkMaterialNodeTree(node.children, visit, depth + 1, node);
  });
};

export const flattenMaterialNodeTree = (nodes: readonly MaterialNodeRecipe[]): MaterialNodeTraversalEntry[] => {
  const entries: MaterialNodeTraversalEntry[] = [];
  walkMaterialNodeTree(nodes, (entry) => entries.push(entry));
  return entries;
};

export const findMaterialNodeById = (
  nodes: readonly MaterialNodeRecipe[],
  nodeId: string,
): MaterialNodeRecipe | undefined => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = node.children ? findMaterialNodeById(node.children, nodeId) : undefined;
    if (child) return child;
  }
  return undefined;
};

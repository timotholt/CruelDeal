import type { MaterialNodeRecipe } from './MaterialNodeTypes';

export const cloneMaterialNode = (node: MaterialNodeRecipe): MaterialNodeRecipe => ({
  ...node,
  layout: node.layout ? { ...node.layout, position: node.layout.position ? { ...node.layout.position } : undefined } : undefined,
  content: node.content ? { ...node.content } : undefined,
  sharedStyle: node.sharedStyle ? { ...node.sharedStyle } : undefined,
  children: node.children?.map((child) => cloneMaterialNode(child)) ?? [],
});

export const cloneMaterialNodeTree = (nodes: readonly MaterialNodeRecipe[]): MaterialNodeRecipe[] => (
  nodes.map((node) => cloneMaterialNode(node))
);

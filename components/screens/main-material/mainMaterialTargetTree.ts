export interface FlatTarget<TTarget> {
  target: TTarget;
  depth: number;
}

export const flattenTargetTree = <TTarget extends { children?: TTarget[] }>(
  targets: TTarget[],
  depth = 0,
): FlatTarget<TTarget>[] => (
  targets.flatMap((target) => [
    { target, depth },
    ...flattenTargetTree(target.children || [], depth + 1),
  ])
);

export const findTreeNodeById = <TNode extends { id: string; children?: TNode[] }>(
  nodes: TNode[],
  nodeId: string,
): TNode | undefined => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findTreeNodeById(node.children || [], nodeId);
    if (child) return child;
  }
  return undefined;
};

export const updateTreeNodeById = <TNode extends { id: string; children?: TNode[] }>(
  nodes: TNode[],
  nodeId: string,
  updateNode: (node: TNode) => TNode,
): TNode[] => (
  nodes.map((node) => (
    node.id === nodeId
      ? updateNode(node)
      : { ...node, children: updateTreeNodeById(node.children || [], nodeId, updateNode) }
  ))
);

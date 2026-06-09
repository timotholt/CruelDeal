import type { FeedCardNode } from './mainMaterialFeedModel';
import type { FeedNodeLayout } from './feedNodeLayoutCss';
import { cloneFeedCardNode } from './mainMaterialFeedModel';

export type FeedNodeIdFactory = (sourceId: string) => string;

export type FeedNodeTreeOperationResult =
  | { ok: true; nodes: FeedCardNode[] }
  | { ok: false; reason: string };

export type FeedNodePatch = Omit<Partial<FeedCardNode>, 'children' | 'layout'> & {
  layout?: Partial<FeedNodeLayout>;
};

type NodePath = readonly number[];

const defaultCopyId: FeedNodeIdFactory = (sourceId) => `${sourceId}-copy`;

const cloneFeedNodes = (nodes: readonly FeedCardNode[]): FeedCardNode[] => (
  nodes.map((node) => cloneFeedCardNode(node))
);

const pathKey = (path: NodePath): string => path.join('.');

const collectNodeIds = (nodes: readonly FeedCardNode[], ids = new Set<string>()): Set<string> => {
  nodes.forEach((node) => {
    ids.add(node.id);
    collectNodeIds(node.children || [], ids);
  });
  return ids;
};

const findNodePath = (
  nodes: readonly FeedCardNode[],
  nodeId: string,
  prefix: number[] = [],
): NodePath | null => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const path = [...prefix, index];
    if (node.id === nodeId) return path;
    const childPath = findNodePath(node.children || [], nodeId, path);
    if (childPath) return childPath;
  }
  return null;
};

const getNodeAtPath = (nodes: FeedCardNode[], path: NodePath): FeedCardNode | null => {
  let currentList = nodes;
  let currentNode: FeedCardNode | null = null;
  for (const index of path) {
    currentNode = currentList[index] || null;
    if (!currentNode) return null;
    currentList = currentNode.children || [];
  }
  return currentNode;
};

const getListAtPath = (nodes: FeedCardNode[], parentPath: NodePath): FeedCardNode[] | null => {
  if (parentPath.length === 0) return nodes;
  const parent = getNodeAtPath(nodes, parentPath);
  if (!parent) return null;
  parent.children = parent.children || [];
  return parent.children;
};

const parentPathOf = (path: NodePath): NodePath => path.slice(0, -1);
const nodeIndexOf = (path: NodePath): number => path[path.length - 1] ?? -1;

const isDescendantPath = (candidate: NodePath, ancestor: NodePath): boolean => (
  candidate.length > ancestor.length && ancestor.every((value, index) => candidate[index] === value)
);

const cloneWithFreshIds = (
  node: FeedCardNode,
  idFactory: FeedNodeIdFactory,
  existingIds: Set<string>,
): FeedCardNode | null => {
  const nextId = idFactory(node.id);
  if (!nextId || existingIds.has(nextId)) return null;
  existingIds.add(nextId);
  return {
    ...cloneFeedCardNode(node),
    id: nextId,
    children: (node.children || []).map((child) => cloneWithFreshIds(child, idFactory, existingIds)).filter(Boolean) as FeedCardNode[],
  };
};

export const insertFeedNode = (
  nodes: readonly FeedCardNode[],
  parentId: string | null,
  node: FeedCardNode,
  index?: number,
): FeedNodeTreeOperationResult => {
  const next = cloneFeedNodes(nodes);
  const existingIds = collectNodeIds(next);
  if (existingIds.has(node.id)) return { ok: false, reason: `Node id already exists: ${node.id}` };

  const parentPath = parentId ? findNodePath(next, parentId) : [];
  if (!parentPath) return { ok: false, reason: `Parent node not found: ${parentId}` };

  const list = getListAtPath(next, parentPath);
  if (!list) return { ok: false, reason: `Parent node is unavailable: ${parentId}` };

  const insertIndex = Math.max(0, Math.min(index ?? list.length, list.length));
  list.splice(insertIndex, 0, cloneFeedCardNode(node));
  return { ok: true, nodes: next };
};

export const removeFeedNode = (
  nodes: readonly FeedCardNode[],
  nodeId: string,
): FeedNodeTreeOperationResult => {
  const next = cloneFeedNodes(nodes);
  const path = findNodePath(next, nodeId);
  if (!path) return { ok: false, reason: `Node not found: ${nodeId}` };
  const list = getListAtPath(next, parentPathOf(path));
  if (!list) return { ok: false, reason: `Parent node is unavailable for: ${nodeId}` };
  list.splice(nodeIndexOf(path), 1);
  return { ok: true, nodes: next };
};

export const duplicateFeedNode = (
  nodes: readonly FeedCardNode[],
  nodeId: string,
  idFactory: FeedNodeIdFactory = defaultCopyId,
): FeedNodeTreeOperationResult => {
  const next = cloneFeedNodes(nodes);
  const path = findNodePath(next, nodeId);
  if (!path) return { ok: false, reason: `Node not found: ${nodeId}` };
  const node = getNodeAtPath(next, path);
  const list = getListAtPath(next, parentPathOf(path));
  if (!node || !list) return { ok: false, reason: `Node is unavailable: ${nodeId}` };

  const duplicate = cloneWithFreshIds(node, idFactory, collectNodeIds(next));
  if (!duplicate) return { ok: false, reason: `Duplicate id factory produced an invalid or existing id for: ${nodeId}` };

  list.splice(nodeIndexOf(path) + 1, 0, duplicate);
  return { ok: true, nodes: next };
};

export const moveFeedNode = (
  nodes: readonly FeedCardNode[],
  nodeId: string,
  newParentId: string | null,
  index: number,
): FeedNodeTreeOperationResult => {
  const next = cloneFeedNodes(nodes);
  const sourcePath = findNodePath(next, nodeId);
  if (!sourcePath) return { ok: false, reason: `Node not found: ${nodeId}` };

  const targetParentPath = newParentId ? findNodePath(next, newParentId) : [];
  if (!targetParentPath) return { ok: false, reason: `Parent node not found: ${newParentId}` };
  if (pathKey(sourcePath) === pathKey(targetParentPath) || isDescendantPath(targetParentPath, sourcePath)) {
    return { ok: false, reason: 'Cannot move a node into itself or one of its descendants.' };
  }

  const sourceList = getListAtPath(next, parentPathOf(sourcePath));
  const node = getNodeAtPath(next, sourcePath);
  if (!sourceList || !node) return { ok: false, reason: `Node is unavailable: ${nodeId}` };
  sourceList.splice(nodeIndexOf(sourcePath), 1);

  const adjustedParentPath = newParentId ? findNodePath(next, newParentId) : [];
  if (!adjustedParentPath) return { ok: false, reason: `Parent node not found after removal: ${newParentId}` };
  const targetList = getListAtPath(next, adjustedParentPath);
  if (!targetList) return { ok: false, reason: `Parent node is unavailable: ${newParentId}` };
  const targetIndex = Math.max(0, Math.min(index, targetList.length));
  targetList.splice(targetIndex, 0, node);
  return { ok: true, nodes: next };
};

export const wrapFeedNodesInContainer = (
  nodes: readonly FeedCardNode[],
  nodeIds: readonly string[],
  container: FeedCardNode,
): FeedNodeTreeOperationResult => {
  if (nodeIds.length === 0) return { ok: false, reason: 'No nodes were selected to wrap.' };
  const next = cloneFeedNodes(nodes);
  const existingIds = collectNodeIds(next);
  if (existingIds.has(container.id)) return { ok: false, reason: `Container id already exists: ${container.id}` };

  const paths = nodeIds.map((nodeId) => findNodePath(next, nodeId));
  if (paths.some((path) => !path)) return { ok: false, reason: 'Every selected node must exist before wrapping.' };
  const concretePaths = paths as NodePath[];
  const parentKey = pathKey(parentPathOf(concretePaths[0]));
  if (!concretePaths.every((path) => pathKey(parentPathOf(path)) === parentKey)) {
    return { ok: false, reason: 'Wrapped nodes must share the same parent.' };
  }

  const sortedIndexes = concretePaths.map(nodeIndexOf).sort((a, b) => a - b);
  const adjacent = sortedIndexes.every((value, offset) => value === sortedIndexes[0] + offset);
  if (!adjacent) return { ok: false, reason: 'Wrapped nodes must be adjacent siblings.' };

  const list = getListAtPath(next, parentPathOf(concretePaths[0]));
  if (!list) return { ok: false, reason: 'Parent node is unavailable for wrapping.' };
  const selected = list.splice(sortedIndexes[0], sortedIndexes.length);
  list.splice(sortedIndexes[0], 0, {
    ...cloneFeedCardNode(container),
    children: selected,
  });
  return { ok: true, nodes: next };
};

export const unwrapFeedNodeContainer = (
  nodes: readonly FeedCardNode[],
  nodeId: string,
): FeedNodeTreeOperationResult => {
  const next = cloneFeedNodes(nodes);
  const path = findNodePath(next, nodeId);
  if (!path) return { ok: false, reason: `Node not found: ${nodeId}` };
  const node = getNodeAtPath(next, path);
  const list = getListAtPath(next, parentPathOf(path));
  if (!node || !list) return { ok: false, reason: `Node is unavailable: ${nodeId}` };
  if (node.type !== 'container') return { ok: false, reason: 'Only container nodes can be unwrapped.' };

  list.splice(nodeIndexOf(path), 1, ...(node.children || []).map((child) => cloneFeedCardNode(child)));
  return { ok: true, nodes: next };
};

export const patchFeedNode = (
  nodes: readonly FeedCardNode[],
  nodeId: string,
  patch: FeedNodePatch,
): FeedNodeTreeOperationResult => {
  const next = cloneFeedNodes(nodes);
  const path = findNodePath(next, nodeId);
  if (!path) return { ok: false, reason: `Node not found: ${nodeId}` };
  const node = getNodeAtPath(next, path);
  if (!node) return { ok: false, reason: `Node is unavailable: ${nodeId}` };

  const { layout, ...nodePatch } = patch;
  Object.assign(node, nodePatch);
  if (layout) node.layout = { ...node.layout, ...layout };
  return { ok: true, nodes: next };
};

import type {
  MaterialEditorCapabilities,
  MaterialRecipe,
} from '../../ui/material-lab';
import type { InteractionRole } from './mainMaterialInteractionModel';
import {
  feedCardMaterialTargetId,
  feedMaterialTargetIdForNode,
  type FeedMaterialTargetId,
} from './materialTargetIds';
import {
  createMainMaterialExportGroupDescriptor,
  type MainMaterialExportGroupDescriptor,
} from './mainMaterialExportGroups';

export interface MainMaterialEditableTarget {
  id: string;
  label: string;
  recipe: MaterialRecipe;
  capabilities: MaterialEditorCapabilities;
  interactionRole?: InteractionRole;
  exportGroup?: MainMaterialExportGroupDescriptor;
  onChange: (recipe: MaterialRecipe) => void;
  children?: MainMaterialEditableTarget[];
}

export interface FeedMaterialTargetNode<TNode extends FeedMaterialTargetNode<TNode> = never> {
  id: string;
  label: string;
  type: string;
  children?: TNode[];
}

export interface FeedMaterialTargetCard<
  TCardTypeId extends string,
  TNode extends FeedMaterialTargetNode<TNode>,
> {
  id: TCardTypeId;
  name?: string;
  surface: MaterialRecipe;
  children: TNode[];
}

export interface CreateFeedMaterialTargetsOptions<
  TCardTypeId extends string,
  TNode extends FeedMaterialTargetNode<TNode>,
  TCard extends FeedMaterialTargetCard<TCardTypeId, TNode>,
> {
  cardTypeIds: readonly TCardTypeId[];
  cardTypes: Record<TCardTypeId, TCard>;
  rootCapabilities: MaterialEditorCapabilities;
  nodeRecipe: (cardType: TCard, node: TNode) => MaterialRecipe;
  nodeCapabilities: (cardType: TCard, node: TNode) => MaterialEditorCapabilities;
  nodeInteractionRole?: (cardType: TCard, node: TNode) => InteractionRole;
  onCardChange: (cardTypeId: TCardTypeId, recipe: MaterialRecipe) => void;
  onNodeChange: (cardTypeId: TCardTypeId, nodeId: string, recipe: MaterialRecipe) => void;
}

export const feedCardMaterialTargetLabel = <
  TCardTypeId extends string,
  TNode extends FeedMaterialTargetNode<TNode>,
>(
  cardType: FeedMaterialTargetCard<TCardTypeId, TNode>,
  index: number,
): string => (
  cardType.name && !cardType.name.startsWith('card_type_')
    ? cardType.name
    : `Feed Card ${index + 1}`
);

const createFeedNodeMaterialTarget = <
  TCardTypeId extends string,
  TNode extends FeedMaterialTargetNode<TNode>,
  TCard extends FeedMaterialTargetCard<TCardTypeId, TNode>,
>(
  cardType: TCard,
  node: TNode,
  options: CreateFeedMaterialTargetsOptions<TCardTypeId, TNode, TCard>,
): MainMaterialEditableTarget => ({
  id: feedMaterialTargetIdForNode(cardType.id, node.id),
  label: node.label,
  recipe: options.nodeRecipe(cardType, node),
  capabilities: options.nodeCapabilities(cardType, node),
  interactionRole: options.nodeInteractionRole?.(cardType, node),
  exportGroup: createMainMaterialExportGroupDescriptor(feedMaterialTargetIdForNode(cardType.id, node.id)),
  onChange: (recipe) => options.onNodeChange(cardType.id, node.id, recipe),
  children: node.children?.map((child) => createFeedNodeMaterialTarget(cardType, child, options)) || [],
});

export const createFeedMaterialTargets = <
  TCardTypeId extends string,
  TNode extends FeedMaterialTargetNode<TNode>,
  TCard extends FeedMaterialTargetCard<TCardTypeId, TNode>,
>(
  options: CreateFeedMaterialTargetsOptions<TCardTypeId, TNode, TCard>,
): Array<MainMaterialEditableTarget & { id: FeedMaterialTargetId<TCardTypeId> }> => (
  options.cardTypeIds.map((cardTypeId, index) => {
    const cardType = options.cardTypes[cardTypeId];
    return {
      id: feedCardMaterialTargetId(cardTypeId),
      label: feedCardMaterialTargetLabel(cardType, index),
      recipe: cardType.surface,
      capabilities: options.rootCapabilities,
      exportGroup: createMainMaterialExportGroupDescriptor(feedCardMaterialTargetId(cardTypeId)),
      onChange: (recipe) => options.onCardChange(cardTypeId, recipe),
      children: cardType.children.map((node) => createFeedNodeMaterialTarget(cardType, node, options)),
    };
  })
);

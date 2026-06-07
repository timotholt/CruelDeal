export const topBarMaterialTargetPrefix = 'topbar:' as const;
export const toolbarMaterialTargetPrefix = 'toolbar:' as const;
export const navMaterialTargetPrefix = 'nav:item:' as const;
export const feedCardMaterialTargetPrefix = 'feed:card:' as const;

const feedNodeSeparator = ':node:' as const;

export type TopBarMaterialTargetId = `${typeof topBarMaterialTargetPrefix}${string}`;
export type ToolbarMaterialTargetId = `${typeof toolbarMaterialTargetPrefix}${string}`;
export type NavMaterialTargetId = `${typeof navMaterialTargetPrefix}${number}`;
export type FeedMaterialTargetId<TCardTypeId extends string = string> =
  | `${typeof feedCardMaterialTargetPrefix}${TCardTypeId}`
  | `${typeof feedCardMaterialTargetPrefix}${TCardTypeId}${typeof feedNodeSeparator}${string}`;

export interface ParsedFeedMaterialTargetId<TCardTypeId extends string = string> {
  cardTypeId: TCardTypeId;
  nodeId?: string;
}

export const topBarProfileTargetId: TopBarMaterialTargetId = `${topBarMaterialTargetPrefix}profile`;

export const topBarCurrencyTargetId = (id: string): TopBarMaterialTargetId => (
  `${topBarMaterialTargetPrefix}currency:${id}`
);

export const toolbarMaterialTargetId = (nodeId: string): ToolbarMaterialTargetId => (
  `${toolbarMaterialTargetPrefix}${nodeId}`
);

export const navItemTargetId = (index: number): NavMaterialTargetId => (
  `${navMaterialTargetPrefix}${index}`
);

export const feedCardMaterialTargetId = <TCardTypeId extends string>(
  cardTypeId: TCardTypeId,
): FeedMaterialTargetId<TCardTypeId> => (
  `${feedCardMaterialTargetPrefix}${cardTypeId}`
);

export const feedMaterialTargetIdForNode = <TCardTypeId extends string>(
  cardTypeId: TCardTypeId,
  nodeId: string,
): FeedMaterialTargetId<TCardTypeId> => (
  `${feedCardMaterialTargetPrefix}${cardTypeId}${feedNodeSeparator}${nodeId}`
);

export const parseFeedMaterialTargetId = <TCardTypeId extends string = string>(
  targetId: string,
): ParsedFeedMaterialTargetId<TCardTypeId> | null => {
  if (!targetId.startsWith(feedCardMaterialTargetPrefix)) return null;
  const rest = targetId.slice(feedCardMaterialTargetPrefix.length);
  const nodeIndex = rest.indexOf(feedNodeSeparator);
  return {
    cardTypeId: (nodeIndex >= 0 ? rest.slice(0, nodeIndex) : rest) as TCardTypeId,
    nodeId: nodeIndex >= 0 ? rest.slice(nodeIndex + feedNodeSeparator.length) : undefined,
  };
};


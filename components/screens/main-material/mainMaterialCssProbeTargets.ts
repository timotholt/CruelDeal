import type { FeedCardNode } from './mainMaterialFeedModel';
import {
  bottomChromeTargetIdForChromeNode,
  createBottomChromeFeedNode,
  createTopBarFeedNode,
  findFeedNodeByTargetId,
  topBarTargetIdForChromeNode,
} from './mainMaterialPreview';
import { findTreeNodeById } from './mainMaterialTargetTree';
import {
  navMaterialTargetPrefix,
  parseFeedMaterialTargetId,
  toolbarMaterialTargetPrefix,
  topBarMaterialTargetPrefix,
} from './materialTargetIds';

export interface MainMaterialCssProbeContext {
  targetId: string;
  feedCardTypes: Record<string, { children: FeedCardNode[] } | undefined>;
}

export const findMainMaterialCssProbeNode = (
  context: MainMaterialCssProbeContext,
): FeedCardNode | undefined => {
  const { targetId } = context;
  if (targetId === 'topBar' || targetId.startsWith(topBarMaterialTargetPrefix)) {
    return findFeedNodeByTargetId(createTopBarFeedNode(), targetId, topBarTargetIdForChromeNode);
  }
  if (
    targetId === 'toolBar'
    || targetId === 'navBar'
    || targetId === 'navBarContainer'
    || targetId.startsWith(toolbarMaterialTargetPrefix)
    || targetId.startsWith(navMaterialTargetPrefix)
  ) {
    return findFeedNodeByTargetId(createBottomChromeFeedNode(), targetId, bottomChromeTargetIdForChromeNode);
  }

  const feedTarget = parseFeedMaterialTargetId(targetId);
  if (!feedTarget?.nodeId) return undefined;
  const cardType = context.feedCardTypes[feedTarget.cardTypeId];
  return cardType ? findTreeNodeById<FeedCardNode>(cardType.children, feedTarget.nodeId) : undefined;
};

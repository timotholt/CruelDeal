import type { UiNodeContentPayload } from '../../ui/material-lab/uiNodeValidate';
import { serializeEditorOutput, validateEditorOutput } from '../../ui/editor-output';
import {
  feedTextSlotIds,
  type FeedStory,
} from './mainMaterialFeedModel';

export const createMainMaterialFeedContentPayload = (
  story: FeedStory,
): UiNodeContentPayload => ({
  id: story.id,
  label: story.label,
  cardTypeId: story.cardTypeId,
  image: story.image,
  ...Object.fromEntries(feedTextSlotIds.map((slotId) => [slotId, story[slotId] || ''])),
});

export const validateMainMaterialFeedContentPayload = (
  story: FeedStory,
): UiNodeContentPayload | null => (
  validateEditorOutput('ui-node-content', createMainMaterialFeedContentPayload(story)).value
);

export const serializeMainMaterialFeedContentPayload = (
  story: FeedStory,
): string => (
  serializeEditorOutput('ui-node-content', createMainMaterialFeedContentPayload(story)) || ''
);

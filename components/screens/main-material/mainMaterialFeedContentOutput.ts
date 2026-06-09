import type { UiNodeContentPayload } from '../../ui/material-lab/uiNodeValidate';
import { serializeEditorOutput, validateEditorOutput } from '../../ui/editor-output';
import {
  feedTextSlotIds,
  type FeedTextSlotId,
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

export interface MainMaterialFeedContentImportResult {
  ok: boolean;
  story: FeedStory;
  changedSlots: FeedTextSlotId[];
  message: string;
}

export const applyMainMaterialFeedContentPayload = (
  story: FeedStory,
  input: unknown,
): MainMaterialFeedContentImportResult => {
  let validated: ReturnType<typeof validateEditorOutput<'ui-node-content'>>;
  try {
    validated = validateEditorOutput('ui-node-content', input);
  } catch {
    return {
      ok: false,
      story,
      changedSlots: [],
      message: 'Invalid ui-node-content JSON',
    };
  }
  if (!validated.ok) {
    return {
      ok: false,
      story,
      changedSlots: [],
      message: 'Invalid ui-node-content JSON',
    };
  }
  const patch = validated.value;
  const changedSlots: FeedTextSlotId[] = [];
  const next: FeedStory = {
    ...story,
    label: typeof patch.label === 'string' ? patch.label : story.label,
    image: typeof patch.image === 'string' ? patch.image : story.image,
  };
  feedTextSlotIds.forEach((slotId) => {
    const value = patch[slotId];
    if (typeof value !== 'string' || value === (story[slotId] || '')) return;
    next[slotId] = value;
    changedSlots.push(slotId);
  });
  return {
    ok: true,
    story: next,
    changedSlots,
    message: changedSlots.length
      ? `Imported ${changedSlots.length} content field${changedSlots.length === 1 ? '' : 's'}`
      : 'Valid ui-node-content JSON; no matching content fields changed',
  };
};

export const parseMainMaterialFeedContentJson = (
  story: FeedStory,
  text: string,
): MainMaterialFeedContentImportResult => {
  if (!text.trim()) {
    return {
      ok: false,
      story,
      changedSlots: [],
      message: 'No ui-node-content JSON provided',
    };
  }
  try {
    return applyMainMaterialFeedContentPayload(story, JSON.parse(text));
  } catch {
    return {
      ok: false,
      story,
      changedSlots: [],
      message: 'Invalid JSON',
    };
  }
};

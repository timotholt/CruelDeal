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

export interface MainMaterialFeedContentDocumentInspection {
  ok: boolean;
  changedSlots: FeedTextSlotId[];
  message: string;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isUiNodeContentValue = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') return true;
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every((entry) => (
    typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
  ));
};

const inspectMainMaterialFeedContentPayload = (
  story: FeedStory,
  input: unknown,
): MainMaterialFeedContentDocumentInspection => {
  if (!isPlainRecord(input)) {
    return { ok: false, changedSlots: [], message: 'Content document must be a JSON object' };
  }
  const invalidEntry = Object.entries(input).find(([, value]) => !isUiNodeContentValue(value));
  if (invalidEntry) {
    return { ok: false, changedSlots: [], message: `Invalid ui-node-content value at "${invalidEntry[0]}"` };
  }
  const changedSlots = feedTextSlotIds.filter((slotId) => {
    const value = input[slotId];
    return typeof value === 'string' && value !== (story[slotId] || '');
  });
  return {
    ok: true,
    changedSlots,
    message: changedSlots.length
      ? `Valid ui-node-content JSON; ${changedSlots.length} matching field${changedSlots.length === 1 ? '' : 's'} changed`
      : 'Valid ui-node-content JSON; no matching content fields changed',
  };
};

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

export const inspectMainMaterialFeedContentJson = (
  story: FeedStory,
  text: string,
): MainMaterialFeedContentDocumentInspection => {
  if (!text.trim()) {
    return { ok: false, changedSlots: [], message: 'No ui-node-content JSON provided' };
  }
  try {
    return inspectMainMaterialFeedContentPayload(story, JSON.parse(text));
  } catch {
    return { ok: false, changedSlots: [], message: 'Invalid JSON' };
  }
};

export const formatMainMaterialFeedContentJson = (
  story: FeedStory,
  text: string,
): { ok: boolean; text: string; message: string } => {
  if (!text.trim()) {
    return { ok: false, text, message: 'No ui-node-content JSON provided' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, text, message: 'Invalid JSON' };
  }
  const inspected = inspectMainMaterialFeedContentPayload(story, parsed);
  if (!inspected.ok) {
    return { ok: false, text, message: inspected.message };
  }
  return {
    ok: true,
    text: `${JSON.stringify(parsed, null, 2)}\n`,
    message: 'Formatted ui-node-content JSON',
  };
};

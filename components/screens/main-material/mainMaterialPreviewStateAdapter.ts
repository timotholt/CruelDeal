import {
  coerceStoredFeedTargetId,
  createMainMaterialStoredState,
  parseMainMaterialStoredStateJson,
  serializeMainMaterialStoredState,
  type MainMaterialStoredState,
} from './mainMaterialPersistence';
import type { FeedMaterialTargetId } from './materialTargetIds';

export const mainMaterialPreviewStateDocument = {
  id: 'main-material-preview-state',
  label: 'Main Material Preview State',
  family: 'compatibility-editor-state',
  description: 'Editor preview compatibility JSON for /material-main save, load, import, and export.',
} as const;

export type MainMaterialPreviewStateDocument = MainMaterialStoredState;

export const createMainMaterialPreviewStateDocument = (
  state: MainMaterialStoredState,
): MainMaterialPreviewStateDocument => createMainMaterialStoredState(state);

export const serializeMainMaterialPreviewStateDocument = (
  state: MainMaterialStoredState,
  space?: number,
) => serializeMainMaterialStoredState(createMainMaterialPreviewStateDocument(state), space);

export type MainMaterialPreviewStateParseResult =
  | { ok: true; state: MainMaterialPreviewStateDocument }
  | { ok: false; reason: 'empty' | 'invalid-json' | 'invalid-document'; message: string };

export const parseMainMaterialPreviewStateDocument = (
  raw: string,
): MainMaterialPreviewStateParseResult => {
  if (!raw.trim()) {
    return { ok: false, reason: 'empty', message: 'Import failed: no JSON was provided.' };
  }
  let parsed: MainMaterialStoredState | null;
  try {
    parsed = parseMainMaterialStoredStateJson(raw);
  } catch {
    return { ok: false, reason: 'invalid-json', message: 'Import failed: clipboard does not contain valid JSON.' };
  }
  if (!parsed) {
    return { ok: false, reason: 'invalid-document', message: 'Import failed: clipboard JSON must be an object.' };
  }
  return { ok: true, state: parsed };
};

export const resolvePreviewStateStoryId = <TStory extends { id: string }>(
  selectedFeedStoryId: unknown,
  stories: readonly TStory[],
  fallbackStoryId: string,
) => (
  typeof selectedFeedStoryId === 'string' && stories.some((story) => story.id === selectedFeedStoryId)
    ? selectedFeedStoryId
    : fallbackStoryId
);

export const resolvePreviewStateCardTypeId = <TCardTypeId extends string>(
  editingFeedCardTypeId: unknown,
  cardTypeIds: readonly TCardTypeId[],
  fallbackCardTypeId: TCardTypeId,
): TCardTypeId => (
  typeof editingFeedCardTypeId === 'string' && (cardTypeIds as readonly string[]).includes(editingFeedCardTypeId)
    ? editingFeedCardTypeId as TCardTypeId
    : fallbackCardTypeId
);

export const resolvePreviewStateFeedTargetId = <TCardTypeId extends string>(
  state: Pick<MainMaterialStoredState, 'selectedFeedTargetId' | 'editingFeedNodeId' | 'editingFeedCardTypeId'>,
  cardTypeIds: readonly TCardTypeId[],
  fallbackCardTypeId: TCardTypeId,
): FeedMaterialTargetId<TCardTypeId> => {
  const cardTypeId = resolvePreviewStateCardTypeId(
    state.editingFeedCardTypeId,
    cardTypeIds,
    fallbackCardTypeId,
  );
  return coerceStoredFeedTargetId(state.selectedFeedTargetId, state.editingFeedNodeId, cardTypeId);
};

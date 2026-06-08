import {
  feedCardMaterialTargetId,
  feedMaterialTargetIdForNode,
  parseFeedMaterialTargetId,
  type FeedMaterialTargetId,
} from './materialTargetIds';

export const mainMaterialStorageKey = 'cruel-deal.main-material-preview.v23';
export const mainMaterialPresetStorageKey = 'cruel-deal.main-material-preview.material-presets.v1';

export interface MainMaterialStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface MainMaterialStoredState {
  backdrop?: unknown;
  title?: unknown;
  feed?: unknown;
  feedStories?: unknown;
  feedCardTypes?: unknown;
  feedStoryImageOverrides?: unknown;
  selectedFeedStoryId?: unknown;
  editingFeedCardTypeId?: unknown;
  editingFeedNodeId?: unknown;
  selectedFeedTargetId?: unknown;
  nav?: unknown;
  surfaces?: unknown;
}

export const createMainMaterialStoredState = (state: MainMaterialStoredState): MainMaterialStoredState => ({
  backdrop: state.backdrop,
  title: state.title,
  feed: state.feed,
  feedStories: state.feedStories,
  feedCardTypes: state.feedCardTypes,
  feedStoryImageOverrides: state.feedStoryImageOverrides,
  selectedFeedStoryId: state.selectedFeedStoryId,
  editingFeedCardTypeId: state.editingFeedCardTypeId,
  selectedFeedTargetId: state.selectedFeedTargetId,
  nav: state.nav,
  surfaces: state.surfaces,
});

const recordFromJson = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as unknown;
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
};

export const parseMainMaterialStoredStateJson = (raw: string | null): MainMaterialStoredState | null => (
  recordFromJson(raw)
);

export const serializeMainMaterialStoredState = (
  state: MainMaterialStoredState,
  space?: number,
) => JSON.stringify(createMainMaterialStoredState(state), null, space);

export const readMainMaterialStoredState = (
  storage: MainMaterialStorageLike,
): MainMaterialStoredState | null => (
  parseMainMaterialStoredStateJson(storage.getItem(mainMaterialStorageKey))
);

export const writeMainMaterialStoredState = (
  storage: MainMaterialStorageLike,
  state: MainMaterialStoredState,
) => {
  storage.setItem(mainMaterialStorageKey, serializeMainMaterialStoredState(state));
};

export const readMainMaterialStoredPresets = (storage: MainMaterialStorageLike): unknown => (
  recordFromJson(storage.getItem(mainMaterialPresetStorageKey))
);

export const writeMainMaterialStoredPresets = (
  storage: MainMaterialStorageLike,
  presets: unknown,
) => {
  storage.setItem(mainMaterialPresetStorageKey, JSON.stringify(presets));
};

export const removeMainMaterialStoredPresets = (storage: MainMaterialStorageLike) => {
  storage.removeItem(mainMaterialPresetStorageKey);
};

export const coerceStoredFeedTargetId = <TCardTypeId extends string>(
  selectedFeedTargetId: unknown,
  legacyEditingFeedNodeId: unknown,
  fallbackCardTypeId: TCardTypeId,
): FeedMaterialTargetId<TCardTypeId> => {
  if (typeof selectedFeedTargetId === 'string') {
    const parsed = parseFeedMaterialTargetId<TCardTypeId>(selectedFeedTargetId);
    if (parsed?.cardTypeId.trim()) return selectedFeedTargetId as FeedMaterialTargetId<TCardTypeId>;
  }
  if (typeof legacyEditingFeedNodeId === 'string' && legacyEditingFeedNodeId.trim()) {
    return feedMaterialTargetIdForNode(fallbackCardTypeId, legacyEditingFeedNodeId.trim());
  }
  return feedCardMaterialTargetId(fallbackCardTypeId);
};

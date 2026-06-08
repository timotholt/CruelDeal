import assert from 'node:assert/strict';
import {
  coerceStoredFeedTargetId,
  createMainMaterialStoredState,
  mainMaterialPresetStorageKey,
  mainMaterialStorageKey,
  parseMainMaterialStoredStateJson,
  readMainMaterialStoredPresets,
  readMainMaterialStoredState,
  removeMainMaterialStoredPresets,
  serializeMainMaterialStoredState,
  writeMainMaterialStoredPresets,
  writeMainMaterialStoredState,
  type MainMaterialStorageLike,
} from './mainMaterialPersistence';

class MemoryStorage implements MainMaterialStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
assert.equal(readMainMaterialStoredState(storage), null);

assert.deepEqual(createMainMaterialStoredState({
  backdrop: { blur: 4 },
  editingFeedNodeId: 'legacy-node',
  selectedFeedTargetId: 'feed:card:card_type_01',
}), {
  backdrop: { blur: 4 },
  title: undefined,
  feed: undefined,
  feedStories: undefined,
  feedCardTypes: undefined,
  feedStoryImageOverrides: undefined,
  selectedFeedStoryId: undefined,
  editingFeedCardTypeId: undefined,
  selectedFeedTargetId: 'feed:card:card_type_01',
  nav: undefined,
  surfaces: undefined,
});

assert.equal(
  serializeMainMaterialStoredState({ selectedFeedStoryId: 'story-1' }),
  '{"selectedFeedStoryId":"story-1"}',
);
assert.deepEqual(
  parseMainMaterialStoredStateJson(serializeMainMaterialStoredState({ selectedFeedTargetId: 'feed:card:card_type_01' })),
  { selectedFeedTargetId: 'feed:card:card_type_01' },
);
assert.equal(parseMainMaterialStoredStateJson('[]'), null);
assert.equal(parseMainMaterialStoredStateJson('"bad"'), null);

writeMainMaterialStoredState(storage, {
  selectedFeedStoryId: 'story-1',
  selectedFeedTargetId: 'feed:card:card_type_01:node:cta',
});
assert.deepEqual(readMainMaterialStoredState(storage), {
  selectedFeedStoryId: 'story-1',
  selectedFeedTargetId: 'feed:card:card_type_01:node:cta',
});

writeMainMaterialStoredPresets(storage, { feedCards: [{ id: 'preset-1' }] });
assert.deepEqual(readMainMaterialStoredPresets(storage), { feedCards: [{ id: 'preset-1' }] });
removeMainMaterialStoredPresets(storage);
assert.equal(readMainMaterialStoredPresets(storage), null);

storage.setItem(mainMaterialStorageKey, '[]');
assert.equal(readMainMaterialStoredState(storage), null);
storage.setItem(mainMaterialPresetStorageKey, '"bad"');
assert.equal(readMainMaterialStoredPresets(storage), null);

assert.equal(
  coerceStoredFeedTargetId('feed:card:card_type_01:node:cta', undefined, 'card_type_01'),
  'feed:card:card_type_01:node:cta',
);
assert.equal(
  coerceStoredFeedTargetId('feed:card:', 'legacy-cta', 'card_type_01'),
  'feed:card:card_type_01:node:legacy-cta',
);
assert.equal(
  coerceStoredFeedTargetId(undefined, ' legacy-cta ', 'card_type_01'),
  'feed:card:card_type_01:node:legacy-cta',
);
assert.equal(
  coerceStoredFeedTargetId('not-feed', '', 'card_type_01'),
  'feed:card:card_type_01',
);

console.log('Main material persistence tests passed');

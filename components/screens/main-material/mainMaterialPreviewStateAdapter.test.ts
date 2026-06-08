import assert from 'node:assert/strict';
import {
  createMainMaterialPreviewStateDocument,
  mainMaterialPreviewStateDocument,
  parseMainMaterialPreviewStateDocument,
  resolvePreviewStateCardTypeId,
  resolvePreviewStateFeedTargetId,
  resolvePreviewStateStoryId,
  serializeMainMaterialPreviewStateDocument,
} from './mainMaterialPreviewStateAdapter';

assert.equal(mainMaterialPreviewStateDocument.id, 'main-material-preview-state');
assert.equal(mainMaterialPreviewStateDocument.family, 'compatibility-editor-state');

assert.deepEqual(createMainMaterialPreviewStateDocument({
  selectedFeedStoryId: 'story-1',
  editingFeedNodeId: 'legacy-node',
  selectedFeedTargetId: 'feed:card:card_type_01',
}), {
  backdrop: undefined,
  title: undefined,
  feed: undefined,
  feedStories: undefined,
  feedCardTypes: undefined,
  feedStoryImageOverrides: undefined,
  selectedFeedStoryId: 'story-1',
  editingFeedCardTypeId: undefined,
  selectedFeedTargetId: 'feed:card:card_type_01',
  nav: undefined,
  surfaces: undefined,
});

assert.equal(
  serializeMainMaterialPreviewStateDocument({ selectedFeedStoryId: 'story-1' }),
  '{"selectedFeedStoryId":"story-1"}',
);
assert.equal(
  serializeMainMaterialPreviewStateDocument({ selectedFeedStoryId: 'story-1' }, 2),
  '{\n  "selectedFeedStoryId": "story-1"\n}',
);

assert.deepEqual(
  parseMainMaterialPreviewStateDocument('{"selectedFeedStoryId":"story-1"}'),
  { ok: true, state: { selectedFeedStoryId: 'story-1' } },
);
assert.deepEqual(parseMainMaterialPreviewStateDocument('  '), {
  ok: false,
  reason: 'empty',
  message: 'Import failed: no JSON was provided.',
});
assert.deepEqual(parseMainMaterialPreviewStateDocument('['), {
  ok: false,
  reason: 'invalid-json',
  message: 'Import failed: clipboard does not contain valid JSON.',
});
assert.deepEqual(parseMainMaterialPreviewStateDocument('[]'), {
  ok: false,
  reason: 'invalid-document',
  message: 'Import failed: clipboard JSON must be an object.',
});

const importedStories = [
  { id: 'story-imported', cardTypeId: 'card_type_02' },
  { id: 'story-other', cardTypeId: 'card_type_03' },
];
assert.equal(resolvePreviewStateStoryId('story-imported', importedStories, 'story-fallback'), 'story-imported');
assert.equal(resolvePreviewStateStoryId('missing-story', importedStories, 'story-fallback'), 'story-fallback');

const cardTypeIds = ['card_type_01', 'card_type_02', 'card_type_03'] as const;
assert.equal(resolvePreviewStateCardTypeId('card_type_02', cardTypeIds, 'card_type_01'), 'card_type_02');
assert.equal(resolvePreviewStateCardTypeId('unknown', cardTypeIds, 'card_type_01'), 'card_type_01');

assert.equal(
  resolvePreviewStateFeedTargetId({
    selectedFeedTargetId: 'feed:card:card_type_02:node:cta',
    editingFeedCardTypeId: 'card_type_02',
  }, cardTypeIds, 'card_type_01'),
  'feed:card:card_type_02:node:cta',
);
assert.equal(
  resolvePreviewStateFeedTargetId({
    editingFeedNodeId: 'legacy-cta',
    editingFeedCardTypeId: 'card_type_03',
  }, cardTypeIds, 'card_type_01'),
  'feed:card:card_type_03:node:legacy-cta',
);
assert.equal(
  resolvePreviewStateFeedTargetId({
    selectedFeedTargetId: 'not-feed',
    editingFeedCardTypeId: 'missing',
  }, cardTypeIds, 'card_type_01'),
  'feed:card:card_type_01',
);

console.log('Main material preview state adapter tests passed');

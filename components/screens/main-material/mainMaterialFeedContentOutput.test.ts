import assert from 'node:assert/strict';
import {
  createMainMaterialFeedContentPayload,
  serializeMainMaterialFeedContentPayload,
  validateMainMaterialFeedContentPayload,
} from './mainMaterialFeedContentOutput';
import type { FeedStory } from './mainMaterialFeedModel';

const story: FeedStory = {
  id: 'story_01',
  label: 'Solace Mainframe',
  cardTypeId: 'card_type_01',
  image: '/assets/solace.png',
  eyebrow: 'Available Contract',
  title: 'Data Extraction',
  body: 'Extract encrypted data.',
  meta: 'SEC 9',
  ctaLabel: 'Accept',
  contractBriefing: '[h1]Reward[/h1]',
  contractRewardValue: '1,800 K',
};

const payload = createMainMaterialFeedContentPayload(story);
assert.equal(payload.id, 'story_01');
assert.equal(payload.cardTypeId, 'card_type_01');
assert.equal(payload.title, 'Data Extraction');
assert.equal(payload.contractBriefing, '[h1]Reward[/h1]');
assert.equal(payload.contractRewardValue, '1,800 K');
assert.equal(payload.contractBadge, '');

const validated = validateMainMaterialFeedContentPayload(story);
assert.ok(validated);
assert.equal(validated.contractBriefing, '[h1]Reward[/h1]');

const serialized = serializeMainMaterialFeedContentPayload(story);
assert.ok(serialized.endsWith('\n'));
assert.equal(JSON.parse(serialized).title, 'Data Extraction');

console.log('Main material feed content output tests passed');

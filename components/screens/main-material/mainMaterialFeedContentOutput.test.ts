import assert from 'node:assert/strict';
import { configureLogging } from '../../../utils/logger';
import {
  applyMainMaterialFeedContentPayload,
  createMainMaterialFeedContentPayload,
  formatMainMaterialFeedContentJson,
  inspectMainMaterialFeedContentJson,
  parseMainMaterialFeedContentJson,
  serializeMainMaterialFeedContentPayload,
  validateMainMaterialFeedContentPayload,
} from './mainMaterialFeedContentOutput';
import type { FeedStory } from './mainMaterialFeedModel';

configureLogging({ level: 'silent', policy: 'continue' });

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

const imported = applyMainMaterialFeedContentPayload(story, {
  title: 'New Title',
  contractBriefing: '[h1]New Reward[/h1]',
  madeUp: 'ignored',
});
assert.equal(imported.ok, true);
assert.deepEqual(imported.changedSlots, ['title', 'contractBriefing']);
assert.equal(imported.story.title, 'New Title');
assert.equal(imported.story.contractBriefing, '[h1]New Reward[/h1]');
assert.equal(imported.story.body, story.body);

const invalidShape = applyMainMaterialFeedContentPayload(story, { title: ['bad'] });
assert.equal(invalidShape.ok, false);
assert.equal(invalidShape.story, story);

const parsed = parseMainMaterialFeedContentJson(story, '{"body":"Updated body"}');
assert.equal(parsed.ok, true);
assert.deepEqual(parsed.changedSlots, ['body']);
assert.equal(parsed.story.body, 'Updated body');

const invalidJson = parseMainMaterialFeedContentJson(story, '{not json');
assert.equal(invalidJson.ok, false);
assert.equal(invalidJson.message, 'Invalid JSON');

const cleanInspection = inspectMainMaterialFeedContentJson(story, serialized);
assert.equal(cleanInspection.ok, true);
assert.deepEqual(cleanInspection.changedSlots, []);

const changedInspection = inspectMainMaterialFeedContentJson(story, '{"title":"New Title","body":"Updated body"}');
assert.equal(changedInspection.ok, true);
assert.deepEqual(changedInspection.changedSlots, ['title', 'body']);

const invalidValueInspection = inspectMainMaterialFeedContentJson(story, '{"title":["bad"]}');
assert.equal(invalidValueInspection.ok, false);
assert.equal(invalidValueInspection.message, 'Invalid ui-node-content value at "title"');

const formatted = formatMainMaterialFeedContentJson(story, '{"body":"Updated body"}');
assert.equal(formatted.ok, true);
assert.equal(formatted.text, '{\n  "body": "Updated body"\n}\n');

const invalidFormat = formatMainMaterialFeedContentJson(story, '{"title":["bad"]}');
assert.equal(invalidFormat.ok, false);
assert.equal(invalidFormat.text, '{"title":["bad"]}');

console.log('Main material feed content output tests passed');

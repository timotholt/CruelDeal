import assert from 'node:assert/strict';
import { createMaterialRecipe, materialRecipeToResolvedSurface } from '../../ui/material-lab';
import { createMainMaterialExportPlan, type MainMaterialExportNode } from './mainMaterialExportPlanner';

interface TestNode extends MainMaterialExportNode {
  type: 'container' | 'button' | 'text';
}

const panelRecipe = createMaterialRecipe({
  material: 'white',
  texture: 'stoneGray01',
  textureStrength: 54,
  gradient: 'both',
  borderEnabled: true,
  border: ['top', 'bottom'],
  borderOpacity: 36,
});
const buttonRecipe = createMaterialRecipe({
  material: 'white',
  texture: 'none',
  gradient: 'none',
  borderEnabled: false,
});
const textNode: TestNode = {
  id: 'briefing',
  type: 'text',
  binding: 'briefing',
};
const buttonNode: TestNode = {
  id: 'cta',
  type: 'button',
  binding: 'ctaLabel',
};
const cardType = {
  id: 'card_type_01',
  surface: panelRecipe,
  children: [textNode, buttonNode],
};
const story = {
  id: 'story_01',
  cardTypeId: 'card_type_01',
};
const context = {
  selectedFeedStoryId: story.id,
  feedStories: [story],
  feedCardTypes: { card_type_01: cardType },
  fallbackStory: story,
  selectedState: 'rest' as const,
  surfaceRecipeForNode: (_card: typeof cardType, node: TestNode) => (
    node.type === 'button' ? buttonRecipe : panelRecipe
  ),
  surfacePropsForRecipe: (recipe: typeof panelRecipe) => materialRecipeToResolvedSurface(recipe, 'rest'),
  textForNode: (_story: typeof story, node: TestNode) => (
    node.type === 'button' ? 'View Contract' : 'Mission Briefing'
  ),
};

const rootExport = createMainMaterialExportPlan('feed:card:card_type_01', context);
assert.ok(rootExport);
assert.equal(rootExport.kind, 'feed-panel');
assert.match(rootExport.html, /<section class="[^"]*\bcd-panel\b/);
assert.match(rootExport.html, /main-material-card-node-surface--slide/);
assert.ok(rootExport.metrics.nodeCount > 0);

const textExport = createMainMaterialExportPlan('feed:card:card_type_01:node:briefing', context);
assert.ok(textExport);
assert.equal(textExport.kind, 'feed-panel');
assert.match(textExport.html, /<section class="[^"]*\bcd-panel\b/);
assert.match(textExport.html, /main-material-card-node-surface--text/);
assert.match(textExport.html, /main-material-card-node--briefing/);
assert.match(textExport.html, /Mission Briefing/);
assert.ok(textExport.metrics.nodeCount > 0);

const buttonExport = createMainMaterialExportPlan('feed:card:card_type_01:node:cta', context);
assert.ok(buttonExport);
assert.equal(buttonExport.kind, 'feed-button');
assert.match(buttonExport.html, /<button class="[^"]*\bcd-button\b/);
assert.match(buttonExport.html, /View Contract/);

console.log('Main material export planner tests passed');

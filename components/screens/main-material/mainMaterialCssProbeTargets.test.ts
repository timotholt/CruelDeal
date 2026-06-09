import assert from 'node:assert/strict';
import { createFeedNode, type FeedCardNode } from './mainMaterialFeedModel';
import { findMainMaterialCssProbeNode } from './mainMaterialCssProbeTargets';

const feedNode: FeedCardNode = createFeedNode({
  id: 'briefing',
  type: 'text',
  label: 'Briefing',
});

const context = {
  feedCardTypes: {
    card_type_01: {
      children: [feedNode],
    },
  },
};

assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'feed:card:card_type_01:node:briefing' })?.id,
  'briefing',
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'feed:card:card_type_01' }),
  undefined,
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'topBar' })?.id,
  'topbar-root',
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'topbar:profile' })?.id,
  'topbar-profile',
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'toolBar' })?.id,
  'toolbar-root',
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'toolbar:toolbar-log' })?.id,
  'toolbar-log',
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'navBarContainer' })?.id,
  'nav-shell',
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'nav:item:0' })?.id,
  'nav-battle-pass',
);
assert.equal(
  findMainMaterialCssProbeNode({ ...context, targetId: 'missing' }),
  undefined,
);

console.log('Main material CSS probe target tests passed');

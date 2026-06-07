import assert from 'node:assert/strict';
import { createMainMaterialDomRegistry } from './mainMaterialDomRegistry';

const element = (isConnected: boolean): HTMLElement => ({ isConnected }) as HTMLElement;

let changes = 0;
const registry = createMainMaterialDomRegistry(() => {
  changes += 1;
});

const firstId = registry.createInstanceId();
const secondId = registry.createInstanceId();
assert.equal(firstId, 'material_00001');
assert.equal(secondId, 'material_00002');

const exactElement = element(true);
registry.register('feed:card:card_type_01:node:cta', firstId, exactElement);
assert.equal(changes, 1);
registry.register('feed:card:card_type_01:node:cta', firstId, exactElement);
assert.equal(changes, 1);
assert.equal(registry.findTarget('feed:card:card_type_01:node:cta')?.exact, true);

registry.register('feed:card:other:node:cta', secondId, element(true));
const fuzzy = registry.findTarget('feed:card:missing:node:cta');
assert.equal(fuzzy?.entry.targetId, 'feed:card:card_type_01:node:cta');
assert.equal(fuzzy?.exact, false);

registry.register('feed:card:stale:node:gone', 'stale', element(false));
assert.equal(registry.liveEntries().some((entry) => entry.instanceId === 'stale'), false);

registry.unregister(firstId);
assert.equal(changes, 4);
assert.equal(registry.findTarget('feed:card:card_type_01:node:cta')?.entry.targetId, 'feed:card:other:node:cta');
registry.unregister('missing');
assert.equal(changes, 4);

console.log('Main material DOM registry tests passed');


import assert from 'node:assert/strict';
import {
  createMainMaterialExportGroupDescriptor,
  mainMaterialExportGroupForTarget,
} from './mainMaterialExportGroups';

assert.deepEqual(createMainMaterialExportGroupDescriptor('target-a'), {
  mode: 'subtree',
  rootTargetId: 'target-a',
});

const descriptors = {
  child: createMainMaterialExportGroupDescriptor('parent'),
};

assert.equal(mainMaterialExportGroupForTarget('child', descriptors).rootTargetId, 'parent');
assert.equal(mainMaterialExportGroupForTarget('missing', descriptors).rootTargetId, 'missing');

console.log('Main material export group descriptor tests passed');

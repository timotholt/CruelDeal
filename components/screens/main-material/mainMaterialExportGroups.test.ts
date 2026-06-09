import assert from 'node:assert/strict';
import {
  createMainMaterialExportGroupDescriptor,
  mainMaterialExportGroupDescriptorsForTargets,
  mainMaterialExportGroupForTarget,
  missingMainMaterialExportGroupTargetIds,
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

const targetDescriptors = mainMaterialExportGroupDescriptorsForTargets([
  {
    id: 'root',
    exportGroup: createMainMaterialExportGroupDescriptor('root'),
    children: [
      {
        id: 'child',
        exportGroup: createMainMaterialExportGroupDescriptor('root'),
      },
      {
        id: 'undocumented',
      },
    ],
  },
]);
assert.equal(targetDescriptors.root.rootTargetId, 'root');
assert.equal(targetDescriptors.child.rootTargetId, 'root');
assert.equal(targetDescriptors.undocumented, undefined);
assert.deepEqual(
  missingMainMaterialExportGroupTargetIds(['root', 'child', 'undocumented'], targetDescriptors),
  ['undocumented'],
);

console.log('Main material export group descriptor tests passed');

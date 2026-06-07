import assert from 'node:assert/strict';
import {
  findTreeNodeById,
  flattenTargetTree,
  updateTreeNodeById,
} from './mainMaterialTargetTree';

interface TestNode {
  id: string;
  label: string;
  children?: TestNode[];
}

const tree: TestNode[] = [
  {
    id: 'root',
    label: 'Root',
    children: [
      { id: 'child-a', label: 'Child A' },
      {
        id: 'child-b',
        label: 'Child B',
        children: [{ id: 'grandchild', label: 'Grandchild' }],
      },
    ],
  },
];

assert.deepEqual(
  flattenTargetTree(tree).map((entry) => [entry.target.id, entry.depth]),
  [['root', 0], ['child-a', 1], ['child-b', 1], ['grandchild', 2]],
);

assert.equal(findTreeNodeById(tree, 'grandchild')?.label, 'Grandchild');
assert.equal(findTreeNodeById(tree, 'missing'), undefined);

const updated = updateTreeNodeById(tree, 'grandchild', (node) => ({
  ...node,
  label: 'Updated',
}));

assert.equal(findTreeNodeById(updated, 'grandchild')?.label, 'Updated');
assert.equal(findTreeNodeById(tree, 'grandchild')?.label, 'Grandchild');
assert.notEqual(updated, tree);

console.log('Main material target tree tests passed');


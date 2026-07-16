import { describe, expect, it } from 'vitest';
import { materialWorkbenchPartsToTreeData, type MaterialWorkbenchPart } from './MaterialWorkbenchLayout';

describe('materialWorkbenchPartsToTreeData', () => {
  it('turns the existing depth contract into stable nested tree nodes', () => {
    const parts: MaterialWorkbenchPart<'panel' | 'title' | 'body' | 'nav'>[] = [
      { id: 'panel', label: 'Panel', detail: 'container', depth: 0 },
      { id: 'title', label: 'Title', detail: 'text', depth: 1 },
      { id: 'body', label: 'Body', detail: 'text', depth: 1 },
      { id: 'nav', label: 'Navigation', detail: 'group', depth: 0 },
    ];
    expect(materialWorkbenchPartsToTreeData(parts)).toEqual([
      {
        id: 'panel', label: 'Panel', status: 'container', type: 'material-workbench-part',
        children: [
          { id: 'title', label: 'Title', status: 'text', type: 'material-workbench-part', children: [] },
          { id: 'body', label: 'Body', status: 'text', type: 'material-workbench-part', children: [] },
        ],
      },
      { id: 'nav', label: 'Navigation', status: 'group', type: 'material-workbench-part', children: [] },
    ]);
  });

  it('clamps malformed depth jumps to the nearest real parent', () => {
    const parts: MaterialWorkbenchPart<'root' | 'child'>[] = [
      { id: 'root', label: 'Root', depth: 0 },
      { id: 'child', label: 'Child', depth: 3 },
    ];
    expect(materialWorkbenchPartsToTreeData(parts)[0].children?.[0].id).toBe('child');
  });
});

import { describe, expect, it } from 'vitest';
import type { MaterialWorkbenchPart } from '../../ui/material-lab';
import type { MainWorkbenchPartId } from './mainMaterialSelectionModel';
import {
  missionBriefingPartForTargetId,
  missionBriefingPartTargetId,
  missionBriefingV2RootTargetId,
  withMissionBriefingSemanticWorkbenchParts,
} from './missionBriefingWorkbenchModel';

describe('Mission Briefing semantic workbench tree', () => {
  it('replaces legacy Feed children with compiler-owned semantic parts', () => {
    const parts: Array<MaterialWorkbenchPart<MainWorkbenchPartId>> = [
      { id: missionBriefingV2RootTargetId, label: 'Mission Briefing V2', depth: 0 },
      { id: 'feed:card:card_type_04:node:deadline-badge', label: 'Deadline Badge', depth: 1 },
      { id: 'feed:card:card_type_04:node:mission-briefing', label: 'Mission Briefing', depth: 1 },
      { id: 'feed:card:card_type_02', label: 'Feed Card 2', depth: 0 },
    ];

    const result = withMissionBriefingSemanticWorkbenchParts(parts);
    expect(result.map((part) => part.label)).toEqual([
      'Mission Briefing V2',
      'Content & Panel',
      'Reward Region',
      'Fingerprint Action',
      'Feed Card 2',
    ]);
    expect(result.slice(1, 4).every((part) => part.depth === 1)).toBe(true);
  });

  it('maps semantic tree targets back to their appearance owner', () => {
    expect(missionBriefingPartForTargetId(missionBriefingV2RootTargetId)).toBeNull();
    expect(missionBriefingPartForTargetId(missionBriefingPartTargetId('terms'))).toBe('terms');
    expect(missionBriefingPartForTargetId('feed:card:card_type_02')).toBeUndefined();
  });
});

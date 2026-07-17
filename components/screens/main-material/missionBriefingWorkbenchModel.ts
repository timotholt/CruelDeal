import type { MaterialWorkbenchPart } from '../../ui/material-lab';
import type { AppearancePartId } from '../../ui/semantic-compiler/paint/paintSource';
import {
  feedCardMaterialTargetId,
  feedMaterialTargetIdForNode,
  type FeedMaterialTargetId,
} from './materialTargetIds';
import type { MainWorkbenchPartId } from './mainMaterialSelectionModel';

export const missionBriefingV2RootTargetId = feedCardMaterialTargetId('card_type_04');

const missionBriefingPartNodeIds: Record<AppearancePartId, string> = {
  panel: '$semantic-panel',
  terms: '$semantic-terms',
  primaryAction: '$semantic-primary-action',
};

const missionBriefingPartLabels: Record<AppearancePartId, string> = {
  panel: 'Content & Panel',
  terms: 'Reward Region',
  primaryAction: 'Fingerprint Action',
};

export const missionBriefingPartTargetId = (part: AppearancePartId): FeedMaterialTargetId => (
  feedMaterialTargetIdForNode('card_type_04', missionBriefingPartNodeIds[part])
);

/** `null` is the semantic component root; `undefined` is not a Mission V2 target. */
export const missionBriefingPartForTargetId = (
  targetId: string,
): AppearancePartId | null | undefined => {
  if (targetId === missionBriefingV2RootTargetId) return null;
  return (Object.keys(missionBriefingPartNodeIds) as AppearancePartId[]).find(
    (part) => targetId === missionBriefingPartTargetId(part),
  );
};

/** Replaces compatibility-era Feed nodes with the semantic component's real parts. */
export const withMissionBriefingSemanticWorkbenchParts = (
  parts: Array<MaterialWorkbenchPart<MainWorkbenchPartId>>,
): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => parts.flatMap((part) => {
  if (part.id === missionBriefingV2RootTargetId) {
    return [
      { ...part, detail: 'semantic component' },
      ...(Object.keys(missionBriefingPartNodeIds) as AppearancePartId[]).map((appearancePart) => ({
        id: missionBriefingPartTargetId(appearancePart) as MainWorkbenchPartId,
        label: missionBriefingPartLabels[appearancePart],
        detail: 'compiled semantic part',
        depth: 1,
      })),
    ];
  }
  if (String(part.id).startsWith(`${missionBriefingV2RootTargetId}:node:`)) return [];
  return [part];
});

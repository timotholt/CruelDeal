export interface MainMaterialExportGroupDescriptor {
  mode: 'subtree';
  rootTargetId: string;
}

export interface MainMaterialExportGroupTarget {
  id: string;
  exportGroup?: MainMaterialExportGroupDescriptor;
  children?: MainMaterialExportGroupTarget[];
}

export const createMainMaterialExportGroupDescriptor = (
  rootTargetId: string,
): MainMaterialExportGroupDescriptor => ({
  mode: 'subtree',
  rootTargetId,
});

export const mainMaterialExportGroupForTarget = (
  targetId: string,
  descriptors: Record<string, MainMaterialExportGroupDescriptor | undefined>,
): MainMaterialExportGroupDescriptor => (
  descriptors[targetId] ?? createMainMaterialExportGroupDescriptor(targetId)
);

export const mainMaterialExportGroupDescriptorsForTargets = (
  targets: MainMaterialExportGroupTarget[],
): Record<string, MainMaterialExportGroupDescriptor> => (
  targets.reduce<Record<string, MainMaterialExportGroupDescriptor>>((descriptors, target) => {
    if (target.exportGroup) descriptors[target.id] = target.exportGroup;
    return {
      ...descriptors,
      ...mainMaterialExportGroupDescriptorsForTargets(target.children || []),
    };
  }, {})
);

export const missingMainMaterialExportGroupTargetIds = (
  targetIds: readonly string[],
  descriptors: Record<string, MainMaterialExportGroupDescriptor | undefined>,
): string[] => (
  targetIds.filter((targetId) => !descriptors[targetId])
);

export interface MainMaterialExportGroupDescriptor {
  mode: 'subtree';
  rootTargetId: string;
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

import {
  domAuditMetrics,
  domAuditNodeToCss,
  domAuditNodeToHtml,
  emptyEmissionMetrics,
  type DomAuditNode,
} from './mainMaterialDomAudit';

export interface MainMaterialDomExportGroup {
  root: DomAuditNode;
  targetIds: string[];
  html: string;
  css: string;
  metrics: ReturnType<typeof emptyEmissionMetrics>;
}

export const domAuditTargetIds = (node: DomAuditNode | null): string[] => {
  if (!node) return [];
  const ids = new Set<string>();
  const visit = (current: DomAuditNode) => {
    current.attrs.forEach((token) => {
      if (token.name === 'data-material-target-id' && token.value) ids.add(token.value);
    });
    current.children.forEach(visit);
  };
  visit(node);
  return Array.from(ids);
};

export const createMainMaterialDomExportGroup = (
  root: DomAuditNode | null,
): MainMaterialDomExportGroup | null => {
  if (!root) return null;
  return {
    root,
    targetIds: domAuditTargetIds(root),
    html: domAuditNodeToHtml(root),
    css: domAuditNodeToCss(root),
    metrics: domAuditMetrics(root),
  };
};

export const domExportGroupContainsTargetId = (
  group: MainMaterialDomExportGroup | null,
  targetId: string,
): boolean => (
  Boolean(group?.targetIds.includes(targetId))
);

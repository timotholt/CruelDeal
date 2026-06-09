import type {
  EmissionMetrics,
  MaterialEmissionPlan,
} from '../../ui/material-lab';
import {
  domAuditNodeToHtml,
  emptyEmissionMetrics,
  exportPlanToDomAuditNode,
  type DomAuditNode,
} from './mainMaterialDomAudit';
import {
  createMainMaterialExportPlan,
  type MainMaterialExportFeedCardType,
  type MainMaterialExportFeedStory,
  type MainMaterialExportNode,
  type MainMaterialExportPlannerContext,
  type MainMaterialExportResult,
} from './mainMaterialExportPlanner';

export type EmissionInspectorTab = 'frame-css' | 'editor-dom' | 'export-dom' | 'export-css';
export type MainMaterialExportPayloadSource = 'live-dom' | 'fallback-plan';

export const tabLabel = (tab: EmissionInspectorTab) => ({
  'frame-css': 'Frame CSS',
  'editor-dom': 'Editor DOM',
  'export-dom': 'Export DOM',
  'export-css': 'Export CSS',
}[tab]);

export const cssDeclarationText = (key: string, value: string | number) => `${key}: ${value};`;

export interface MainMaterialEmissionExportSnapshot {
  source: 'fallback-plan' | null;
  result: MainMaterialExportResult | null;
  plan: MaterialEmissionPlan | null;
  domSnapshot: DomAuditNode | null;
  html: string;
  css: string;
  metrics: EmissionMetrics;
}

export const mainMaterialEmissionExportSnapshot = (
  result: MainMaterialExportResult | null,
): MainMaterialEmissionExportSnapshot => {
  const plan = result?.plan ?? null;
  return {
    source: result ? 'fallback-plan' : null,
    result,
    plan,
    domSnapshot: exportPlanToDomAuditNode(plan),
    html: result?.html ?? '',
    css: result?.css ?? '',
    metrics: result?.metrics ?? emptyEmissionMetrics(),
  };
};

export const createMainMaterialEmissionExport = <
  TNode extends MainMaterialExportNode,
  TCardType extends MainMaterialExportFeedCardType<TNode>,
  TStory extends MainMaterialExportFeedStory,
>(
  targetId: string,
  context: MainMaterialExportPlannerContext<TNode, TCardType, TStory>,
) => mainMaterialEmissionExportSnapshot(createMainMaterialExportPlan(targetId, context));

export interface MainMaterialEmissionPayloadContext {
  tab: EmissionInspectorTab;
  editorDomSnapshot: DomAuditNode | null;
  exportHtml: string;
  exportCss: string;
  frameCssLines: Array<[string, string | number]>;
}

export const activeEmissionPayload = (context: MainMaterialEmissionPayloadContext) => {
  if (context.tab === 'editor-dom') {
    return context.editorDomSnapshot ? domAuditNodeToHtml(context.editorDomSnapshot) : '';
  }
  if (context.tab === 'export-dom') return context.exportHtml;
  if (context.tab === 'export-css') return context.exportCss;
  return context.frameCssLines.map(([key, value]) => cssDeclarationText(key, value)).join('\n');
};

export const emissionInspectorTabStatus = (tab: EmissionInspectorTab) => (
  tab === 'frame-css'
    ? 'Showing frame layout CSS only'
    : tab === 'editor-dom'
    ? 'Showing cleaned live editor DOM subtree'
    : tab === 'export-css'
    ? 'Showing selected target export CSS payload'
    : 'Showing selected target export DOM payload'
);

export const refreshedEmissionPayloadStatus = (
  tab: EmissionInspectorTab,
  source: MainMaterialExportPayloadSource | null,
) => (
  source === 'live-dom'
    ? `Refreshed ${tabLabel(tab)} from live DOM`
    : source === 'fallback-plan'
    ? `Refreshed ${tabLabel(tab)} from fallback plan`
    : `No ${tabLabel(tab)} payload for this target`
);

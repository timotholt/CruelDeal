import type {
  EmissionMetrics,
  MaterialEmissionPlan,
} from '../../ui/material-lab';
import {
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

export interface MainMaterialCompatibilityExportSnapshot {
  source: 'fallback-plan' | null;
  result: MainMaterialExportResult | null;
  plan: MaterialEmissionPlan | null;
  domSnapshot: DomAuditNode | null;
  html: string;
  css: string;
  metrics: EmissionMetrics;
}

export const mainMaterialCompatibilityExportSnapshot = (
  result: MainMaterialExportResult | null,
): MainMaterialCompatibilityExportSnapshot => {
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

export const createMainMaterialCompatibilityExport = <
  TNode extends MainMaterialExportNode,
  TCardType extends MainMaterialExportFeedCardType<TNode>,
  TStory extends MainMaterialExportFeedStory,
>(
  targetId: string,
  context: MainMaterialExportPlannerContext<TNode, TCardType, TStory>,
) => mainMaterialCompatibilityExportSnapshot(createMainMaterialExportPlan(targetId, context));

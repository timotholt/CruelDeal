import {
  validateMissionBriefingSourceV1,
  type ContentSourceV1,
  type MissionBriefingSourceV1,
  type NumericSourceV1,
} from '../../semantic-authoring/mission-briefing/missionBriefingSource';
import type { FingerprintHoldActionRuntimePlanV1 } from '../../semantic-runtime/fingerprint-hold/fingerprintHoldRuntimePlan';
import {
  compileMissionPaintV1,
  paintClassForGraphId,
  paintShellClassMapForGraphId,
  type PaintAllocationReportV1,
  type PaintIrV1,
  type PaintShellClassMapV1,
} from '../paint/paintCompiler';
import {
  validateMissionAppearanceDocumentV1,
  type AppearanceGraphSourceV1,
  type MissionAppearanceDocumentV1,
} from '../paint/paintSource';
import {
  compileCruelMarkupV1,
  type CruelMarkupTokenV1,
} from '../rich-text/cruelMarkupV1';
import {
  compileMissionTypographyV1,
  type MissionTypographyRoleId,
} from '../typography/missionTypography';

export const MISSION_BRIEFING_COMPILER_VERSION = 'semantic-ui-v1' as const;

export type RuntimeContentV1 =
  | { kind: 'literal'; format: 'plain' | 'cruel-markup-v1'; value: string; plainText: string; tokens: CruelMarkupTokenV1[] }
  | { kind: 'binding'; key: string };

export type RuntimeNumberV1 =
  | { kind: 'literal'; value: number }
  | { kind: 'binding'; key: string };

export interface MissionBriefingShellMapV1 {
  panel: PaintShellClassMapV1;
  terms: PaintShellClassMapV1;
  primaryAction: {
    slots: {
      underlay: boolean;
      overlay: boolean;
    };
    idle: PaintShellClassMapV1;
    holding: PaintShellClassMapV1;
    complete: PaintShellClassMapV1;
    disabled: PaintShellClassMapV1;
  };
}

export interface MissionBriefingComponentPlanV1 {
  schemaVersion: 1;
  compilerVersion: typeof MISSION_BRIEFING_COMPILER_VERSION;
  targetProfile: 'chromium-primary-v1';
  component: {
    type: 'MissionBriefing';
    componentInstanceId: string;
    layoutVariant: 'contract-left';
    content: {
      title: RuntimeContentV1;
      body: RuntimeContentV1;
      availabilityStatus?: RuntimeContentV1;
      deadline?: RuntimeContentV1;
      sectorMark?: RuntimeContentV1;
      progress?: { completed: number; total: number };
      terms: {
        deposit?: { amount: RuntimeNumberV1; currencyCode: string };
        successReward: { amount: RuntimeNumberV1; currencyCode: string };
      };
      primaryActionLabel: RuntimeContentV1;
    };
    action: FingerprintHoldActionRuntimePlanV1;
  };
  classMap: {
    panel: string;
    terms: string;
    primaryAction: {
      idle: string;
      holding: string;
      complete: string;
      disabled: string;
    };
    typography: Record<MissionTypographyRoleId, string>;
  };
  shellMap?: MissionBriefingShellMapV1;
}

export interface MissionBriefingCompileDiagnosticV1 {
  severity: 'info' | 'warning';
  code: string;
  path: string;
  message: string;
}

export type MissionBriefingComponentCompileResult =
  | {
    ok: true;
    plan: MissionBriefingComponentPlanV1;
    appearanceCss: string;
    paintIr: PaintIrV1;
    allocation: PaintAllocationReportV1;
    diagnostics: MissionBriefingCompileDiagnosticV1[];
  }
  | { ok: false; issues: Array<{ path: string; message: string }> };

const legacyAppearanceAliases: Readonly<Record<string, string>> = {
  'legacy-card-type-04.panel-idle': 'mission-v2-r0.panel.idle',
  'legacy-card-type-04.terms-idle': 'mission-v2-r0.terms.idle',
  'legacy-card-type-04.primary-action-idle': 'mission-v2-r0.primary-action.idle',
  'legacy-card-type-04.fingerprint-idle': 'mission-v2-r0.primary-action.idle',
  'legacy-card-type-04.fingerprint-holding': 'mission-v2-r0.primary-action.holding',
  'legacy-card-type-04.fingerprint-complete': 'mission-v2-r0.primary-action.complete',
  'legacy-card-type-04.fingerprint-disabled': 'mission-v2-r0.primary-action.disabled',
};

const compileContent = (source: ContentSourceV1): RuntimeContentV1 => (
  'inline' in source
    ? { kind: 'literal', format: source.inline.format, value: source.inline.value, ...compileCruelMarkupV1(source.inline.value, source.inline.format) }
    : { kind: 'binding', key: source.binding.key }
);

const compileNumber = (source: NumericSourceV1): RuntimeNumberV1 => (
  'literal' in source
    ? { kind: 'literal', value: source.literal }
    : { kind: 'binding', key: source.binding.key }
);

const accessibleActionLabel = (source: ContentSourceV1) => (
  'inline' in source && source.inline.value.trim()
    ? compileCruelMarkupV1(source.inline.value, source.inline.format).plainText
    : 'Mission action'
);

const resolveAppearanceReference = (
  reference: string | undefined,
  path: string,
  expectedPart: AppearanceGraphSourceV1['part'],
  expectedState: AppearanceGraphSourceV1['state'],
  graphsById: ReadonlyMap<string, AppearanceGraphSourceV1>,
  diagnostics: MissionBriefingCompileDiagnosticV1[],
): { ok: true; graph: AppearanceGraphSourceV1 } | { ok: false; issue: { path: string; message: string } } => {
  if (!reference) return { ok: false, issue: { path, message: 'Required appearance reference is missing.' } };
  const resolved = legacyAppearanceAliases[reference] ?? reference;
  if (resolved !== reference) {
    diagnostics.push({
      severity: 'warning',
      code: 'legacy-appearance-alias',
      path,
      message: `${reference} compiled through the explicit ${resolved} compatibility alias.`,
    });
  }
  const graph = graphsById.get(resolved);
  if (!graph) return { ok: false, issue: { path, message: `Appearance graph ${resolved} does not exist.` } };
  if (graph.part !== expectedPart || graph.state !== expectedState) {
    return {
      ok: false,
      issue: {
        path,
        message: `Appearance graph ${resolved} is ${graph.part}/${graph.state}; expected ${expectedPart}/${expectedState}.`,
      },
    };
  }
  return { ok: true, graph };
};

export const compileMissionBriefingComponentV1 = (
  sourceInput: unknown,
  appearanceInput: unknown,
): MissionBriefingComponentCompileResult => {
  const sourceResult = validateMissionBriefingSourceV1(sourceInput);
  if (!sourceResult.ok) return sourceResult;
  const appearanceResult = validateMissionAppearanceDocumentV1(appearanceInput);
  if (!appearanceResult.ok) return appearanceResult;
  const paintResult = compileMissionPaintV1(appearanceResult.document);
  if (!paintResult.ok) return paintResult;
  const typographyResult = compileMissionTypographyV1(appearanceResult.document.typography);
  if (!typographyResult.ok) return { ok: false, issues: typographyResult.issues.map((issue) => ({ path: 'typography', message: issue.message })) };

  const source: MissionBriefingSourceV1 = sourceResult.source;
  const appearance: MissionAppearanceDocumentV1 = appearanceResult.document;
  const graphsById = new Map(appearance.graphs.map((graph) => [graph.id, graph]));
  const diagnostics: MissionBriefingCompileDiagnosticV1[] = [];
  const references = {
    panel: resolveAppearanceReference(source.appearance['panel.idle'], 'appearance.panel.idle', 'panel', 'idle', graphsById, diagnostics),
    terms: resolveAppearanceReference(source.appearance['terms.idle'], 'appearance.terms.idle', 'terms', 'idle', graphsById, diagnostics),
    actionIdle: resolveAppearanceReference(source.slots.primaryAction.appearance.idle, 'slots.primaryAction.appearance.idle', 'primaryAction', 'idle', graphsById, diagnostics),
    actionHolding: resolveAppearanceReference(source.slots.primaryAction.appearance.holding, 'slots.primaryAction.appearance.holding', 'primaryAction', 'holding', graphsById, diagnostics),
    actionComplete: resolveAppearanceReference(source.slots.primaryAction.appearance.complete, 'slots.primaryAction.appearance.complete', 'primaryAction', 'complete', graphsById, diagnostics),
    actionDisabled: resolveAppearanceReference(source.slots.primaryAction.appearance.disabled, 'slots.primaryAction.appearance.disabled', 'primaryAction', 'disabled', graphsById, diagnostics),
  };
  const issues = Object.values(references).flatMap((result) => result.ok ? [] : [result.issue]);
  if (
    !references.panel.ok
    || !references.terms.ok
    || !references.actionIdle.ok
    || !references.actionHolding.ok
    || !references.actionComplete.ok
    || !references.actionDisabled.ok
  ) {
    return { ok: false, issues };
  }

  if (source.appearance['frame.idle']) {
    diagnostics.push({
      severity: 'info',
      code: 'frame-owned-by-layout-variant',
      path: 'appearance.frame.idle',
      message: 'contract-left owns its screen-relative frame; the panel graph owns visible frame paint.',
    });
  }

  const primaryAction = source.slots.primaryAction;
  const actionShellMaps = {
    idle: paintShellClassMapForGraphId(paintResult.allocation, references.actionIdle.graph.id),
    holding: paintShellClassMapForGraphId(paintResult.allocation, references.actionHolding.graph.id),
    complete: paintShellClassMapForGraphId(paintResult.allocation, references.actionComplete.graph.id),
    disabled: paintShellClassMapForGraphId(paintResult.allocation, references.actionDisabled.graph.id),
  };
  const shellMap: MissionBriefingShellMapV1 = {
    panel: paintShellClassMapForGraphId(paintResult.allocation, references.panel.graph.id),
    terms: paintShellClassMapForGraphId(paintResult.allocation, references.terms.graph.id),
    primaryAction: {
      slots: {
        underlay: Object.values(actionShellMaps).some((map) => Boolean(map.underlay)),
        overlay: Object.values(actionShellMaps).some((map) => Boolean(map.overlay)),
      },
      ...actionShellMaps,
    },
  };
  const needsShell = Boolean(
    shellMap.panel.underlay
    || shellMap.panel.overlay
    || shellMap.terms.underlay
    || shellMap.terms.overlay
    || shellMap.primaryAction.slots.underlay
    || shellMap.primaryAction.slots.overlay
  );
  const plan: MissionBriefingComponentPlanV1 = {
    schemaVersion: 1,
    compilerVersion: MISSION_BRIEFING_COMPILER_VERSION,
    targetProfile: appearance.targetProfile,
    component: {
      type: 'MissionBriefing',
      componentInstanceId: source.id,
      layoutVariant: source.layoutVariant,
      content: {
        title: compileContent(source.slots.title),
        body: compileContent(source.slots.body),
        ...(source.slots.availabilityStatus ? { availabilityStatus: compileContent(source.slots.availabilityStatus) } : {}),
        ...(source.slots.deadline ? { deadline: compileContent(source.slots.deadline) } : {}),
        ...(source.slots.sectorMark ? { sectorMark: compileContent(source.slots.sectorMark) } : {}),
        ...(source.slots.progress ? { progress: { ...source.slots.progress } } : {}),
        terms: {
          ...(source.slots.terms.deposit ? {
            deposit: {
              amount: compileNumber(source.slots.terms.deposit.amount),
              currencyCode: source.slots.terms.deposit.currencyCode,
            },
          } : {}),
          successReward: {
            amount: compileNumber(source.slots.terms.successReward.amount),
            currencyCode: source.slots.terms.successReward.currencyCode,
          },
        },
        primaryActionLabel: compileContent(primaryAction.label),
      },
      action: {
        type: 'FingerprintHoldActionRuntimePlanV1',
        componentInstanceId: primaryAction.id,
        actionId: primaryAction.actionId,
        actionType: 'fingerprint-hold/v1',
        holdDurationMs: primaryAction.holdDurationMs,
        acknowledgementMs: 520,
        disabled: primaryAction.disabled,
        accessibleLabel: accessibleActionLabel(primaryAction.label),
      },
    },
    classMap: {
      panel: paintClassForGraphId(references.panel.graph.id),
      terms: paintClassForGraphId(references.terms.graph.id),
      primaryAction: {
        idle: paintClassForGraphId(references.actionIdle.graph.id),
        holding: paintClassForGraphId(references.actionHolding.graph.id),
        complete: paintClassForGraphId(references.actionComplete.graph.id),
        disabled: paintClassForGraphId(references.actionDisabled.graph.id),
      },
      typography: typographyResult.classMap,
    },
    ...(needsShell ? { shellMap } : {}),
  };
  return {
    ok: true,
    plan,
    appearanceCss: `${paintResult.css}\n${typographyResult.css}`,
    paintIr: paintResult.paintIr,
    allocation: paintResult.allocation,
    diagnostics,
  };
};

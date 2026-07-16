import { describe, expect, it } from 'vitest';
import source from '../../semantic-authoring/mission-briefing/__fixtures__/mission-briefing-v1.inline.json';
import appearance from '../paint/__fixtures__/mission-v2-r0.appearance.json';
import { compileMissionBriefingComponentV1 } from './missionBriefingComponentCompiler';
import { missionV2CompiledPlan } from '../../semantic-runtime/mission-briefing/missionV2Artifact';

describe('Mission Briefing component compiler', () => {
  it('lowers authoring source into the complete runtime API', () => {
    const result = compileMissionBriefingComponentV1(source, appearance);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.component.type).toBe('MissionBriefing');
    expect(result.plan.component.componentInstanceId).toBe('mission.data-extraction');
    expect(result.plan.component.action).toMatchObject({
      actionId: 'mission.accept-terms',
      actionType: 'fingerprint-hold/v1',
      holdDurationMs: 1400,
    });
    expect(result.plan.classMap).toEqual({
      panel: 'ui-paint-mission-v2-r0-panel-idle',
      terms: 'ui-paint-mission-v2-r0-terms-idle',
      primaryAction: {
        idle: 'ui-paint-mission-v2-r0-primary-action-idle',
        holding: 'ui-paint-mission-v2-r0-primary-action-holding',
        complete: 'ui-paint-mission-v2-r0-primary-action-complete',
        disabled: 'ui-paint-mission-v2-r0-primary-action-disabled',
      },
      typography: {
        title: 'ui-type-mission-title',
        body: 'ui-type-mission-body',
        availability: 'ui-type-mission-availability',
        termLabel: 'ui-type-mission-termlabel',
        termValue: 'ui-type-mission-termvalue',
        actionLabel: 'ui-type-mission-actionlabel',
      },
    });
    expect(result.plan.component.content.title).toMatchObject({
      kind: 'literal',
      format: 'cruel-markup-v1',
      plainText: 'Data\nExtraction',
    });
    expect(result.appearanceCss).toContain('.mission-rich-token--muted');
    expect(JSON.stringify(result.plan)).not.toContain('appearance');
    expect(result.plan).toEqual(missionV2CompiledPlan);
  });

  it('rejects missing or wrong-part appearance references', () => {
    const invalid = structuredClone(source);
    invalid.slots.primaryAction.appearance.holding = 'mission-v2-r0.panel.idle';
    const result = compileMissionBriefingComponentV1(invalid, appearance);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({
      path: 'slots.primaryAction.appearance.holding',
    }));
  });

  it('records an explicit diagnostic when compiling a protected legacy alias', () => {
    const legacy = structuredClone(source);
    legacy.appearance['panel.idle'] = 'legacy-card-type-04.panel-idle';
    const result = compileMissionBriefingComponentV1(legacy, appearance);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'legacy-appearance-alias',
      path: 'appearance.panel.idle',
    }));
  });
});

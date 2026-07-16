import { renderToString } from 'solid-js/web';
import type { MissionBriefingComponentPlanV1 } from '../components/ui/semantic-compiler/mission-briefing/missionBriefingComponentCompiler';
import { MissionBriefingRuntime } from '../components/ui/semantic-runtime/mission-briefing/MissionBriefingRuntime';

export const renderMissionBriefingReference = (plan: MissionBriefingComponentPlanV1) => (
  renderToString(() => <MissionBriefingRuntime plan={plan} onAction={() => undefined} />)
);

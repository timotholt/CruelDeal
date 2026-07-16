import componentPlan from '../../semantic-artifacts/mission-briefing-v1/mission-v2-r0/component-plan.json';
import manifest from '../../semantic-artifacts/mission-briefing-v1/mission-v2-r0/manifest.json';
import type { MissionBriefingComponentPlanV1 } from '../../semantic-compiler/mission-briefing/missionBriefingComponentCompiler';

export const missionV2CompiledPlan = componentPlan as MissionBriefingComponentPlanV1;
export const missionV2ArtifactIdentity = {
  artifactId: manifest.artifactId,
  artifactVersion: manifest.artifactVersion,
  artifactSetSha256: manifest.artifactSetSha256,
} as const;

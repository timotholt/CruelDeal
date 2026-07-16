import { createHash } from 'node:crypto';
import { serializePaintArtifact } from '../paint/paintCompiler';
import {
  compileMissionBriefingComponentV1,
  MISSION_BRIEFING_COMPILER_VERSION,
  type MissionBriefingComponentPlanV1,
} from './missionBriefingComponentCompiler';
import { paintMaskAssets } from '../paint/paintMaskAssets';

export const MISSION_V2_ARTIFACT_ID = 'mission-v2-r0' as const;

export interface CompiledMissionArtifactFilesV1 {
  'manifest.json': string;
  'component-plan.json': string;
  'appearance.css': string;
  'reference.html': string;
  'allocation.json': string;
  'diagnostics.json': string;
}

export interface MissionArtifactCompileInputV1 {
  source: unknown;
  appearance: unknown;
  layoutCss: string;
  renderReference: (plan: MissionBriefingComponentPlanV1) => string;
}

export type MissionArtifactCompileResultV1 =
  | { ok: true; plan: MissionBriefingComponentPlanV1; files: CompiledMissionArtifactFilesV1 }
  | { ok: false; issues: Array<{ path: string; message: string }> };

export const artifactSha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

const utf8Bytes = (value: string) => Buffer.byteLength(value, 'utf8');

const referenceDocument = (runtimeMarkup: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Mission Briefing V2 R0 Reference</title>
  <link rel="stylesheet" href="./appearance.css">
</head>
<body>
  <div class="mission-briefing-product-shell">${runtimeMarkup}</div>
</body>
</html>
`;

export const compileMissionBriefingArtifactV1 = (
  input: MissionArtifactCompileInputV1,
): MissionArtifactCompileResultV1 => {
  const compiled = compileMissionBriefingComponentV1(input.source, input.appearance);
  if (!compiled.ok) return compiled;

  const memberFiles = {
    'component-plan.json': serializePaintArtifact(compiled.plan),
    'appearance.css': `${compiled.appearanceCss.trimEnd()}\n\n${input.layoutCss.trim()}\n`,
    'reference.html': referenceDocument(input.renderReference(compiled.plan)),
    'allocation.json': serializePaintArtifact(compiled.allocation),
    'diagnostics.json': serializePaintArtifact({ schemaVersion: 1, diagnostics: compiled.diagnostics }),
  } as const;
  const fileEntries = Object.entries(memberFiles)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, bytes]) => ({ path, bytes: utf8Bytes(bytes), sha256: artifactSha256(bytes) }));
  const artifactSetSha256 = artifactSha256(fileEntries.map((entry) => `${entry.path}:${entry.sha256}\n`).join(''));
  const manifest = {
    schemaVersion: 1,
    artifactId: MISSION_V2_ARTIFACT_ID,
    artifactVersion: 1,
    componentType: 'MissionBriefing',
    componentSchemaVersion: 1,
    compilerVersion: MISSION_BRIEFING_COMPILER_VERSION,
    targetProfile: compiled.plan.targetProfile,
    browserEvidence: 'Google Chrome 150.0.7871.124',
    inputs: {
      sourceSha256: artifactSha256(serializePaintArtifact(input.source)),
      appearanceSha256: artifactSha256(serializePaintArtifact(input.appearance)),
      layoutCssSha256: artifactSha256(`${input.layoutCss.trim()}\n`),
    },
    assets: [
      {
        id: paintMaskAssets['fingerprint-svgrepo-v1'].id,
        kind: 'vendored-svg-mask',
        owner: 'primaryAction::before',
        path: paintMaskAssets['fingerprint-svgrepo-v1'].publicPath,
        sha256: paintMaskAssets['fingerprint-svgrepo-v1'].sha256,
      },
      { id: 'hex-grid-v1', kind: 'embedded-svg-texture', owner: 'panel.background' },
    ],
    fonts: [
      { family: 'DIN Condensed', style: 'Bold', sha256: '36958182a424e1e8a1307b2636a615a6323ce1bbfadda136735ab4fb3bd26ceb' },
      { family: 'Arial Narrow', style: 'Regular', sha256: '9e1d881c4e43b51868f5e235ea5a12c838e23cc8df6277df1a3c94e158999826' },
    ],
    files: fileEntries,
    artifactSetSha256,
  };
  return {
    ok: true,
    plan: compiled.plan,
    files: {
      'manifest.json': serializePaintArtifact(manifest),
      ...memberFiles,
    },
  };
};

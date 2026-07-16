import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import source from '../components/ui/semantic-authoring/mission-briefing/__fixtures__/mission-briefing-v1.inline.json';
import appearance from '../components/ui/semantic-compiler/paint/__fixtures__/mission-v2-r0.appearance.json';
import { compileMissionBriefingArtifactV1 } from '../components/ui/semantic-compiler/mission-briefing/missionBriefingArtifactCompiler';
import type { MissionBriefingComponentPlanV1 } from '../components/ui/semantic-compiler/mission-briefing/missionBriefingComponentCompiler';

const root = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(
  root,
  'components/ui/semantic-artifacts/mission-briefing-v1/mission-v2-r0',
);
const layoutCss = readFileSync(resolve(root, 'src/styles/mission-briefing-runtime.css'), 'utf8');
const vite = await createServer({
  configFile: false,
  root,
  plugins: [solidPlugin({ ssr: true })],
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
});
const referenceModule = await vite.ssrLoadModule('/scripts/render-mission-v2-reference.tsx') as {
  renderMissionBriefingReference: (plan: MissionBriefingComponentPlanV1) => string;
};
const compiled = compileMissionBriefingArtifactV1({
  source,
  appearance,
  layoutCss,
  renderReference: referenceModule.renderMissionBriefingReference,
});
await vite.close();

if (!compiled.ok) {
  throw new Error(compiled.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
}

const check = process.argv.includes('--check');
mkdirSync(outputDirectory, { recursive: true });
const mismatches: string[] = [];
for (const [name, expected] of Object.entries(compiled.files).sort(([left], [right]) => left.localeCompare(right))) {
  const path = resolve(outputDirectory, name);
  if (check) {
    let actual = '';
    try {
      actual = readFileSync(path, 'utf8');
    } catch {
      mismatches.push(`${name}: missing`);
      continue;
    }
    if (actual !== expected) mismatches.push(`${name}: stale`);
  } else {
    writeFileSync(path, expected, 'utf8');
  }
}

if (mismatches.length) {
  throw new Error(`Mission V2 artifact check failed:\n${mismatches.join('\n')}`);
}

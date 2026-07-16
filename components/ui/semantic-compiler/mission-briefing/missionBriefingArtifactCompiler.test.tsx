import { render } from 'solid-js/web';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import source from '../../semantic-authoring/mission-briefing/__fixtures__/mission-briefing-v1.inline.json';
import appearance from '../paint/__fixtures__/mission-v2-r0.appearance.json';
import { MissionBriefingRuntime } from '../../semantic-runtime/mission-briefing/MissionBriefingRuntime';
import {
  artifactSha256,
  compileMissionBriefingArtifactV1,
} from './missionBriefingArtifactCompiler';
import type { MissionBriefingComponentPlanV1 } from './missionBriefingComponentCompiler';

const layoutCss = readFileSync('src/styles/mission-briefing-runtime.css', 'utf8');
const artifactDirectory = 'components/ui/semantic-artifacts/mission-briefing-v1/mission-v2-r0';

const renderReference = (plan: MissionBriefingComponentPlanV1) => {
  const container = document.createElement('div');
  const dispose = render(() => <MissionBriefingRuntime plan={plan} onAction={() => undefined} />, container);
  const markup = container.innerHTML;
  dispose();
  return markup;
};

describe('Mission Briefing compiled artifact', () => {
  it('produces byte-identical six-file output in two clean directories', () => {
    const first = compileMissionBriefingArtifactV1({ source, appearance, layoutCss, renderReference });
    const second = compileMissionBriefingArtifactV1({
      source: structuredClone(source),
      appearance: structuredClone(appearance),
      layoutCss: `${layoutCss}`,
      renderReference,
    });
    if (!first.ok || !second.ok) throw new Error('Canonical artifact fixture must compile.');
    expect(Object.keys(first.files).sort()).toEqual([
      'allocation.json',
      'appearance.css',
      'component-plan.json',
      'diagnostics.json',
      'manifest.json',
      'reference.html',
    ]);
    expect(second.files).toEqual(first.files);

    const directories = [mkdtempSync(resolve(tmpdir(), 'mission-v2-a-')), mkdtempSync(resolve(tmpdir(), 'mission-v2-b-'))];
    for (const directory of directories) {
      for (const [name, bytes] of Object.entries(first.files)) writeFileSync(resolve(directory, name), bytes, 'utf8');
    }
    for (const name of Object.keys(first.files) as Array<keyof typeof first.files>) {
      expect(readFileSync(resolve(directories[0], name))).toEqual(readFileSync(resolve(directories[1], name)));
    }
  });

  it('has valid hashes for every checked-in non-manifest member', () => {
    const manifest = JSON.parse(readFileSync(resolve(artifactDirectory, 'manifest.json'), 'utf8')) as {
      files: Array<{ path: string; bytes: number; sha256: string }>;
      artifactSetSha256: string;
    };
    const hashLines = manifest.files.map((entry) => {
      const bytes = readFileSync(resolve(artifactDirectory, entry.path), 'utf8');
      expect(Buffer.byteLength(bytes, 'utf8')).toBe(entry.bytes);
      expect(artifactSha256(bytes)).toBe(entry.sha256);
      return `${entry.path}:${entry.sha256}\n`;
    }).join('');
    expect(artifactSha256(hashLines)).toBe(manifest.artifactSetSha256);
    expect(readFileSync(resolve(artifactDirectory, 'manifest.json'), 'utf8')).not.toMatch(/timestamp|session|\/Users\//i);
  });
});

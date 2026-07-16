import { describe, expect, it } from 'vitest';
import appearanceFixture from './__fixtures__/mission-v2-r0.appearance.json';
import invalidFixture from './__fixtures__/paint-source-v1.invalid.json';
import { validateMissionAppearanceDocumentV1 } from './paintSource';

const parentAtPath = (root: unknown, path: string) => {
  const parts = path.split('.');
  const key = parts.pop()!;
  let parent = root as Record<string, unknown>;
  for (const part of parts) parent = parent[part] as Record<string, unknown>;
  return { parent, key };
};

describe('Mission Paint source V1', () => {
  it('accepts the bounded R0 appearance graphs', () => {
    expect(validateMissionAppearanceDocumentV1(appearanceFixture).ok).toBe(true);
  });

  it.each(invalidFixture.cases)('rejects $name', (fixtureCase) => {
    const candidate = structuredClone(appearanceFixture) as unknown;
    const { parent, key } = parentAtPath(candidate, fixtureCase.setPath);
    parent[key] = fixtureCase.value;
    expect(validateMissionAppearanceDocumentV1(candidate).ok).toBe(false);
  });
});

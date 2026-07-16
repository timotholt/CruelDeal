import { describe, expect, it } from 'vitest';
import inlineFixture from './__fixtures__/mission-briefing-v1.inline.json';
import boundFixture from './__fixtures__/mission-briefing-v1.bound.json';
import invalidFixture from './__fixtures__/mission-briefing-v1.invalid.json';
import {
  serializeMissionBriefingSourceV1,
  validateMissionBriefingSourceV1,
} from './missionBriefingSource';

const clone = <T,>(value: T): T => structuredClone(value);

const parentAtPath = (root: Record<string, unknown>, path: string) => {
  const parts = path.split('.');
  const key = parts.pop() || '';
  let parent = root;
  for (const part of parts) parent = parent[part] as Record<string, unknown>;
  return { parent, key };
};

describe('MissionBriefingSourceV1', () => {
  it('accepts inline and bound semantic documents', () => {
    expect(validateMissionBriefingSourceV1(inlineFixture).ok).toBe(true);
    expect(validateMissionBriefingSourceV1(boundFixture).ok).toBe(true);
  });

  it.each(invalidFixture.cases)('rejects $name', (fixtureCase) => {
    const candidate = clone(inlineFixture) as unknown as Record<string, unknown>;
    if ('removePath' in fixtureCase && fixtureCase.removePath) {
      const { parent, key } = parentAtPath(candidate, fixtureCase.removePath);
      delete parent[key];
    }
    if ('setPath' in fixtureCase && fixtureCase.setPath) {
      const { parent, key } = parentAtPath(candidate, fixtureCase.setPath);
      parent[key] = fixtureCase.value;
    }
    expect(validateMissionBriefingSourceV1(candidate).ok).toBe(false);
  });

  it('serializes identical semantic input to identical canonical bytes', () => {
    const first = serializeMissionBriefingSourceV1(inlineFixture);
    const reordered = {
      appearance: inlineFixture.appearance,
      slots: inlineFixture.slots,
      layoutVariant: inlineFixture.layoutVariant,
      id: inlineFixture.id,
      type: inlineFixture.type,
      schemaVersion: inlineFixture.schemaVersion,
    };
    expect(serializeMissionBriefingSourceV1(reordered)).toBe(first);
    expect(first.endsWith('\n')).toBe(true);
  });

  it('does not serialize legacy graph or CSS implementation fields', () => {
    const serialized = serializeMissionBriefingSourceV1(inlineFixture);
    for (const marker of ['card_type_04', 'children', 'presentation', 'className', 'fingerprint-hold']) {
      expect(serialized).not.toContain(marker);
    }
  });
});

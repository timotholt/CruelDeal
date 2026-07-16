import { describe, expect, it } from 'vitest';
import inlineFixture from './__fixtures__/mission-briefing-v1.inline.json';
import appearanceFixture from '../../semantic-compiler/paint/__fixtures__/mission-v2-r0.appearance.json';
import {
  missionAppearanceStorageKey,
  missionBriefingStorageKey,
  readStoredMissionAppearance,
  readStoredMissionBriefingSource,
  writeStoredMissionAppearance,
  writeStoredMissionBriefingSource,
  type MissionBriefingStorageLike,
} from './missionBriefingPersistence';
import { validateMissionBriefingSourceV1 } from './missionBriefingSource';

class MemoryStorage implements MissionBriefingStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('Mission Briefing canonical persistence', () => {
  it('uses a separate versioned key and strict canonical serialization', () => {
    const parsed = validateMissionBriefingSourceV1(inlineFixture);
    if (!parsed.ok) throw new Error('Fixture must be valid.');
    const storage = new MemoryStorage();
    writeStoredMissionBriefingSource(storage, parsed.source);
    expect(storage.values.has(missionBriefingStorageKey)).toBe(true);
    expect(readStoredMissionBriefingSource(storage)).toEqual(parsed.source);
    expect(storage.values.get(missionBriefingStorageKey)).not.toContain('card_type_04');
  });

  it('persists the compiler-owned theme and rough-edge appearance separately', () => {
    const storage = new MemoryStorage();
    writeStoredMissionAppearance(storage, appearanceFixture as never);
    expect(storage.values.has(missionAppearanceStorageKey)).toBe(true);
    expect(readStoredMissionAppearance(storage)).toEqual(appearanceFixture);
    expect(storage.values.get(missionAppearanceStorageKey)).toContain('"typography"');
    expect(storage.values.get(missionAppearanceStorageKey)).toContain('"edgeWear"');
  });

  it('does not accept malformed stored documents', () => {
    const storage = new MemoryStorage();
    storage.setItem(missionBriefingStorageKey, '{"type":"MissionBriefing"}');
    expect(readStoredMissionBriefingSource(storage)).toBeNull();
  });

  it('upgrades the known legacy Data Extraction title without touching arbitrary copy', () => {
    const parsed = validateMissionBriefingSourceV1(inlineFixture);
    if (!parsed.ok) throw new Error('Fixture must be valid.');
    const legacy = structuredClone(parsed.source);
    legacy.slots.title = { inline: { format: 'plain', value: 'Data Extraction' } };
    const storage = new MemoryStorage();
    storage.setItem(missionBriefingStorageKey, JSON.stringify(legacy));
    expect(readStoredMissionBriefingSource(storage)?.slots.title).toEqual({
      inline: { format: 'cruel-markup-v1', value: '[bright]Data[/bright]\n[muted]Extraction[/muted]' },
    });
  });
});

import { describe, expect, it } from 'vitest';
import inlineFixture from './__fixtures__/mission-briefing-v1.inline.json';
import {
  dispatchMissionBriefingCommand,
  missionBriefingRequiredSlots,
} from './missionBriefingCommands';
import { validateMissionBriefingSourceV1 } from './missionBriefingSource';

const source = () => {
  const result = validateMissionBriefingSourceV1(structuredClone(inlineFixture));
  if (!result.ok) throw new Error('Test fixture must be valid.');
  return result.source;
};

describe('Mission Briefing semantic commands', () => {
  it.each(missionBriefingRequiredSlots)('denies removal of required slot %s without mutation', (slot) => {
    const current = source();
    const result = dispatchMissionBriefingCommand(current, { type: 'slot/remove', slot });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('MISSION_REQUIRED_SLOT');
    expect(result.source).toBe(current);
    expect(result.reason).toContain(`MissionBriefing.${slot}`);
  });

  it('removes an optional slot through the command boundary', () => {
    const current = source();
    const result = dispatchMissionBriefingCommand(current, {
      type: 'slot/remove',
      slot: 'progress',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source.slots.progress).toBeUndefined();
    expect(current.slots.progress).toEqual({ completed: 1, total: 4 });
  });

  it('rejects an invalid replacement and preserves the current source', () => {
    const current = source();
    const result = dispatchMissionBriefingCommand(current, {
      type: 'slot/replace',
      slot: 'terms',
      value: { inline: { format: 'plain', value: '200 / 800' } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('MISSION_INVALID_SLOT_VALUE');
    expect(result.source).toBe(current);
  });
});

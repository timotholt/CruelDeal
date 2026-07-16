import {
  validateMissionBriefingSourceV1,
  type MissionBriefingSlotsV1,
  type MissionBriefingSourceV1,
} from './missionBriefingSource';

export const missionBriefingRequiredSlots = ['title', 'body', 'terms', 'primaryAction'] as const;
export const missionBriefingOptionalSlots = ['availabilityStatus', 'deadline', 'sectorMark', 'progress'] as const;

export type MissionBriefingRequiredSlot = typeof missionBriefingRequiredSlots[number];
export type MissionBriefingOptionalSlot = typeof missionBriefingOptionalSlots[number];
export type MissionBriefingSlot = keyof MissionBriefingSlotsV1;

export type MissionBriefingCommand =
  | { type: 'slot/remove'; slot: string }
  | { type: 'slot/replace'; slot: string; value: unknown };

export type MissionBriefingCommandDenialCode =
  | 'MISSION_DOCUMENT_INVALID'
  | 'MISSION_REQUIRED_SLOT'
  | 'MISSION_UNKNOWN_SLOT'
  | 'MISSION_INVALID_SLOT_VALUE';

export type MissionBriefingCommandResult =
  | {
    ok: true;
    source: MissionBriefingSourceV1;
  }
  | {
    ok: false;
    source: MissionBriefingSourceV1;
    code: MissionBriefingCommandDenialCode;
    reason: string;
    issues?: readonly { path: string; message: string }[];
  };

const requiredSlotSet = new Set<string>(missionBriefingRequiredSlots);
const optionalSlotSet = new Set<string>(missionBriefingOptionalSlots);
const knownSlotSet = new Set<string>([...missionBriefingRequiredSlots, ...missionBriefingOptionalSlots]);

export const isMissionBriefingRequiredSlot = (slot: string): slot is MissionBriefingRequiredSlot => (
  requiredSlotSet.has(slot)
);

export const isMissionBriefingOptionalSlot = (slot: string): slot is MissionBriefingOptionalSlot => (
  optionalSlotSet.has(slot)
);

export const dispatchMissionBriefingCommand = (
  current: MissionBriefingSourceV1,
  command: MissionBriefingCommand,
): MissionBriefingCommandResult => {
  const currentValidation = validateMissionBriefingSourceV1(current);
  if (!currentValidation.ok) {
    return {
      ok: false,
      source: current,
      code: 'MISSION_DOCUMENT_INVALID',
      reason: 'The Mission Briefing document is invalid and cannot accept editor commands.',
      issues: currentValidation.issues,
    };
  }

  if (!knownSlotSet.has(command.slot)) {
    return {
      ok: false,
      source: current,
      code: 'MISSION_UNKNOWN_SLOT',
      reason: `Unknown Mission Briefing slot: ${command.slot}`,
    };
  }

  if (command.type === 'slot/remove') {
    if (isMissionBriefingRequiredSlot(command.slot)) {
      return {
        ok: false,
        source: current,
        code: 'MISSION_REQUIRED_SLOT',
        reason: `MissionBriefing.${command.slot} is required and cannot be removed.`,
      };
    }
    const slots = { ...current.slots };
    delete slots[command.slot as MissionBriefingOptionalSlot];
    return {
      ok: true,
      source: { ...current, slots },
    };
  }

  const candidate = {
    ...current,
    slots: {
      ...current.slots,
      [command.slot]: command.value,
    },
  };
  const validation = validateMissionBriefingSourceV1(candidate);
  if (!validation.ok) {
    return {
      ok: false,
      source: current,
      code: 'MISSION_INVALID_SLOT_VALUE',
      reason: `Replacement for MissionBriefing.${command.slot} violates the semantic contract.`,
      issues: validation.issues,
    };
  }
  return { ok: true, source: validation.source };
};

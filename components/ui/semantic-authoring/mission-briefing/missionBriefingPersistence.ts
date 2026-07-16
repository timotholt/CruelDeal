import {
  parseMissionBriefingSourceV1Json,
  serializeMissionBriefingSourceV1,
  type MissionBriefingSourceV1,
} from './missionBriefingSource';
import { serializePaintArtifact } from '../../semantic-compiler/paint/paintCompiler';
import {
  validateMissionAppearanceDocumentV1,
  type MissionAppearanceDocumentV1,
} from '../../semantic-compiler/paint/paintSource';
import {
  missionTypographyRoleIds,
  type MissionTextStyleV1,
} from '../../semantic-compiler/typography/missionTypography';

export const missionBriefingStorageKey = 'cruel-deal.semantic-authoring.mission-briefing.v1';
export const missionAppearanceStorageKey = 'cruel-deal.semantic-authoring.mission-appearance.v1';

export interface MissionBriefingStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const migrateKnownMissionTitleMarkup = (source: MissionBriefingSourceV1): MissionBriefingSourceV1 => {
  const title = source.slots.title;
  if (
    'inline' in title
    && title.inline.format === 'plain'
    && title.inline.value.trim().replace(/\s+/g, ' ').toLowerCase() === 'data extraction'
  ) {
    return {
      ...source,
      slots: {
        ...source.slots,
        title: {
          inline: {
            format: 'cruel-markup-v1',
            value: '[bright]Data[/bright]\n[muted]Extraction[/muted]',
          },
        },
      },
    };
  }
  return source;
};

export const readStoredMissionBriefingSource = (
  storage: MissionBriefingStorageLike,
): MissionBriefingSourceV1 | null => {
  const raw = storage.getItem(missionBriefingStorageKey);
  if (!raw) return null;
  const result = parseMissionBriefingSourceV1Json(raw);
  return result.ok ? migrateKnownMissionTitleMarkup(result.source) : null;
};

export const writeStoredMissionBriefingSource = (
  storage: MissionBriefingStorageLike,
  source: MissionBriefingSourceV1,
) => {
  storage.setItem(missionBriefingStorageKey, serializeMissionBriefingSourceV1(source));
};

export const readStoredMissionAppearance = (
  storage: MissionBriefingStorageLike,
): MissionAppearanceDocumentV1 | null => {
  const raw = storage.getItem(missionAppearanceStorageKey);
  if (!raw) return null;
  try {
    const result = validateMissionAppearanceDocumentV1(JSON.parse(raw) as unknown);
    if (!result.ok) return null;
    const appearance = structuredClone(result.document);
    for (const role of missionTypographyRoleIds) {
      const theme = appearance.typography[role];
      for (const variant of ['bright', 'muted', 'accent'] as const) {
        const authored = theme[variant];
        if (!authored) continue;
        theme[variant] = Object.fromEntries(
          Object.entries(authored).filter(([key, value]) => value !== theme.base[key as keyof MissionTextStyleV1]),
        ) as Partial<MissionTextStyleV1>;
      }
    }
    return appearance;
  } catch {
    return null;
  }
};

export const writeStoredMissionAppearance = (
  storage: MissionBriefingStorageLike,
  appearance: MissionAppearanceDocumentV1,
) => {
  const result = validateMissionAppearanceDocumentV1(appearance);
  if (!result.ok) throw new TypeError(`Invalid Mission appearance: ${result.issues[0]?.message ?? 'unknown issue'}`);
  storage.setItem(missionAppearanceStorageKey, serializePaintArtifact(result.document));
};

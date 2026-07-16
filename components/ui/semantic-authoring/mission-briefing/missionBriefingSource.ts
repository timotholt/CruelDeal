import * as v from 'valibot';

export const MISSION_BRIEFING_SCHEMA_VERSION = 1 as const;
export const MISSION_BRIEFING_TYPE = 'MissionBriefing' as const;
export const FINGERPRINT_HOLD_ACTION_TYPE = 'FingerprintHoldAction' as const;

export const missionCurrencyIds = ['credits', 'gold', 'data', 'tokens'] as const;
export type MissionCurrencyId = typeof missionCurrencyIds[number];

export type ContentSourceV1 =
  | { inline: { format: 'plain' | 'cruel-markup-v1'; value: string } }
  | { binding: { key: string } };

export type NumericSourceV1 =
  | { literal: number }
  | { binding: { key: string } };

export interface CurrencyAmountSourceV1 {
  amount: NumericSourceV1;
  currencyCode: MissionCurrencyId;
}

export interface MissionTermsSourceV1 {
  deposit?: CurrencyAmountSourceV1;
  successReward: CurrencyAmountSourceV1;
}

export interface ProgressSourceV1 {
  completed: number;
  total: number;
}

export type AppearanceReferenceMapV1 = Record<string, string>;

export interface FingerprintHoldActionSourceV1 {
  schemaVersion: 1;
  type: 'FingerprintHoldAction';
  id: string;
  label: ContentSourceV1;
  actionId: string;
  holdDurationMs: number;
  disabled: boolean;
  completionMessage?: ContentSourceV1;
  appearance: AppearanceReferenceMapV1;
}

export interface MissionBriefingSlotsV1 {
  title: ContentSourceV1;
  body: ContentSourceV1;
  terms: MissionTermsSourceV1;
  primaryAction: FingerprintHoldActionSourceV1;
  availabilityStatus?: ContentSourceV1;
  deadline?: ContentSourceV1;
  sectorMark?: ContentSourceV1;
  progress?: ProgressSourceV1;
}

export interface MissionBriefingSourceV1 {
  schemaVersion: 1;
  type: 'MissionBriefing';
  id: string;
  layoutVariant: 'contract-left';
  slots: MissionBriefingSlotsV1;
  appearance: AppearanceReferenceMapV1;
}

const STABLE_ID_RE = /^[a-z0-9][a-z0-9._:-]{0,95}$/i;
const BINDING_KEY_RE = /^[a-z][a-z0-9._:-]{0,127}$/i;
const APPEARANCE_BINDING_KEY_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)?$/i;

const stableIdSchema = v.pipe(v.string(), v.regex(STABLE_ID_RE));
const bindingKeySchema = v.pipe(v.string(), v.regex(BINDING_KEY_RE));
const appearanceBindingKeySchema = v.pipe(v.string(), v.regex(APPEARANCE_BINDING_KEY_RE));

export const contentSourceV1Schema: v.GenericSchema<ContentSourceV1> = v.union([
  v.strictObject({
    inline: v.strictObject({
      format: v.picklist(['plain', 'cruel-markup-v1']),
      value: v.string(),
    }),
  }),
  v.strictObject({
    binding: v.strictObject({ key: bindingKeySchema }),
  }),
]) as v.GenericSchema<ContentSourceV1>;

export const numericSourceV1Schema: v.GenericSchema<NumericSourceV1> = v.union([
  v.strictObject({
    literal: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  v.strictObject({
    binding: v.strictObject({ key: bindingKeySchema }),
  }),
]) as v.GenericSchema<NumericSourceV1>;

export const currencyAmountSourceV1Schema: v.GenericSchema<CurrencyAmountSourceV1> = v.strictObject({
  amount: numericSourceV1Schema,
  currencyCode: v.picklist(missionCurrencyIds),
}) as v.GenericSchema<CurrencyAmountSourceV1>;

export const missionTermsSourceV1Schema: v.GenericSchema<MissionTermsSourceV1> = v.strictObject({
  deposit: v.optional(currencyAmountSourceV1Schema),
  successReward: currencyAmountSourceV1Schema,
}) as v.GenericSchema<MissionTermsSourceV1>;

export const progressSourceV1Schema: v.GenericSchema<ProgressSourceV1> = v.strictObject({
  completed: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(12)),
  total: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(12)),
}) as v.GenericSchema<ProgressSourceV1>;

export const appearanceReferenceMapV1Schema: v.GenericSchema<AppearanceReferenceMapV1> = v.record(
  appearanceBindingKeySchema,
  stableIdSchema,
) as v.GenericSchema<AppearanceReferenceMapV1>;

export const fingerprintHoldActionSourceV1Schema: v.GenericSchema<FingerprintHoldActionSourceV1> = v.strictObject({
  schemaVersion: v.literal(MISSION_BRIEFING_SCHEMA_VERSION),
  type: v.literal(FINGERPRINT_HOLD_ACTION_TYPE),
  id: stableIdSchema,
  label: contentSourceV1Schema,
  actionId: stableIdSchema,
  holdDurationMs: v.pipe(v.number(), v.integer(), v.minValue(400), v.maxValue(5000)),
  disabled: v.boolean(),
  completionMessage: v.optional(contentSourceV1Schema),
  appearance: appearanceReferenceMapV1Schema,
}) as v.GenericSchema<FingerprintHoldActionSourceV1>;

export const missionBriefingSourceV1Schema: v.GenericSchema<MissionBriefingSourceV1> = v.strictObject({
  schemaVersion: v.literal(MISSION_BRIEFING_SCHEMA_VERSION),
  type: v.literal(MISSION_BRIEFING_TYPE),
  id: stableIdSchema,
  layoutVariant: v.literal('contract-left'),
  slots: v.strictObject({
    title: contentSourceV1Schema,
    body: contentSourceV1Schema,
    terms: missionTermsSourceV1Schema,
    primaryAction: fingerprintHoldActionSourceV1Schema,
    availabilityStatus: v.optional(contentSourceV1Schema),
    deadline: v.optional(contentSourceV1Schema),
    sectorMark: v.optional(contentSourceV1Schema),
    progress: v.optional(progressSourceV1Schema),
  }),
  appearance: appearanceReferenceMapV1Schema,
}) as v.GenericSchema<MissionBriefingSourceV1>;

export interface MissionBriefingValidationIssue {
  path: string;
  message: string;
}

export type MissionBriefingValidationResult =
  | { ok: true; source: MissionBriefingSourceV1 }
  | { ok: false; issues: MissionBriefingValidationIssue[] };

const issuePath = (issue: { path?: readonly unknown[] }): string => (
  (issue.path || [])
    .map((item) => String((item as { key?: unknown }).key ?? ''))
    .filter(Boolean)
    .join('.')
);

export const validateMissionBriefingSourceV1 = (input: unknown): MissionBriefingValidationResult => {
  const result = v.safeParse(missionBriefingSourceV1Schema, input);
  if (!result.success) {
    return {
      ok: false,
      issues: result.issues.map((issue) => ({
        path: issuePath(issue),
        message: issue.message,
      })),
    };
  }
  const progress = result.output.slots.progress;
  if (progress && progress.completed > progress.total) {
    return {
      ok: false,
      issues: [{
        path: 'slots.progress.completed',
        message: 'Progress completed cannot exceed progress total.',
      }],
    };
  }
  return { ok: true, source: result.output };
};

export const parseMissionBriefingSourceV1Json = (text: string): MissionBriefingValidationResult => {
  try {
    return validateMissionBriefingSourceV1(JSON.parse(text) as unknown);
  } catch (error) {
    return {
      ok: false,
      issues: [{
        path: '',
        message: error instanceof Error ? error.message : 'Mission Briefing JSON could not be parsed.',
      }],
    };
  }
};

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

const canonicalize = (value: unknown): CanonicalJson => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  throw new TypeError(`Unsupported canonical Mission value: ${typeof value}`);
};

export const serializeMissionBriefingSourceV1 = (input: unknown): string => {
  const result = validateMissionBriefingSourceV1(input);
  if (!result.ok) {
    const details = result.issues.map((issue) => `${issue.path || '<root>'}: ${issue.message}`).join('; ');
    throw new TypeError(`Invalid MissionBriefingSourceV1: ${details}`);
  }
  return `${JSON.stringify(canonicalize(result.source), null, 2)}\n`;
};

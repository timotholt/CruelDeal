import * as v from 'valibot';
import { fault } from '../../../utils/logger';
import type { SurfaceOptions } from './surfaceSchema';
import { summarizeValibotIssues, surfaceOptionsLenientStrictSchema } from './surfaceValidate';

export const MATERIAL_SCHEMA_VERSION = '1';
export const CLIENT_SKIN_VERSION = '1.0.0';

export interface SkinManifestCompatibility {
  minClientVersion: string;
  materialSchemaVersion: string;
}

export interface SkinAsset {
  id: string;
  url: string;
  kind?: 'image' | 'texture' | 'font';
}

export interface SkinManifest {
  id: string;
  version: string;
  displayName?: string;
  appliesTo?: string[];
  compatibility: SkinManifestCompatibility;
  assets?: SkinAsset[];
  recipePatches: Record<string, Partial<SurfaceOptions>>;
}

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const ID_RE = /^[a-z0-9][a-z0-9._:-]{0,80}$/i;
const SAFE_ASSET_URL_RE = /^(\/|\.\/|\.\.\/)[\w./-]+$/;

export const skinManifestSchema: v.GenericSchema<SkinManifest> = v.strictObject({
  id: v.pipe(v.string(), v.regex(ID_RE)),
  version: v.pipe(v.string(), v.regex(VERSION_RE)),
  displayName: v.optional(v.string()),
  appliesTo: v.optional(v.array(v.string())),
  compatibility: v.strictObject({
    minClientVersion: v.pipe(v.string(), v.regex(VERSION_RE)),
    materialSchemaVersion: v.string(),
  }),
  assets: v.optional(v.array(v.strictObject({
    id: v.pipe(v.string(), v.regex(ID_RE)),
    url: v.pipe(v.string(), v.regex(SAFE_ASSET_URL_RE)),
    kind: v.optional(v.picklist(['image', 'texture', 'font'])),
  }))),
  recipePatches: v.record(v.string(), surfaceOptionsLenientStrictSchema),
}) as v.GenericSchema<SkinManifest>;

export const validateSkinManifest = (input: unknown, label = 'skin-manifest'): SkinManifest | null => {
  const result = v.safeParse(skinManifestSchema, input);
  if (result.success) return result.output;
  fault('skin.manifest.invalid', { label, issues: summarizeValibotIssues(result.issues) });
  return null;
};

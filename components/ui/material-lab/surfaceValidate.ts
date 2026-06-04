import * as v from 'valibot';
import { fault } from '../../../utils/logger';
import { edgeTextureOptions, textureOptions } from './TextureOptions';
import type { SurfaceOptions } from './surfaceSchema';

// Fail-closed validation for the surface vocabulary, the entry point for
// untrusted/authored data (server skin payloads, imported recipes).
//
// Two schemas built from one field table:
//   strict  - rejects unknown keys, wrong types, bad enums, out-of-range
//             numbers. Used for detection.
//   lenient - clamps numbers, drops invalid enums/strings to undefined, strips
//             unknown keys. Never throws. Used to coerce a safe value when the
//             active fault policy is 'continue'.
//
// validateSurfaceOptions() parses strict; on any issue it routes through
// fault() (throws in dev/CI, logs in prod) and then returns the lenient
// best-effort so production keeps rendering.

const TONES = ['none', 'inherit', 'black', 'white', 'muted', 'gray', 'brass', 'gold', 'cyan', 'red', 'green'] as const;
const MATERIAL_KINDS = ['none', 'black', 'white', 'gray', 'custom'] as const;
const BORDER_COLOR_KINDS = ['inherit', 'black', 'white', 'gray', 'custom'] as const;
const EDGE_NAMES = ['top', 'right', 'bottom', 'left'] as const;
const CORNER_NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
const GRADIENTS = ['none', 'top-light', 'bottom-dark', 'both'] as const;
const SHAPES = ['rect', 'bevel'] as const;
const EDGE_WEAR_LAYERS = ['below-highlights', 'above-highlights'] as const;
const CONTENT_LAYERS = ['over-glass', 'under-glass'] as const;
const CONTENT_ALIGNS = ['left', 'center', 'right'] as const;
const EMISSIONS = ['none', 'line', 'center-blip', 'rail-and-blip'] as const;
const EMISSION_EDGES = ['bottom'] as const;
const FONT_STYLES = ['normal', 'italic'] as const;
const TEXT_TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'] as const;
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const VISUAL_STATES = ['rest', 'active', 'pressed'] as const;
const RENDER_MODES = ['editor', 'runtime', 'export'] as const;
const TEXTURE_IDS = Array.from(new Set<string>([...textureOptions.map((o) => o.id), 'none']));
const EDGE_TEXTURE_IDS = Array.from(new Set<string>([...edgeTextureOptions.map((o) => o.id), 'none']));

// Font-family allowlist charset: letters, digits, space, comma, quotes, hyphen.
// Blocks url(), expression(), semicolons, braces — no CSS injection via wire.
const FONT_FAMILY_RE = /^[\w '",-]+$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

type Pair = { strict: v.GenericSchema; lenient: v.GenericSchema };

const clampT = (lo: number, hi: number) =>
  v.pipe(v.number(), v.transform((n: number) => Math.max(lo, Math.min(hi, n))));

const strictField = (inner: v.GenericSchema): v.GenericSchema => v.optional(inner);
const lenientField = (inner: v.GenericSchema): v.GenericSchema => v.fallback(v.optional(inner), undefined);

const ranged = (lo: number, hi: number): Pair => ({
  strict: strictField(v.pipe(v.number(), v.minValue(lo), v.maxValue(hi))),
  lenient: lenientField(clampT(lo, hi)),
});
const flag = (): Pair => ({ strict: strictField(v.boolean()), lenient: lenientField(v.boolean()) });
const pick = (vals: readonly (string | number)[]): Pair => ({
  strict: strictField(v.picklist(vals)),
  lenient: lenientField(v.picklist(vals)),
});
const regexStr = (re: RegExp): Pair => ({
  strict: strictField(v.pipe(v.string(), v.regex(re))),
  lenient: lenientField(v.pipe(v.string(), v.regex(re))),
});
const text = (): Pair => ({ strict: strictField(v.string()), lenient: lenientField(v.string()) });
const passthrough = (): Pair => ({ strict: v.optional(v.unknown()), lenient: v.optional(v.unknown()) });

const cornerSpec = (): Pair => {
  const inner = v.union([v.picklist(['none', 'all', 'top', 'right', 'bottom', 'left']), v.array(v.picklist(CORNER_NAMES))]);
  return { strict: strictField(inner), lenient: lenientField(inner) };
};
const edgeHighlightSpec = (): Pair => {
  const inner = v.union([v.picklist(['none', ...EDGE_NAMES]), v.array(v.picklist(EDGE_NAMES))]);
  return { strict: strictField(inner), lenient: lenientField(inner) };
};
const borderSpec = (): Pair => {
  const inner = v.union([
    v.picklist(['none', 'all', 'top', 'right', 'bottom', 'left', 'three-sided']),
    v.array(v.picklist(EDGE_NAMES)),
  ]);
  return { strict: strictField(inner), lenient: lenientField(inner) };
};
const cornerArray = (): Pair => {
  const inner = v.array(v.picklist(CORNER_NAMES));
  return { strict: strictField(inner), lenient: lenientField(inner) };
};

const fields: Record<keyof SurfaceOptions, Pair> = {
  renderMode: pick(RENDER_MODES),
  material: pick(MATERIAL_KINDS),
  materialColor: regexStr(HEX_RE),
  glass: flag(),
  texture: pick(TEXTURE_IDS),
  shape: pick(SHAPES),
  bevelCorners: cornerArray(),
  bevelSize: ranged(0, 200),
  corners: cornerSpec(),
  edgeHighlight: edgeHighlightSpec(),
  border: borderSpec(),
  glow: pick(TONES),
  tint: pick(TONES),
  gradient: pick(GRADIENTS),
  sheen: flag(),
  selected: flag(),
  interactive: flag(),
  hoverPreview: flag(),
  textureStrength: ranged(0, 100),
  textureScale: ranged(1, 4096),
  glowStrength: ranged(0, 100),
  tintStrength: ranged(0, 100),
  glassOpacity: ranged(0, 100),
  glassReflectionOpacity: ranged(0, 100),
  glassBlurEnabled: flag(),
  glassBlur: ranged(0, 240),
  glassShine: flag(),
  glassHighlightWidth: ranged(0, 100),
  glassHighlightHeight: ranged(0, 100),
  glassHighlightY: ranged(0, 100),
  borderEnabled: flag(),
  borderColor: pick(BORDER_COLOR_KINDS),
  borderCustomColor: regexStr(HEX_RE),
  borderLit: flag(),
  borderOpacity: ranged(0, 100),
  lightStrength: ranged(0, 100),
  darkStrength: ranged(0, 100),
  edgeWearTexture: pick(EDGE_TEXTURE_IDS),
  edgeWearOpacity: ranged(0, 100),
  edgeWearWidth: ranged(0, 200),
  edgeWearScale: ranged(1, 4096),
  edgeWearLayer: pick(EDGE_WEAR_LAYERS),
  dropShadow: flag(),
  shadowOpacity: ranged(0, 100),
  shadowBlur: ranged(0, 400),
  shadowX: ranged(-400, 400),
  shadowY: ranged(-400, 400),
  shadowSpread: ranged(-400, 400),
  cornerSize: ranged(0, 200),
  radius: ranged(0, 400),
  textContent: text(),
  contentLayer: pick(CONTENT_LAYERS),
  textFontFamily: regexStr(FONT_FAMILY_RE),
  textSizeRem: ranged(0, 20),
  contentOpacity: ranged(0, 100),
  contentTone: pick(TONES),
  iconTone: pick(TONES),
  contentGlowStrength: ranged(0, 100),
  iconGlowStrength: ranged(0, 100),
  fontWeight: pick(FONT_WEIGHTS),
  fontStyle: pick(FONT_STYLES),
  textTransform: pick(TEXT_TRANSFORMS),
  letterSpacing: ranged(-5, 5),
  textEmboss: flag(),
  textAlign: pick(CONTENT_ALIGNS),
  textX: ranged(-1000, 1000),
  textY: ranged(-1000, 1000),
  emission: pick(EMISSIONS),
  emissionEdge: pick(EMISSION_EDGES),
  emissionTone: pick(TONES),
  emissionStrength: ranged(0, 100),
  emissionLength: ranged(0, 100),
  emissionThickness: ranged(0, 100),
  emissionBlipSize: ranged(0, 200),
  stateScale: ranged(0, 3),
  stateTranslateY: ranged(-200, 200),
  stateful: flag(),
  stateVars: passthrough(),
  visualState: pick(VISUAL_STATES),
};

const entries = (key: 'strict' | 'lenient') =>
  Object.fromEntries(Object.entries(fields).map(([name, pair]) => [name, pair[key]]));

export const surfaceOptionsStrictSchema = v.strictObject(entries('strict'));
export const surfaceOptionsLenientSchema = v.object(entries('lenient'));

const summarizeIssues = (issues: readonly v.BaseIssue<unknown>[]) =>
  issues.map((issue) => ({
    path: (issue.path ?? []).map((item) => (item as { key?: unknown }).key).filter((k) => k !== undefined).join('.') || '(root)',
    message: issue.message,
    received: issue.received,
  }));

const dropUndefined = (input: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

/**
 * Validate authored/wire surface data. Strict-parses for detection; on any
 * issue routes through fault() (throws in dev, logs in prod) and returns the
 * lenient clamped/coerced value so production keeps running. Always returns a
 * clean SurfaceOptions with undefined fields removed.
 */
export const validateSurfaceOptions = (input: unknown, label = 'surface'): SurfaceOptions => {
  const source = input && typeof input === 'object' ? input : {};
  const strict = v.safeParse(surfaceOptionsStrictSchema, source);
  if (strict.success) {
    return dropUndefined(strict.output as Record<string, unknown>) as SurfaceOptions;
  }
  fault('surface.validate.invalid', { label, issues: summarizeIssues(strict.issues) });
  const lenient = v.parse(surfaceOptionsLenientSchema, source);
  return dropUndefined(lenient as Record<string, unknown>) as SurfaceOptions;
};

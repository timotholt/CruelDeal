import * as v from 'valibot';
import { fault } from '../../../utils/logger';
import type { SurfaceOptions } from './surfaceSchema';
import { summarizeValibotIssues, surfaceOptionsLenientSchema, surfaceStatesSchema } from './surfaceValidate';

// The trusted server/wire UI contract (server-driven UI plan, Phase 1).
//
// A UiNodePayload describes *intent*, never markup: a node type, an optional
// surface skin (validated as the surface vocabulary), bounded layout (enums +
// numbers + dimension tokens — never arbitrary CSS), a content binding/text,
// an action id (the client owns the handler), and children.
//
// This type is clean by construction: no functions, no arbitrary style blobs,
// no HTML. It is the shape internal node types should converge toward.

export type UiNodeType = 'button' | 'panel' | 'text' | 'image' | 'slot';
export type UiStateModel = 'static' | 'momentary' | 'selectable' | 'disclosure';
export type UiContentMode = 'plain' | 'rich' | 'auto';

export interface UiLayoutPayload {
  display?: 'block' | 'flex' | 'grid' | 'absolute';
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  hMode?: 'fixed' | 'hug' | 'fill';
  gap?: number;
  padding?: number;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  position?: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
    inset?: string;
  };
}

export interface UiActionPayload {
  id: string;
  params?: Record<string, string | number | boolean>;
  paramsBinding?: string;
  target?: {
    kind: string;
    id: string;
  };
  targetBinding?: string;
}

export type UiSurfaceState = 'hover' | 'pressed' | 'active';
export type UiSurfaceStatesPayload = Partial<Record<UiSurfaceState, Partial<SurfaceOptions>>>;

export interface UiNodePayload {
  id: string;
  type: UiNodeType;
  variant?: string;
  materialId?: string;
  skinId?: string;
  surface?: SurfaceOptions;
  surfaceStates?: UiSurfaceStatesPayload;
  layout?: UiLayoutPayload;
  contentBinding?: string;
  contentMode?: UiContentMode;
  text?: string;
  stateModel?: UiStateModel;
  action?: UiActionPayload;
  children?: UiNodePayload[];
}

// A single CSS dimension token (no functions, no injection): a number with an
// allowed unit, or 'auto'.
// A single CSS dimension token: 'auto', a bare 0, or a number with an allowed
// unit. No functions, no injection.
const DIMENSION_RE = /^(auto|0|-?\d+(\.\d+)?(px|%|rem|em|fr|vh|vw))$/;
// inset shorthand: 1-4 space-separated dimension tokens.
const INSET_TOKEN = '(auto|0|-?\\d+(\\.\\d+)?(px|%|rem|em|vh|vw))';
const INSET_RE = new RegExp(`^${INSET_TOKEN}(\\s+${INSET_TOKEN}){0,3}$`);

const dimension = () => v.pipe(v.string(), v.regex(DIMENSION_RE));
const dim = () => v.optional(dimension());
const span = (lo: number, hi: number) => v.optional(v.pipe(v.number(), v.minValue(lo), v.maxValue(hi)));

const uiLayoutSchema = v.strictObject({
  display: v.optional(v.picklist(['block', 'flex', 'grid', 'absolute'])),
  direction: v.optional(v.picklist(['row', 'column'])),
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch'])),
  justify: v.optional(v.picklist(['start', 'center', 'end', 'between', 'around'])),
  hMode: v.optional(v.picklist(['fixed', 'hug', 'fill'])),
  gap: span(0, 512),
  padding: span(0, 512),
  width: dim(),
  height: dim(),
  minWidth: dim(),
  minHeight: dim(),
  position: v.optional(v.strictObject({
    left: dim(),
    right: dim(),
    top: dim(),
    bottom: dim(),
    inset: v.optional(v.pipe(v.string(), v.regex(INSET_RE))),
  })),
});

const uiActionSchema = v.strictObject({
  id: v.string(),
  params: v.optional(v.record(v.string(), v.union([v.string(), v.number(), v.boolean()]))),
  paramsBinding: v.optional(v.string()),
  target: v.optional(v.strictObject({
    kind: v.string(),
    id: v.string(),
  })),
  targetBinding: v.optional(v.string()),
});

// Recursive node schema. Structure is strict (reject unknown keys, bad types,
// bad enums); the embedded surface skin is lenient (clamps values) since visual
// drift should degrade gracefully, not reject the whole node.
export const uiNodeSchema: v.GenericSchema<UiNodePayload> = v.lazy(() => v.strictObject({
  id: v.string(),
  type: v.picklist(['button', 'panel', 'text', 'image', 'slot']),
  variant: v.optional(v.string()),
  materialId: v.optional(v.string()),
  skinId: v.optional(v.string()),
  surface: v.optional(surfaceOptionsLenientSchema),
  surfaceStates: surfaceStatesSchema,
  layout: v.optional(uiLayoutSchema),
  contentBinding: v.optional(v.string()),
  contentMode: v.optional(v.picklist(['plain', 'rich', 'auto'])),
  text: v.optional(v.string()),
  stateModel: v.optional(v.picklist(['static', 'momentary', 'selectable', 'disclosure'])),
  action: v.optional(uiActionSchema),
  children: v.optional(v.array(uiNodeSchema)),
})) as v.GenericSchema<UiNodePayload>;

/**
 * Validate an untrusted UI node payload. Fails closed: on any structural issue
 * it routes through fault() (throws in dev/CI, logs in prod) and returns null
 * so the caller falls back to a safe default skin rather than rendering
 * malformed/hostile data.
 */
export const validateUiNode = (input: unknown, label = 'ui-node'): UiNodePayload | null => {
  const result = v.safeParse(uiNodeSchema, input);
  if (result.success) return result.output;
  fault('ui.node.invalid', { label, issues: summarizeValibotIssues(result.issues) });
  return null;
};

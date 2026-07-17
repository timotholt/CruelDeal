import * as v from 'valibot';
import { textureOptions, type TextureKind } from '../../material-lab/TextureOptions';
import { paintMaskAssetIds, type PaintMaskAssetId } from './paintMaskAssets';
import {
  missionTypographyDocumentV1Schema,
  type MissionTypographyDocumentV1,
} from '../typography/missionTypography';

export const PAINT_SOURCE_SCHEMA_VERSION = 1 as const;
export const chromiumPrimaryPaintProfileId = 'chromium-primary-v1' as const;

export const appearancePartIds = ['panel', 'terms', 'primaryAction'] as const;
export type AppearancePartId = typeof appearancePartIds[number];
export const appearanceStateIds = ['idle', 'hover', 'focus-visible', 'holding', 'complete', 'disabled'] as const;
export type AppearanceStateId = typeof appearanceStateIds[number];
export const paintBorderEdges = ['top', 'right', 'bottom', 'left'] as const;
export type PaintBorderEdge = typeof paintBorderEdges[number];
export const paintCornerIds = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
export type PaintCornerId = typeof paintCornerIds[number];
export const proceduralPaintTextureIds = ['hex-grid', 'fine-noise'] as const;
export type PaintTextureId = typeof proceduralPaintTextureIds[number] | Exclude<TextureKind, 'none'>;
export const paintTextureOptions = [
  { id: 'hex-grid', label: 'Hex Grid' },
  { id: 'fine-noise', label: 'Fine Noise' },
  ...textureOptions.filter((option) => option.id !== 'none').map((option) => ({ id: option.id, label: option.label })),
] as ReadonlyArray<{ id: PaintTextureId; label: string }>;
export const paintTextureIds = paintTextureOptions.map((option) => option.id) as PaintTextureId[];

interface PaintLayerBase {
  id: string;
  enabled: boolean;
}

export type PaintLayerSourceV1 =
  | (PaintLayerBase & { type: 'fill'; color: string; opacity: number })
  | (PaintLayerBase & { type: 'backdropGlass'; blurPx: number; saturationPct: number; tintColor: string; tintOpacity: number })
  | (PaintLayerBase & { type: 'texture'; texture: PaintTextureId; color: string; opacity: number; scalePx: number })
  | (PaintLayerBase & { type: 'edgeWear'; variant: 'edge-chips' | 'edge-noise' | 'fine-scratches'; color: string; opacity: number; widthPx: number; scalePx: number })
  | (PaintLayerBase & { type: 'border'; color: string; opacity: number; widthPx: number; edges?: PaintBorderEdge[] })
  | (PaintLayerBase & { type: 'reflection'; color: string; opacity: number; angleDeg: number; startPct: number; endPct: number })
  | (PaintLayerBase & { type: 'shadow'; placement: 'inner' | 'outer'; color: string; opacity: number; xPx: number; yPx: number; blurPx: number; spreadPx: number })
  | (PaintLayerBase & { type: 'glow'; color: string; opacity: number; xPx: number; yPx: number; blurPx: number; spreadPx: number })
  | (PaintLayerBase & { type: 'maskImage'; assetId: PaintMaskAssetId; color: string; opacity: number })
  | (PaintLayerBase & { type: 'cornerBrackets'; color: string; opacity: number; insetPct: number; armPct: number; thicknessPx: number })
  | (PaintLayerBase & { type: 'scanLine'; color: string; opacity: number; thicknessPx: number; glowBlurPx: number });

export interface AppearanceGraphSourceV1 {
  schemaVersion: 1;
  id: string;
  part: AppearancePartId;
  state: AppearanceStateId;
  geometry: {
    clip: 'mission-chamfer' | 'rounded-rect';
    radiusPx: number;
    chamferPx: number;
    chamferTopRightPx?: number;
    chamferCorners?: PaintCornerId[];
  };
  layers: PaintLayerSourceV1[];
}

export interface MissionAppearanceDocumentV1 {
  schemaVersion: 1;
  targetProfile: 'chromium-primary-v1';
  typography: MissionTypographyDocumentV1;
  graphs: AppearanceGraphSourceV1[];
}

const ID_RE = /^[a-z0-9][a-z0-9._:-]{0,95}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const id = v.pipe(v.string(), v.regex(ID_RE));
const color = v.pipe(v.string(), v.regex(COLOR_RE));
const opacity = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const px = (max: number) => v.pipe(v.number(), v.minValue(0), v.maxValue(max));
const layerBase = { id, enabled: v.boolean() };

export const paintLayerSourceV1Schema: v.GenericSchema<PaintLayerSourceV1> = v.variant('type', [
  v.strictObject({ ...layerBase, type: v.literal('fill'), color, opacity }),
  v.strictObject({
    ...layerBase,
    type: v.literal('backdropGlass'),
    blurPx: px(64),
    saturationPct: v.pipe(v.number(), v.minValue(0), v.maxValue(240)),
    tintColor: color,
    tintOpacity: opacity,
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('texture'),
    texture: v.picklist(paintTextureIds),
    color,
    opacity,
    scalePx: v.pipe(v.number(), v.minValue(4), v.maxValue(512)),
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('edgeWear'),
    variant: v.picklist(['edge-chips', 'edge-noise', 'fine-scratches']),
    color,
    opacity,
    widthPx: v.pipe(v.number(), v.minValue(0.5), v.maxValue(16)),
    scalePx: v.pipe(v.number(), v.minValue(2), v.maxValue(96)),
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('border'),
    color,
    opacity,
    widthPx: px(8),
    edges: v.optional(v.pipe(v.array(v.picklist(paintBorderEdges)), v.minLength(1), v.maxLength(4))),
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('reflection'),
    color,
    opacity,
    angleDeg: v.pipe(v.number(), v.minValue(-360), v.maxValue(360)),
    startPct: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
    endPct: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('shadow'),
    placement: v.picklist(['inner', 'outer']),
    color,
    opacity,
    xPx: v.pipe(v.number(), v.minValue(-128), v.maxValue(128)),
    yPx: v.pipe(v.number(), v.minValue(-128), v.maxValue(128)),
    blurPx: px(128),
    spreadPx: v.pipe(v.number(), v.minValue(-32), v.maxValue(64)),
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('glow'),
    color,
    opacity,
    xPx: v.pipe(v.number(), v.minValue(-128), v.maxValue(128)),
    yPx: v.pipe(v.number(), v.minValue(-128), v.maxValue(128)),
    blurPx: px(128),
    spreadPx: v.pipe(v.number(), v.minValue(-32), v.maxValue(64)),
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('maskImage'),
    assetId: v.picklist(paintMaskAssetIds),
    color,
    opacity,
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('cornerBrackets'),
    color,
    opacity,
    insetPct: v.pipe(v.number(), v.minValue(0), v.maxValue(40)),
    armPct: v.pipe(v.number(), v.minValue(2), v.maxValue(30)),
    thicknessPx: v.pipe(v.number(), v.minValue(0.5), v.maxValue(8)),
  }),
  v.strictObject({
    ...layerBase,
    type: v.literal('scanLine'),
    color,
    opacity,
    thicknessPx: v.pipe(v.number(), v.minValue(1), v.maxValue(12)),
    glowBlurPx: px(48),
  }),
]) as v.GenericSchema<PaintLayerSourceV1>;

export const appearanceGraphSourceV1Schema: v.GenericSchema<AppearanceGraphSourceV1> = v.strictObject({
  schemaVersion: v.literal(PAINT_SOURCE_SCHEMA_VERSION),
  id,
  part: v.picklist(appearancePartIds),
  state: v.picklist(appearanceStateIds),
  geometry: v.strictObject({
    clip: v.picklist(['mission-chamfer', 'rounded-rect']),
    radiusPx: px(64),
    chamferPx: px(64),
    chamferTopRightPx: v.optional(px(96)),
    chamferCorners: v.optional(v.pipe(v.array(v.picklist(paintCornerIds)), v.maxLength(4))),
  }),
  layers: v.array(paintLayerSourceV1Schema),
}) as v.GenericSchema<AppearanceGraphSourceV1>;

export const missionAppearanceDocumentV1Schema: v.GenericSchema<MissionAppearanceDocumentV1> = v.strictObject({
  schemaVersion: v.literal(PAINT_SOURCE_SCHEMA_VERSION),
  targetProfile: v.literal(chromiumPrimaryPaintProfileId),
  typography: missionTypographyDocumentV1Schema,
  graphs: v.array(appearanceGraphSourceV1Schema),
}) as v.GenericSchema<MissionAppearanceDocumentV1>;

export type MissionAppearanceValidationResult =
  | { ok: true; document: MissionAppearanceDocumentV1 }
  | { ok: false; issues: Array<{ path: string; message: string }> };

const issuePath = (issue: { path?: readonly unknown[] }) => (issue.path || [])
  .map((item) => String((item as { key?: unknown }).key ?? ''))
  .filter(Boolean)
  .join('.');

export const validateMissionAppearanceDocumentV1 = (input: unknown): MissionAppearanceValidationResult => {
  const result = v.safeParse(missionAppearanceDocumentV1Schema, input);
  if (!result.success) {
    return {
      ok: false,
      issues: result.issues.map((issue) => ({ path: issuePath(issue), message: issue.message })),
    };
  }
  const graphIds = new Set<string>();
  for (const [graphIndex, graph] of result.output.graphs.entries()) {
    if (graphIds.has(graph.id)) {
      return { ok: false, issues: [{ path: `graphs.${graphIndex}.id`, message: `Duplicate graph id: ${graph.id}` }] };
    }
    graphIds.add(graph.id);
    const layerIds = new Set<string>();
    for (const [layerIndex, layer] of graph.layers.entries()) {
      if (layerIds.has(layer.id)) {
        return { ok: false, issues: [{ path: `graphs.${graphIndex}.layers.${layerIndex}.id`, message: `Duplicate layer id: ${layer.id}` }] };
      }
      layerIds.add(layer.id);
      if ((layer.type === 'maskImage' || layer.type === 'cornerBrackets' || layer.type === 'scanLine') && graph.part !== 'primaryAction') {
        return {
          ok: false,
          issues: [{
            path: `graphs.${graphIndex}.layers.${layerIndex}`,
            message: `${layer.type} is owned by the primaryAction part.`,
          }],
        };
      }
      if (layer.type === 'edgeWear' && graph.part !== 'panel') {
        return {
          ok: false,
          issues: [{
            path: `graphs.${graphIndex}.layers.${layerIndex}`,
            message: 'edgeWear is owned by the panel part.',
          }],
        };
      }
      if (layer.type === 'reflection' && layer.startPct > layer.endPct) {
        return {
          ok: false,
          issues: [{ path: `graphs.${graphIndex}.layers.${layerIndex}`, message: 'Reflection startPct cannot exceed endPct.' }],
        };
      }
      if (layer.type === 'border' && layer.edges) {
        if (new Set(layer.edges).size !== layer.edges.length) {
          return {
            ok: false,
            issues: [{ path: `graphs.${graphIndex}.layers.${layerIndex}.edges`, message: 'Border edges must be unique.' }],
          };
        }
        if (graph.geometry.clip === 'mission-chamfer') {
          return {
            ok: false,
            issues: [{ path: `graphs.${graphIndex}.layers.${layerIndex}.edges`, message: 'Chamfer borders must outline the complete clipped shape.' }],
          };
        }
      }
    }
  }
  return { ok: true, document: result.output };
};

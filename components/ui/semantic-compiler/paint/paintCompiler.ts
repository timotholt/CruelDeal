import {
  validateMissionAppearanceDocumentV1,
  type AppearanceGraphSourceV1,
  type MissionAppearanceDocumentV1,
  type PaintLayerSourceV1,
} from './paintSource';
import { resolvePaintMaskAsset } from './paintMaskAssets';

export type PaintAllocationSlot =
  | 'host.background'
  | 'host.backdrop-filter'
  | 'host.border'
  | 'host.box-shadow'
  | 'host.clip-path'
  | 'host::before'
  | 'host::after'
  | 'omitted';

export interface PaintIrOperationV1 {
  graphId: string;
  layerId: string;
  order: number;
  operation: PaintLayerSourceV1['type'];
  parameters: Record<string, unknown>;
}

export interface PaintIrV1 {
  schemaVersion: 1;
  targetProfile: 'chromium-primary-v1';
  operations: PaintIrOperationV1[];
}

export interface PaintAllocationEntryV1 {
  graphId: string;
  layerId: string;
  enabled: boolean;
  slot: PaintAllocationSlot;
  cssProperties: string[];
  reason: string;
}

export interface PaintAllocationReportV1 {
  schemaVersion: 1;
  targetProfile: 'chromium-primary-v1';
  browserEvidence: 'Google Chrome 150.0.7871.124';
  entries: PaintAllocationEntryV1[];
  helpers: [];
}

export type MissionPaintCompileResult =
  | {
    ok: true;
    paintIr: PaintIrV1;
    allocation: PaintAllocationReportV1;
    css: string;
  }
  | { ok: false; issues: Array<{ path: string; message: string }> };

const layerParameters = (layer: PaintLayerSourceV1): Record<string, unknown> => Object.fromEntries(
  Object.entries(layer).filter(([key]) => !['id', 'type', 'enabled'].includes(key)),
);

const allocationForLayer = (
  graph: AppearanceGraphSourceV1,
  layer: PaintLayerSourceV1,
): PaintAllocationEntryV1 => {
  if (!layer.enabled) {
    return {
      graphId: graph.id,
      layerId: layer.id,
      enabled: false,
      slot: 'omitted',
      cssProperties: [],
      reason: 'Disabled authored layers emit no residual paint rule.',
    };
  }
  const allocation = {
    fill: ['host.background', ['background-image'], 'Folded into the semantic host background stack.'],
    backdropGlass: ['host.backdrop-filter', ['backdrop-filter', '-webkit-backdrop-filter', 'background-image'], 'Native Chromium backdrop filtering on the semantic host.'],
    texture: ['host.background', ['background-image', 'background-size', 'background-repeat'], 'Procedural texture folded into the semantic host background stack.'],
    edgeWear: ['host.background', ['background-image', 'background-size', 'background-repeat'], 'Deterministic rough edge paint is folded into the panel host background stack.'],
    border: graph.geometry.clip === 'mission-chamfer'
      ? ['host::before', ['content', 'clip-path', 'background-color', 'mask'], 'Chamfer-following hairline uses the host before paint slot.']
      : ['host.border', ['border'], 'Native border on the semantic host.'],
    reflection: ['host.background', ['background-image', 'background-size', 'background-repeat'], 'Directional reflection is folded into the semantic host background stack.'],
    shadow: ['host.box-shadow', ['box-shadow'], 'Native box shadow on the semantic host.'],
    glow: ['host.box-shadow', ['box-shadow'], 'Localized glow shares the semantic host shadow stack.'],
    maskImage: ['host::before', ['content', 'mask-image', '-webkit-mask-image', 'background-color', 'opacity'], 'Fingerprint glyph uses the action host before paint slot.'],
    cornerBrackets: ['host.background', ['background-image', 'background-size', 'background-repeat'], 'Fingerprint brackets are one vector background layer on the semantic action host.'],
    scanLine: ['host::after', ['content', 'background-image', 'box-shadow', 'transform'], 'Progress scan uses the action host after paint slot.'],
  }[layer.type] as [PaintAllocationSlot, string[], string];
  return {
    graphId: graph.id,
    layerId: layer.id,
    enabled: true,
    slot: allocation[0],
    cssProperties: allocation[1],
    reason: allocation[2],
  };
};

const fmt = (value: number) => Number(value.toFixed(4)).toString();
const rgba = (hex: string, alpha: number) => {
  const numeric = Number.parseInt(hex.slice(1), 16);
  return `rgb(${numeric >> 16} ${(numeric >> 8) & 255} ${numeric & 255} / ${fmt(alpha)})`;
};
export const paintClassForGraphId = (id: string) => `ui-paint-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

interface CompiledBackgroundLayer {
  image: string;
  size: string;
  repeat: 'no-repeat' | 'repeat';
}

const backgroundForLayer = (layer: PaintLayerSourceV1): CompiledBackgroundLayer | null => {
  if (!layer.enabled) return null;
  if (layer.type === 'fill') {
    const value = rgba(layer.color, layer.opacity);
    return { image: `linear-gradient(${value}, ${value})`, size: '100% 100%', repeat: 'no-repeat' };
  }
  if (layer.type === 'backdropGlass') {
    const value = rgba(layer.tintColor, layer.tintOpacity);
    return { image: `linear-gradient(${value}, ${value})`, size: '100% 100%', repeat: 'no-repeat' };
  }
  if (layer.type === 'texture' && layer.texture === 'hex-grid') {
    const svg = `%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='42' viewBox='0 0 36 42'%3E%3Cpath d='M18 1 35 10.5v21L18 41 1 31.5v-21Z' fill='none' stroke='%23${layer.color.slice(1)}' stroke-opacity='${fmt(layer.opacity)}' stroke-width='1'/%3E%3C/svg%3E`;
    return { image: `url("data:image/svg+xml,${svg}")`, size: `${fmt(layer.scalePx)}px ${fmt(layer.scalePx)}px`, repeat: 'repeat' };
  }
  if (layer.type === 'texture') {
    return {
      image: `radial-gradient(circle at 30% 40%, ${rgba(layer.color, layer.opacity)} 0 1px, transparent 1.5px)`,
      size: `${fmt(layer.scalePx)}px ${fmt(layer.scalePx)}px`,
      repeat: 'repeat',
    };
  }
  if (layer.type === 'edgeWear') {
    const dash = Math.max(1, layer.scalePx);
    const dashPattern = layer.variant === 'edge-chips'
      ? `${fmt(dash * 0.18)} ${fmt(dash * 0.42)} ${fmt(dash * 0.08)} ${fmt(dash * 0.7)}`
      : layer.variant === 'fine-scratches'
        ? `${fmt(dash * 0.05)} ${fmt(dash * 0.3)}`
        : `${fmt(dash * 0.1)} ${fmt(dash * 0.18)} ${fmt(dash * 0.04)} ${fmt(dash * 0.24)}`;
    const svg = `%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M3 0H88L100 12V97H12L0 85V3Z' fill='none' stroke='%23${layer.color.slice(1)}' stroke-opacity='${fmt(layer.opacity)}' stroke-width='${fmt(layer.widthPx)}' vector-effect='non-scaling-stroke' stroke-dasharray='${dashPattern}'/%3E%3Cpath d='M0 6H82M94 18V91M91 100H18M6 82V18' fill='none' stroke='%23${layer.color.slice(1)}' stroke-opacity='${fmt(layer.opacity * 0.55)}' stroke-width='${fmt(Math.max(0.5, layer.widthPx * 0.55))}' vector-effect='non-scaling-stroke' stroke-dasharray='${fmt(dash * 0.04)} ${fmt(dash * 0.5)}'/%3E%3C/svg%3E`;
    return { image: `url("data:image/svg+xml,${svg}")`, size: '100% 100%', repeat: 'no-repeat' };
  }
  if (layer.type === 'reflection') {
    return {
      image: `linear-gradient(${fmt(layer.angleDeg)}deg, transparent ${fmt(layer.startPct)}%, ${rgba(layer.color, layer.opacity)} ${fmt(layer.endPct)}%, transparent 100%)`,
      size: '100% 100%',
      repeat: 'no-repeat',
    };
  }
  if (layer.type === 'cornerBrackets') {
    const inset = fmt(layer.insetPct);
    const far = fmt(100 - layer.insetPct);
    const armNear = fmt(layer.insetPct + layer.armPct);
    const armFar = fmt(100 - layer.insetPct - layer.armPct);
    const svg = `%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cg fill='none' stroke='%23${layer.color.slice(1)}' stroke-opacity='${fmt(layer.opacity)}' stroke-width='${fmt(layer.thicknessPx)}' stroke-linecap='square'%3E%3Cpath d='M${inset} ${armNear}V${inset}H${armNear}M${armFar} ${inset}H${far}V${armNear}M${far} ${armFar}V${far}H${armFar}M${armNear} ${far}H${inset}V${armFar}'/%3E%3C/g%3E%3C/svg%3E`;
    return { image: `url("data:image/svg+xml,${svg}")`, size: '100% 82%', repeat: 'no-repeat' };
  }
  return null;
};

const chamferPolygon = (graph: AppearanceGraphSourceV1) => {
  const c = `${fmt(graph.geometry.chamferPx)}px`;
  const topRight = `${fmt(graph.geometry.chamferTopRightPx ?? graph.geometry.chamferPx)}px`;
  return `polygon(${c} 0, calc(100% - ${topRight}) 0, 100% ${topRight}, 100% calc(100% - ${c}), calc(100% - ${c}) 100%, ${c} 100%, 0 calc(100% - ${c}), 0 ${c})`;
};

const cssForGraph = (graph: AppearanceGraphSourceV1): string => {
  const selector = `.${paintClassForGraphId(graph.id)}`;
  // Paint output must not take ownership of layout. The semantic runtime host
  // establishes its own containing block (relative, absolute, fixed, etc.).
  // Emitting `position: relative` here would silently replace an authored
  // screen-relative layout when this class is loaded after runtime CSS.
  const declarations: string[] = [];
  if (graph.geometry.clip === 'mission-chamfer') {
    declarations.push(`clip-path: ${chamferPolygon(graph)}`);
  } else {
    declarations.push(`border-radius: ${fmt(graph.geometry.radiusPx)}px`);
  }
  const backgrounds = graph.layers.map(backgroundForLayer).filter((value): value is CompiledBackgroundLayer => Boolean(value)).reverse();
  if (backgrounds.length) {
    declarations.push(
      `background-image: ${backgrounds.map((layer) => layer.image).join(', ')}`,
      `background-size: ${backgrounds.map((layer) => layer.size).join(', ')}`,
      `background-repeat: ${backgrounds.map((layer) => layer.repeat).join(', ')}`,
    );
  }
  const glass = graph.layers.find((layer) => layer.enabled && layer.type === 'backdropGlass');
  if (glass?.type === 'backdropGlass') {
    const filter = `blur(${fmt(glass.blurPx)}px) saturate(${fmt(glass.saturationPct)}%)`;
    declarations.push(`-webkit-backdrop-filter: ${filter}`, `backdrop-filter: ${filter}`);
  }
  const border = graph.layers.find((layer) => layer.enabled && layer.type === 'border');
  if (border?.type === 'border' && graph.geometry.clip !== 'mission-chamfer') {
    const borderValue = `${fmt(border.widthPx)}px solid ${rgba(border.color, border.opacity)}`;
    if (border.edges) {
      declarations.push(...border.edges.map((edge) => `border-${edge}: ${borderValue}`));
    } else {
      declarations.push(`border: ${borderValue}`);
    }
  }
  const shadows = graph.layers.flatMap((layer) => {
    if (!layer.enabled || (layer.type !== 'shadow' && layer.type !== 'glow')) return [];
    const inset = layer.type === 'shadow' && layer.placement === 'inner' ? 'inset ' : '';
    return [`${inset}${fmt(layer.xPx)}px ${fmt(layer.yPx)}px ${fmt(layer.blurPx)}px ${fmt(layer.spreadPx)}px ${rgba(layer.color, layer.opacity)}`];
  });
  if (shadows.length) declarations.push(`box-shadow: ${shadows.join(', ')}`);

  const rules = [`${selector} {\n  ${declarations.join(';\n  ')};\n}`];
  const before = graph.layers.find((layer) => layer.enabled && layer.type === 'maskImage');
  if (border?.type === 'border' && graph.geometry.clip === 'mission-chamfer') {
    rules.push(`${selector}::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  padding: ${fmt(border.widthPx)}px;\n  pointer-events: none;\n  clip-path: ${chamferPolygon(graph)};\n  background-color: ${rgba(border.color, border.opacity)};\n  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);\n  -webkit-mask-composite: xor;\n  mask-composite: exclude;\n}`);
  }
  if (before?.type === 'maskImage') {
    const maskAsset = resolvePaintMaskAsset(before.assetId);
    rules.push(`${selector}::before {\n  content: "";\n  position: absolute;\n  inset: 8% 11% 24%;\n  pointer-events: none;\n  background-color: ${rgba(before.color, before.opacity)};\n  -webkit-mask-image: ${maskAsset.cssUrl};\n  mask-image: ${maskAsset.cssUrl};\n  -webkit-mask-position: center;\n  mask-position: center;\n  -webkit-mask-size: contain;\n  mask-size: contain;\n  -webkit-mask-repeat: no-repeat;\n  mask-repeat: no-repeat;\n}`);
  }
  const after = graph.layers.find((layer) => layer.enabled && layer.type === 'scanLine');
  if (after?.type === 'scanLine') {
    rules.push(`${selector}::after {\n  content: "";\n  position: absolute;\n  left: 11%;\n  right: 11%;\n  top: 8%;\n  height: ${fmt(after.thicknessPx)}px;\n  pointer-events: none;\n  background-image: linear-gradient(90deg, transparent, ${rgba(after.color, after.opacity)}, transparent);\n  box-shadow: 0 0 ${fmt(after.glowBlurPx)}px ${rgba(after.color, after.opacity)};\n  transform: translateY(0);\n}`);
  }
  return rules.join('\n');
};

export const compileMissionPaintV1 = (input: unknown): MissionPaintCompileResult => {
  const validation = validateMissionAppearanceDocumentV1(input);
  if (!validation.ok) return validation;

  for (const [graphIndex, graph] of validation.document.graphs.entries()) {
    const beforeLayers = graph.layers.filter((layer) => (
      layer.enabled
      && (layer.type === 'maskImage' || (layer.type === 'border' && graph.geometry.clip === 'mission-chamfer'))
    ));
    if (beforeLayers.length > 1) {
      return {
        ok: false,
        issues: [{
          path: `graphs.${graphIndex}.layers`,
          message: 'Chromium primary target has one host::before slot; this graph requests multiple exclusive before layers.',
        }],
      };
    }
  }

  const operations = validation.document.graphs.flatMap((graph) => graph.layers.flatMap((layer, order) => (
    layer.enabled ? [{ graphId: graph.id, layerId: layer.id, order, operation: layer.type, parameters: layerParameters(layer) }] : []
  )));
  const entries = validation.document.graphs.flatMap((graph) => [
    {
      graphId: graph.id,
      layerId: '$geometry',
      enabled: true,
      slot: 'host.clip-path' as const,
      cssProperties: graph.geometry.clip === 'mission-chamfer' ? ['clip-path'] : ['border-radius'],
      reason: 'Part geometry is applied once by the semantic host and shared by every layer.',
    },
    ...graph.layers.map((layer) => allocationForLayer(graph, layer)),
  ]);
  return {
    ok: true,
    paintIr: {
      schemaVersion: 1,
      targetProfile: validation.document.targetProfile,
      operations,
    },
    allocation: {
      schemaVersion: 1,
      targetProfile: validation.document.targetProfile,
      browserEvidence: 'Google Chrome 150.0.7871.124',
      entries,
      helpers: [],
    },
    css: `${validation.document.graphs.map(cssForGraph).join('\n\n')}\n`,
  };
};

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };
const canonicalize = (value: unknown): CanonicalJson => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
};
export const serializePaintArtifact = (value: unknown) => `${JSON.stringify(canonicalize(value), null, 2)}\n`;

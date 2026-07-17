import {
  validateMissionAppearanceDocumentV1,
  type AppearanceGraphSourceV1,
  type PaintLayerSourceV1,
} from './paintSource';
import {
  getEdgeTextureOption,
  getTextureOption,
  type EdgeTextureKind,
  type TextureKind,
} from '../../material-lab/TextureOptions';
import { resolvePaintMaskAsset } from './paintMaskAssets';
import {
  allocateBoundedSurfaceShell,
  type SurfaceShellPaintSlot,
} from './surfaceShellAllocator';

export type PaintAllocationSlot =
  | 'host.background'
  | 'host.backdrop-filter'
  | 'host.border'
  | 'host.box-shadow'
  | 'host.geometry'
  | 'host::before'
  | 'host::after'
  | 'helper.underlay'
  | 'helper.overlay'
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
  helpers: PaintHelperAllocationV1[];
}

export interface PaintHelperAllocationV1 {
  graphId: string;
  slot: 'underlay' | 'overlay';
  className: string;
  layerIds: string[];
  reason: string;
  cost: 1;
}

export interface PaintShellClassMapV1 {
  underlay?: string;
  overlay?: string;
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
  allocatedExclusiveSlot?: SurfaceShellPaintSlot,
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
    texture: ['host.background', ['background-image', 'background-size', 'background-repeat'], 'Authored procedural or image texture folded into the semantic host background stack.'],
    edgeWear: ['host::after', ['content', 'border', 'border-radius', 'corner-shape', 'mask-image'], 'Rough edge paint inherits the semantic host geometry in the after paint slot.'],
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
  const slot = allocatedExclusiveSlot ?? allocation[0];
  return {
    graphId: graph.id,
    layerId: layer.id,
    enabled: true,
    slot,
    cssProperties: allocation[1],
    reason: allocatedExclusiveSlot?.startsWith('helper.')
      ? `${allocation[2]} The preferred pseudo was occupied, so this operation uses the bounded ${allocatedExclusiveSlot.replace('helper.', '')} helper.`
      : allocation[2],
  };
};

const fmt = (value: number) => Number(value.toFixed(4)).toString();
const rgba = (hex: string, alpha: number) => {
  const numeric = Number.parseInt(hex.slice(1), 16);
  return `rgb(${numeric >> 16} ${(numeric >> 8) & 255} ${numeric & 255} / ${fmt(alpha)})`;
};
const edgeWearTexture = (variant: Extract<PaintLayerSourceV1, { type: 'edgeWear' }>['variant']) => {
  const textureByVariant: Record<typeof variant, EdgeTextureKind> = {
    'edge-chips': 'edge-bw-chips-fine',
    'edge-noise': 'edge-bw-noise-dense',
    'fine-scratches': 'edge-micro-chips-fine',
  };
  return getEdgeTextureOption(textureByVariant[variant]);
};
export const paintClassForGraphId = (id: string) => `ui-paint-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
export const paintHelperClassForGraphId = (
  id: string,
  slot: PaintHelperAllocationV1['slot'],
) => `${paintClassForGraphId(id)}__${slot}`;

export const paintShellClassMapForGraphId = (
  allocation: PaintAllocationReportV1,
  graphId: string,
): PaintShellClassMapV1 => Object.fromEntries(
  allocation.helpers
    .filter((helper) => helper.graphId === graphId)
    .map((helper) => [helper.slot, helper.className]),
) as PaintShellClassMapV1;

interface GraphPaintAllocation {
  layerSlots: Map<string, SurfaceShellPaintSlot>;
  helpers: PaintHelperAllocationV1[];
}

const exclusiveSlotForLayer = (
  graph: AppearanceGraphSourceV1,
  layer: PaintLayerSourceV1,
) => {
  if (!layer.enabled) return undefined;
  if (layer.type === 'maskImage' || (layer.type === 'border' && graph.geometry.clip === 'mission-chamfer')) {
    return 'host::before' as const;
  }
  if (layer.type === 'edgeWear' || layer.type === 'scanLine') return 'host::after' as const;
  return undefined;
};

const allocateGraphPaint = (
  graph: AppearanceGraphSourceV1,
): { ok: true; allocation: GraphPaintAllocation } | { ok: false; messages: string[] } => {
  const shell = allocateBoundedSurfaceShell(graph.layers.flatMap((layer) => {
    const preferredSlot = exclusiveSlotForLayer(graph, layer);
    return preferredSlot ? [{ layerId: layer.id, preferredSlot }] : [];
  }));
  if (!shell.ok) return { ok: false, messages: shell.issues.map((issue) => issue.message) };

  const layerSlots = new Map(shell.assignments.map((assignment) => [assignment.layerId, assignment.slot]));
  const helpers = shell.helpers.map((helperSlot): PaintHelperAllocationV1 => {
    const slot = helperSlot === 'helper.underlay' ? 'underlay' : 'overlay';
    return {
      graphId: graph.id,
      slot,
      className: paintHelperClassForGraphId(graph.id, slot),
      layerIds: shell.assignments
        .filter((assignment) => assignment.slot === helperSlot)
        .map((assignment) => assignment.layerId),
      reason: `The graph exceeded ${helperSlot === 'helper.underlay' ? 'host::before' : 'host::after'} capacity and was lowered into the one bounded ${slot} helper.`,
      cost: 1,
    };
  });
  return { ok: true, allocation: { layerSlots, helpers } };
};

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
  if (layer.type === 'texture' && layer.texture === 'fine-noise') {
    return {
      image: `radial-gradient(circle at 30% 40%, ${rgba(layer.color, layer.opacity)} 0 1px, transparent 1.5px)`,
      size: `${fmt(layer.scalePx)}px ${fmt(layer.scalePx)}px`,
      repeat: 'repeat',
    };
  }
  if (layer.type === 'texture') {
    const texture = getTextureOption(layer.texture as TextureKind);
    return {
      image: `-webkit-cross-fade(linear-gradient(transparent, transparent), url("${texture.url}"), ${fmt(layer.opacity)})`,
      size: `${fmt(layer.scalePx)}px ${fmt(layer.scalePx)}px`,
      repeat: 'repeat',
    };
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

const allPaintCorners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
const chamferCorners = (graph: AppearanceGraphSourceV1) => (
  graph.geometry.clip === 'mission-chamfer'
    ? graph.geometry.chamferCorners ?? [...allPaintCorners]
    : []
);
const cornerSize = (graph: AppearanceGraphSourceV1, corner: typeof allPaintCorners[number]) => (
  corner === 'top-right'
    ? graph.geometry.chamferTopRightPx ?? graph.geometry.chamferPx
    : graph.geometry.chamferPx
);
const cornerCut = (graph: AppearanceGraphSourceV1, corner: typeof allPaintCorners[number]) => (
  `${fmt(chamferCorners(graph).includes(corner) ? cornerSize(graph, corner) : 0)}px`
);
const chamferPolygon = (graph: AppearanceGraphSourceV1) => {
  const [topLeft, topRight, bottomRight, bottomLeft] = allPaintCorners.map((corner) => cornerCut(graph, corner));
  return `polygon(${topLeft} 0, calc(100% - ${topRight}) 0, 100% ${topRight}, 100% calc(100% - ${bottomRight}), calc(100% - ${bottomRight}) 100%, ${bottomLeft} 100%, 0 calc(100% - ${bottomLeft}), 0 ${topLeft})`;
};
const cornerRadius = (graph: AppearanceGraphSourceV1, corner: typeof allPaintCorners[number]) => (
  `${fmt(chamferCorners(graph).includes(corner) ? cornerSize(graph, corner) : graph.geometry.radiusPx)}px`
);
const cornerShape = (graph: AppearanceGraphSourceV1, corner: typeof allPaintCorners[number]) => (
  chamferCorners(graph).includes(corner) ? 'bevel' : 'round'
);
const graphUsesHostGeometry = (graph: AppearanceGraphSourceV1) => (
  !graph.layers.some((layer) => layer.enabled && layer.type === 'cornerBrackets')
);

const selectorForPaintSlot = (
  hostSelector: string,
  graphId: string,
  slot: SurfaceShellPaintSlot,
) => {
  if (slot === 'host::before') return `${hostSelector}::before`;
  if (slot === 'host::after') return `${hostSelector}::after`;
  return `.${paintHelperClassForGraphId(graphId, slot === 'helper.underlay' ? 'underlay' : 'overlay')}`;
};

const surfaceShellHelperCss = `.ui-paint-helper {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border-radius: inherit;
  corner-shape: inherit;
  pointer-events: none;
}
.ui-paint-helper--underlay {
  z-index: -1;
}
.ui-paint-helper--overlay {
  z-index: 1;
}`;

const cssForGraph = (
  graph: AppearanceGraphSourceV1,
  allocation: GraphPaintAllocation,
): string => {
  const selector = `.${paintClassForGraphId(graph.id)}`;
  // Paint output must not take ownership of layout. The semantic runtime host
  // establishes its own containing block (relative, absolute, fixed, etc.).
  // Emitting `position: relative` here would silently replace an authored
  // screen-relative layout when this class is loaded after runtime CSS.
  const declarations: string[] = [];
  if (allocation.helpers.length) declarations.push('isolation: isolate');
  const usesHostGeometry = graphUsesHostGeometry(graph);
  if (!usesHostGeometry) {
    declarations.push('border-radius: 0');
  } else if (graph.geometry.clip === 'mission-chamfer') {
    declarations.push(
      `border-radius: ${allPaintCorners.map((corner) => cornerRadius(graph, corner)).join(' ')}`,
      `corner-shape: ${allPaintCorners.map((corner) => cornerShape(graph, corner)).join(' ')}`,
      'overflow: hidden',
    );
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
  const borders = graph.layers.filter((layer) => layer.enabled && layer.type === 'border');
  for (const border of borders) {
    if (border.type !== 'border' || graph.geometry.clip === 'mission-chamfer') continue;
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
  if (usesHostGeometry && graph.geometry.clip === 'mission-chamfer') {
    rules.push(`@supports not (corner-shape: bevel) {\n  ${selector} {\n    border-radius: 0;\n    clip-path: ${chamferPolygon(graph)};\n  }\n}`);
  }
  for (const border of borders) {
    if (border.type !== 'border' || graph.geometry.clip !== 'mission-chamfer') continue;
    const borderSlot = allocation.layerSlots.get(border.id) ?? 'host::before';
    const borderSelector = selectorForPaintSlot(selector, graph.id, borderSlot);
    rules.push(`${borderSelector} {\n  content: "";\n  position: absolute;\n  inset: 0;\n  padding: ${fmt(border.widthPx)}px;\n  pointer-events: none;\n  border-radius: inherit;\n  corner-shape: inherit;\n  background-color: ${rgba(border.color, border.opacity)};\n  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);\n  -webkit-mask-composite: xor;\n  mask-composite: exclude;\n}`);
    rules.push(`@supports not (corner-shape: bevel) {\n  ${borderSelector} {\n    clip-path: ${chamferPolygon(graph)};\n  }\n}`);
  }
  for (const maskImage of graph.layers.filter((layer) => layer.enabled && layer.type === 'maskImage')) {
    if (maskImage.type !== 'maskImage') continue;
    const maskAsset = resolvePaintMaskAsset(maskImage.assetId);
    const maskSlot = allocation.layerSlots.get(maskImage.id) ?? 'host::before';
    const maskSelector = selectorForPaintSlot(selector, graph.id, maskSlot);
    rules.push(`${maskSelector} {\n  content: "";\n  position: absolute;\n  inset: 8% 5% 24%;\n  pointer-events: none;\n  background-color: ${rgba(maskImage.color, maskImage.opacity)};\n  -webkit-mask-image: ${maskAsset.cssUrl};\n  mask-image: ${maskAsset.cssUrl};\n  -webkit-mask-position: center;\n  mask-position: center;\n  -webkit-mask-size: contain;\n  mask-size: contain;\n  -webkit-mask-repeat: no-repeat;\n  mask-repeat: no-repeat;\n}`);
  }
  for (const edgeWear of graph.layers.filter((layer) => layer.enabled && layer.type === 'edgeWear')) {
    if (edgeWear.type !== 'edgeWear') continue;
    const texture = edgeWearTexture(edgeWear.variant);
    const edgeWearSlot = allocation.layerSlots.get(edgeWear.id) ?? 'host::after';
    const edgeWearSelector = selectorForPaintSlot(selector, graph.id, edgeWearSlot);
    rules.push(`${edgeWearSelector} {\n  content: "";\n  position: absolute;\n  inset: 0;\n  box-sizing: border-box;\n  pointer-events: none;\n  border: ${fmt(edgeWear.widthPx)}px solid ${rgba(edgeWear.color, edgeWear.opacity)};\n  border-radius: inherit;\n  corner-shape: inherit;\n  -webkit-mask-image: url("${texture.url}");\n  mask-image: url("${texture.url}");\n  mask-mode: luminance;\n  -webkit-mask-position: center;\n  mask-position: center;\n  -webkit-mask-repeat: repeat;\n  mask-repeat: repeat;\n  -webkit-mask-size: ${fmt(edgeWear.scalePx)}px ${fmt(edgeWear.scalePx)}px;\n  mask-size: ${fmt(edgeWear.scalePx)}px ${fmt(edgeWear.scalePx)}px;\n}`);
    if (graph.geometry.clip === 'mission-chamfer') {
      rules.push(`@supports not (corner-shape: bevel) {\n  ${edgeWearSelector} {\n    clip-path: ${chamferPolygon(graph)};\n  }\n}`);
    }
  }
  for (const scanLine of graph.layers.filter((layer) => layer.enabled && layer.type === 'scanLine')) {
    if (scanLine.type !== 'scanLine') continue;
    const scanLineSlot = allocation.layerSlots.get(scanLine.id) ?? 'host::after';
    const scanLineSelector = selectorForPaintSlot(selector, graph.id, scanLineSlot);
    rules.push(`${scanLineSelector} {\n  content: "";\n  position: absolute;\n  left: 11%;\n  right: 11%;\n  top: 8%;\n  height: ${fmt(scanLine.thicknessPx)}px;\n  pointer-events: none;\n  background-image: linear-gradient(90deg, transparent, ${rgba(scanLine.color, scanLine.opacity)}, transparent);\n  box-shadow: 0 0 ${fmt(scanLine.glowBlurPx)}px ${rgba(scanLine.color, scanLine.opacity)};\n  transform: translateY(0);\n}`);
  }
  return rules.join('\n');
};

export const compileMissionPaintV1 = (input: unknown): MissionPaintCompileResult => {
  const validation = validateMissionAppearanceDocumentV1(input);
  if (!validation.ok) return validation;

  const graphAllocations = new Map<string, GraphPaintAllocation>();
  for (const [graphIndex, graph] of validation.document.graphs.entries()) {
    const result = allocateGraphPaint(graph);
    if (!result.ok) {
      return {
        ok: false,
        issues: result.messages.map((message) => ({
          path: `graphs.${graphIndex}.layers`,
          message,
        })),
      };
    }
    graphAllocations.set(graph.id, result.allocation);
  }

  const operations = validation.document.graphs.flatMap((graph) => graph.layers.flatMap((layer, order) => (
    layer.enabled ? [{ graphId: graph.id, layerId: layer.id, order, operation: layer.type, parameters: layerParameters(layer) }] : []
  )));
  const entries = validation.document.graphs.flatMap((graph) => {
    const graphAllocation = graphAllocations.get(graph.id)!;
    return [
      {
        graphId: graph.id,
        layerId: '$geometry',
        enabled: true,
        slot: graphUsesHostGeometry(graph) ? 'host.geometry' as const : 'omitted' as const,
        cssProperties: graphUsesHostGeometry(graph)
          ? graph.geometry.clip === 'mission-chamfer'
            ? ['border-radius', 'corner-shape', 'clip-path']
            : ['border-radius']
          : [],
        reason: graphUsesHostGeometry(graph)
          ? 'Part geometry is applied once by the semantic host and shared by every layer.'
          : 'Decorative corner brackets own their own geometry and must not be clipped by the action host.',
      },
      ...graph.layers.map((layer) => allocationForLayer(
        graph,
        layer,
        graphAllocation.layerSlots.get(layer.id),
      )),
    ];
  });
  const helpers = validation.document.graphs.flatMap(
    (graph) => graphAllocations.get(graph.id)!.helpers,
  );
  const graphCss = validation.document.graphs.map(
    (graph) => cssForGraph(graph, graphAllocations.get(graph.id)!),
  ).join('\n\n');
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
      helpers,
    },
    css: `${helpers.length ? `${surfaceShellHelperCss}\n\n` : ''}${graphCss}\n`,
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

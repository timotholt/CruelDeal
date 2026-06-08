import type { SurfaceOptions } from './surfaceSchema';
import {
  surfaceFieldDefinitions,
  type SurfaceFieldDefinition,
  type SurfaceFieldGroup,
} from './surfaceFieldMetadata';

export type SurfaceEditorMode = 'rest' | 'state';

export interface SurfaceEditorCapabilities {
  groups?: readonly SurfaceFieldGroup[];
  fields?: readonly (keyof SurfaceOptions)[];
  hiddenGroups?: readonly SurfaceFieldGroup[];
  hiddenFields?: readonly (keyof SurfaceOptions)[];
  disabledGroups?: readonly SurfaceFieldGroup[];
  disabledFields?: readonly (keyof SurfaceOptions)[];
}

export type SurfaceEditorPatch = Partial<{
  [K in keyof SurfaceOptions]: SurfaceOptions[K] | undefined;
}>;

const defaultEdgeWearTexture: NonNullable<SurfaceOptions['edgeWearTexture']> = 'edge-bw-noise-dense';
const defaultEdgeWearOpacity = 45;
const defaultEdgeWearWidth = 5;
const defaultEdgeWearScale = 256;
const defaultEdgeWearLayer: NonNullable<SurfaceOptions['edgeWearLayer']> = 'below-highlights';

const modeAllows = (definition: SurfaceFieldDefinition, mode: SurfaceEditorMode) => (
  definition.editMode === 'rest-and-state' || definition.editMode === mode
);

export const surfaceFieldAllowedByCapabilities = (
  definition: SurfaceFieldDefinition,
  capabilities: SurfaceEditorCapabilities = {},
) => {
  if (capabilities.fields && !capabilities.fields.includes(definition.key)) return false;
  if (capabilities.groups && !capabilities.groups.includes(definition.group)) return false;
  if (capabilities.hiddenFields?.includes(definition.key)) return false;
  if (capabilities.hiddenGroups?.includes(definition.group)) return false;
  return true;
};

export const surfaceFieldDisabledByCapabilities = (
  definition: SurfaceFieldDefinition,
  capabilities: SurfaceEditorCapabilities = {},
) => (
  capabilities.disabledFields?.includes(definition.key)
  || capabilities.disabledGroups?.includes(definition.group)
  || false
);

export const visibleSurfaceFieldDefinitions = (options: {
  mode: SurfaceEditorMode;
  groups?: readonly SurfaceFieldGroup[];
  fields?: readonly (keyof SurfaceOptions)[];
  capabilities?: SurfaceEditorCapabilities;
}) => {
  const capabilities: SurfaceEditorCapabilities = {
    ...options.capabilities,
    groups: options.groups ?? options.capabilities?.groups,
    fields: options.fields ?? options.capabilities?.fields,
  };

  const visibleFields = surfaceFieldDefinitions.filter((definition) => (
    definition.control !== 'none'
    && definition.editMode !== 'renderer-internal'
    && modeAllows(definition, options.mode)
    && surfaceFieldAllowedByCapabilities(definition, capabilities)
  ));

  if (!options.fields) return visibleFields;

  return [...visibleFields].sort(
    (a, b) => options.fields!.indexOf(a.key) - options.fields!.indexOf(b.key),
  );
};

export const patchSurfaceField = <K extends keyof SurfaceOptions>(
  key: K,
  value: SurfaceOptions[K],
): SurfaceEditorPatch => ({ [key]: value } as SurfaceEditorPatch);

export const patchSurfaceFieldWithContext = <K extends keyof SurfaceOptions>(
  key: K,
  value: SurfaceOptions[K],
  current: Partial<SurfaceOptions> = {},
): SurfaceEditorPatch => {
  if (key === 'texture') {
    const texture = value as SurfaceOptions['texture'];
    if (texture === 'none') return { texture, textureStrength: 0 };
    return {
      texture,
      textureStrength: (current.textureStrength ?? 0) > 0 ? current.textureStrength : 100,
    };
  }
  if (key === 'edgeWear') {
    const edgeWear = value as SurfaceOptions['edgeWear'];
    if (!edgeWear) return { edgeWear: false };
    return {
      edgeWear: true,
      edgeWearTexture: current.edgeWearTexture && current.edgeWearTexture !== 'none'
        ? current.edgeWearTexture
        : defaultEdgeWearTexture,
      edgeWearOpacity: (current.edgeWearOpacity ?? 0) > 0 ? current.edgeWearOpacity : defaultEdgeWearOpacity,
      edgeWearWidth: current.edgeWearWidth ?? defaultEdgeWearWidth,
      edgeWearScale: current.edgeWearScale ?? defaultEdgeWearScale,
      edgeWearLayer: current.edgeWearLayer ?? defaultEdgeWearLayer,
    };
  }
  if (key === 'edgeWearTexture') {
    const edgeWearTexture = value as SurfaceOptions['edgeWearTexture'];
    if (edgeWearTexture === 'none') return { edgeWearTexture, edgeWear: false };
    return {
      edgeWear: true,
      edgeWearTexture,
      edgeWearOpacity: (current.edgeWearOpacity ?? 0) > 0 ? current.edgeWearOpacity : defaultEdgeWearOpacity,
    };
  }
  return patchSurfaceField(key, value);
};

export const clearSurfaceField = <K extends keyof SurfaceOptions>(
  key: K,
): SurfaceEditorPatch => ({ [key]: undefined } as SurfaceEditorPatch);

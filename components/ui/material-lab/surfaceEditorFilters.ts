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
}

export type SurfaceEditorPatch = Partial<{
  [K in keyof SurfaceOptions]: SurfaceOptions[K] | undefined;
}>;

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

  return surfaceFieldDefinitions.filter((definition) => (
    definition.control !== 'none'
    && definition.editMode !== 'renderer-internal'
    && modeAllows(definition, options.mode)
    && surfaceFieldAllowedByCapabilities(definition, capabilities)
  ));
};

export const patchSurfaceField = <K extends keyof SurfaceOptions>(
  key: K,
  value: SurfaceOptions[K],
): SurfaceEditorPatch => ({ [key]: value } as SurfaceEditorPatch);

export const clearSurfaceField = <K extends keyof SurfaceOptions>(
  key: K,
): SurfaceEditorPatch => ({ [key]: undefined } as SurfaceEditorPatch);

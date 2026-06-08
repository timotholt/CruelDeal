import {
  cloneMaterialRecipe,
  sanitizeMaterialRecipe,
  type MaterialRecipe,
} from '../../ui/material-lab';
import type { MainPartId } from './mainMaterialInteractionModel';

export interface MaterialPreset {
  id: string;
  name: string;
  recipe: MaterialRecipe;
}

export type MaterialPresetsByPart = Record<MainPartId, MaterialPreset[]>;
export type MaterialPresetIdsByPart = Record<MainPartId, string>;
export type MaterialPresetDirtyByPart = Record<MainPartId, boolean>;

export const mainMaterialPresetPartIds: readonly MainPartId[] = [
  'backdrop',
  'topBar',
  'profileButton',
  'currencyButtons',
  'titleBlock',
  'feedCards',
  'toolBar',
  'navBar',
  'navBarContainer',
];

export const createEmptyMaterialPresets = (): MaterialPresetsByPart => (
  Object.fromEntries(mainMaterialPresetPartIds.map((part) => [part, []])) as MaterialPresetsByPart
);

export const createEmptySelectedPresetIds = (): MaterialPresetIdsByPart => (
  Object.fromEntries(mainMaterialPresetPartIds.map((part) => [part, ''])) as MaterialPresetIdsByPart
);

export const createEmptyPresetDirty = (): MaterialPresetDirtyByPart => (
  Object.fromEntries(mainMaterialPresetPartIds.map((part) => [part, false])) as MaterialPresetDirtyByPart
);

export const materialPresetDirty = (
  selectedPresetIds: MaterialPresetIdsByPart,
  dirty: MaterialPresetDirtyByPart,
  part: MainPartId,
) => Boolean(selectedPresetIds[part] && dirty[part]);

export const setSelectedMaterialPresetId = (
  selectedPresetIds: MaterialPresetIdsByPart,
  part: MainPartId,
  id: string,
): MaterialPresetIdsByPart => ({ ...selectedPresetIds, [part]: id });

export const markMaterialPresetDirty = (
  dirty: MaterialPresetDirtyByPart,
  selectedPresetIds: MaterialPresetIdsByPart,
  part: MainPartId,
): MaterialPresetDirtyByPart => (
  selectedPresetIds[part] ? { ...dirty, [part]: true } : dirty
);

export const clearMaterialPresetDirty = (
  dirty: MaterialPresetDirtyByPart,
  part: MainPartId,
): MaterialPresetDirtyByPart => ({ ...dirty, [part]: false });

export const createMaterialPreset = (
  id: string,
  name: string,
  recipe: MaterialRecipe,
): MaterialPreset => ({
  id,
  name,
  recipe: cloneMaterialRecipe(recipe),
});

export const addMaterialPreset = (
  presets: MaterialPresetsByPart,
  part: MainPartId,
  preset: MaterialPreset,
): MaterialPresetsByPart => ({
  ...presets,
  [part]: [...presets[part], preset],
});

export const updateMaterialPresetRecipe = (
  presets: MaterialPresetsByPart,
  part: MainPartId,
  id: string,
  recipe: MaterialRecipe,
): MaterialPresetsByPart => ({
  ...presets,
  [part]: presets[part].map((preset) => (
    preset.id === id ? { ...preset, recipe: cloneMaterialRecipe(recipe) } : preset
  )),
});

export const deleteMaterialPreset = (
  presets: MaterialPresetsByPart,
  part: MainPartId,
  id: string,
): MaterialPresetsByPart => ({
  ...presets,
  [part]: presets[part].filter((preset) => preset.id !== id),
});

export interface SanitizeMaterialPresetsOptions {
  labelForPart: (part: MainPartId) => string;
  defaultSurfaceForPart: (part: MainPartId) => MaterialRecipe;
}

export const sanitizeMaterialPresets = (
  value: unknown,
  options: SanitizeMaterialPresetsOptions,
): MaterialPresetsByPart => {
  const input = typeof value === 'object' && value !== null ? value as Partial<Record<MainPartId, unknown>> : {};
  const empty = createEmptyMaterialPresets();
  mainMaterialPresetPartIds.forEach((part) => {
    const rawPresets = Array.isArray(input[part]) ? input[part] as unknown[] : [];
    empty[part] = rawPresets
      .map((preset, index): MaterialPreset | null => {
        if (typeof preset !== 'object' || preset === null) return null;
        const raw = preset as Partial<MaterialPreset>;
        const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `${part}-${index}`;
        const label = options.labelForPart(part);
        const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `${label} Preset ${index + 1}`;
        return {
          id,
          name,
          recipe: sanitizeMaterialRecipe(raw.recipe, options.defaultSurfaceForPart(part)),
        };
      })
      .filter((preset): preset is MaterialPreset => !!preset);
  });
  return empty;
};

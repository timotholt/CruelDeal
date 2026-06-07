import { serializeEditorOutput } from '../ui/editor-output';

export const materialLabRecipeOutputMode = 'material-recipe' as const;

export const createMaterialLabRecipeJsonReadout = (recipe: unknown): string => (
  serializeEditorOutput(materialLabRecipeOutputMode, recipe) || '{}\n'
);

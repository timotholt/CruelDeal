import * as v from 'valibot';
import type { GameCmsContent } from '../game-ui/gameCmsSchema';
import { validateGameCmsContent } from '../game-ui/gameCmsSchema';
import type { GameUiPlacements } from '../game-ui/gamePlacementSchema';
import { validateGameUiPlacements } from '../game-ui/gamePlacementSchema';
import type { GameUiTheme } from '../game-ui/gameUiThemeSchema';
import { validateGameUiTheme } from '../game-ui/gameUiThemeSchema';
import { createMaterialRecipe } from '../material-lab/MaterialRecipeDefaults';
import type { MaterialRecipe } from '../material-lab/MaterialRecipeTypes';
import { sanitizeMaterialRecipe } from '../material-lab/MaterialRecipeValidate';
import type { SurfaceOptions } from '../material-lab/surfaceSchema';
import { surfaceStatesSchema, validateSurfaceOptions } from '../material-lab/surfaceValidate';
import type { UiNodePayload, UiSurfaceStatesPayload } from '../material-lab/uiNodeValidate';
import { validateUiNode } from '../material-lab/uiNodeValidate';

export interface EditorOutputValueByMode {
  'surface-options': SurfaceOptions;
  'surface-states': UiSurfaceStatesPayload;
  'material-recipe': MaterialRecipe;
  'ui-node': UiNodePayload;
  'game-ui-theme': GameUiTheme;
  'game-cms-content': GameCmsContent;
  'game-ui-placements': GameUiPlacements;
}

export type EditorOutputModeId = keyof EditorOutputValueByMode;
export type EditorOutputFamily = 'surface' | 'legacy-material' | 'ui-node' | 'game-ui';
export type EditorOutputValidationKind = 'sanitize' | 'strict-nullable';

export interface EditorOutputModeDefinition<M extends EditorOutputModeId = EditorOutputModeId> {
  id: M;
  family: EditorOutputFamily;
  label: string;
  description: string;
  validation: EditorOutputValidationKind;
  fileExtension: 'json';
  validate: (input: unknown) => EditorOutputValueByMode[M] | null;
}

export type EditorOutputValidationResult<M extends EditorOutputModeId = EditorOutputModeId> =
  | {
    ok: true;
    mode: M;
    value: EditorOutputValueByMode[M];
  }
  | {
    ok: false;
    mode: M;
    value: null;
  };

const validateSurfaceStates = (input: unknown): UiSurfaceStatesPayload | null => {
  const result = v.safeParse(surfaceStatesSchema, input);
  if (!result.success) return null;
  return (result.output ?? {}) as UiSurfaceStatesPayload;
};

const definitions = [
  {
    id: 'surface-options',
    family: 'surface',
    label: 'Surface Options',
    description: 'Single resolved surface contract consumed by MaterialSurfaceHost and product components.',
    validation: 'sanitize',
    fileExtension: 'json',
    validate: (input: unknown) => validateSurfaceOptions(input, 'editor-output.surface-options'),
  },
  {
    id: 'surface-states',
    family: 'surface',
    label: 'Surface States',
    description: 'Sparse hover, pressed, and active overlays that inherit from base SurfaceOptions.',
    validation: 'strict-nullable',
    fileExtension: 'json',
    validate: validateSurfaceStates,
  },
  {
    id: 'material-recipe',
    family: 'legacy-material',
    label: 'Material Recipe',
    description: 'Legacy material-lab recipe shape used by current material preview tooling.',
    validation: 'sanitize',
    fileExtension: 'json',
    validate: (input: unknown) => sanitizeMaterialRecipe(input, createMaterialRecipe()),
  },
  {
    id: 'ui-node',
    family: 'ui-node',
    label: 'UiNode Payload',
    description: 'Server-driven UI node tree with layout, content bindings, actions, surfaces, and children.',
    validation: 'strict-nullable',
    fileExtension: 'json',
    validate: (input: unknown) => validateUiNode(input, 'editor-output.ui-node'),
  },
  {
    id: 'game-ui-theme',
    family: 'game-ui',
    label: 'Game UI Theme',
    description: 'Skinnable game UI theme tokens, surface recipes, text styles, and component skins.',
    validation: 'strict-nullable',
    fileExtension: 'json',
    validate: (input: unknown) => validateGameUiTheme(input, 'editor-output.game-ui-theme'),
  },
  {
    id: 'game-cms-content',
    family: 'game-ui',
    label: 'Game CMS Content',
    description: 'Content payload for profile, resources, navigation, promos, news, store offers, missions, and decks.',
    validation: 'strict-nullable',
    fileExtension: 'json',
    validate: (input: unknown) => validateGameCmsContent(input, 'editor-output.game-cms-content'),
  },
  {
    id: 'game-ui-placements',
    family: 'game-ui',
    label: 'Game UI Placements',
    description: 'Placement choices that bind CMS content ids into shell, home, and store regions.',
    validation: 'strict-nullable',
    fileExtension: 'json',
    validate: (input: unknown) => validateGameUiPlacements(input, 'editor-output.game-ui-placements'),
  },
] as const satisfies readonly EditorOutputModeDefinition[];

export const editorOutputModes = definitions;

export const editorOutputModeIds = editorOutputModes.map((mode) => mode.id) as readonly EditorOutputModeId[];

export const editorOutputRegistryById = Object.fromEntries(
  editorOutputModes.map((mode) => [mode.id, mode]),
) as {
  [M in EditorOutputModeId]: EditorOutputModeDefinition<M>;
};

export const getEditorOutputModeDefinition = <M extends EditorOutputModeId>(
  mode: M,
): EditorOutputModeDefinition<M> => editorOutputRegistryById[mode];

export const validateEditorOutput = <M extends EditorOutputModeId>(
  mode: M,
  input: unknown,
): EditorOutputValidationResult<M> => {
  const value = getEditorOutputModeDefinition(mode).validate(input);
  if (value === null) return { ok: false, mode, value: null };
  return { ok: true, mode, value };
};

export const serializeEditorOutput = <M extends EditorOutputModeId>(
  mode: M,
  input: unknown,
): string | null => {
  const result = validateEditorOutput(mode, input);
  if (!result.ok) return null;
  return `${JSON.stringify(result.value, null, 2)}\n`;
};

import type { MaterialRecipeState } from '../../ui/material-lab';

export type MainPartId =
  | 'backdrop'
  | 'topBar'
  | 'profileButton'
  | 'currencyButtons'
  | 'titleBlock'
  | 'feedCards'
  | 'toolBar'
  | 'navBar'
  | 'navBarContainer';

export type InteractionRole = 'static' | 'momentary' | 'selectable' | 'disclosure';
export type PreviewInteractionMode = 'selected-only' | 'all-on-screen';
export type PreviewTargetRole = InteractionRole | 'container' | 'text';
export type PreviewStatesByPart = Record<MainPartId, MaterialRecipeState>;

export interface PreviewInteractionSnapshot {
  mode: PreviewInteractionMode;
  selectedTargetId: string;
  forcePreview: boolean;
  forcedState: MaterialRecipeState;
  hoveredTargetId: string | null;
  pressedTargetId: string | null;
  focusedTargetId: string | null;
  activeTargetIds: ReadonlySet<string>;
}

export const interactionRoles: Record<MainPartId, InteractionRole> = {
  backdrop: 'static',
  topBar: 'static',
  profileButton: 'disclosure',
  currencyButtons: 'momentary',
  titleBlock: 'static',
  feedCards: 'static',
  toolBar: 'momentary',
  navBar: 'selectable',
  navBarContainer: 'static',
};

export const interactionRoleLabels: Record<InteractionRole, string> = {
  static: 'Static',
  momentary: 'Momentary',
  selectable: 'Selectable',
  disclosure: 'Disclosure',
};

export const interactionStateOptions: Record<InteractionRole, readonly MaterialRecipeState[]> = {
  static: ['rest'],
  momentary: ['rest', 'hover', 'pressed'],
  selectable: ['rest', 'hover', 'active', 'pressed'],
  disclosure: ['rest', 'hover', 'active', 'pressed'],
};

export const interactionStateLabels: Record<InteractionRole, Partial<Record<MaterialRecipeState, string>>> = {
  static: { rest: 'Rest' },
  momentary: { rest: 'Rest', hover: 'Hover', pressed: 'Pressed' },
  selectable: { rest: 'Rest', hover: 'Hover', active: 'Active', pressed: 'Pressed' },
  disclosure: { rest: 'Rest', hover: 'Hover', active: 'Open', pressed: 'Pressed' },
};

export const resolvePreviewVisualState = (args: {
  targetId: string;
  role: PreviewTargetRole;
  snapshot: PreviewInteractionSnapshot;
  fallbackState: MaterialRecipeState;
}): MaterialRecipeState => {
  const { targetId, role, snapshot, fallbackState } = args;
  const isSelected = snapshot.selectedTargetId === targetId;
  const isEligible = snapshot.mode === 'all-on-screen' || isSelected;
  if (snapshot.forcePreview && isSelected) return snapshot.forcedState;
  if (!isEligible) return fallbackState;
  if (role === 'static' || role === 'container' || role === 'text') return fallbackState;
  if (snapshot.pressedTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'pressed';
  if (snapshot.activeTargetIds.has(targetId) && role === 'selectable') return 'active';
  if (snapshot.hoveredTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'hover';
  if (snapshot.focusedTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'hover';
  return fallbackState;
};

export const defaultPreviewStateForRole = (role: InteractionRole): MaterialRecipeState => (
  role === 'selectable' ? 'active' : 'rest'
);

export const playerFacingPreviewStateForRole = (role: InteractionRole): MaterialRecipeState => (
  role === 'selectable' ? 'active' : 'rest'
);

export const stateOptionsForPart = (part: MainPartId): readonly MaterialRecipeState[] => (
  interactionStateOptions[interactionRoles[part]]
);

export const coercePreviewStateForPart = (part: MainPartId, state: MaterialRecipeState): MaterialRecipeState => {
  const options = stateOptionsForPart(part);
  return options.includes(state) ? state : defaultPreviewStateForRole(interactionRoles[part]);
};

export const createDefaultPreviewStates = (): PreviewStatesByPart => ({
  backdrop: defaultPreviewStateForRole(interactionRoles.backdrop),
  topBar: defaultPreviewStateForRole(interactionRoles.topBar),
  profileButton: defaultPreviewStateForRole(interactionRoles.profileButton),
  currencyButtons: defaultPreviewStateForRole(interactionRoles.currencyButtons),
  titleBlock: defaultPreviewStateForRole(interactionRoles.titleBlock),
  feedCards: defaultPreviewStateForRole(interactionRoles.feedCards),
  toolBar: defaultPreviewStateForRole(interactionRoles.toolBar),
  navBar: defaultPreviewStateForRole(interactionRoles.navBar),
  navBarContainer: defaultPreviewStateForRole(interactionRoles.navBarContainer),
});


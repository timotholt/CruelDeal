import type { MainPartId } from './mainMaterialInteractionModel';
import {
  feedCardMaterialTargetPrefix,
  navMaterialTargetPrefix,
  toolbarMaterialTargetPrefix,
  topBarMaterialTargetPrefix,
  topBarProfileTargetId,
  type FeedMaterialTargetId,
  type NavMaterialTargetId,
  type ToolbarMaterialTargetId,
  type TopBarMaterialTargetId,
} from './materialTargetIds';

export type SelectionOverlayMode = 'off' | 'flash' | 'persistent';
export type MainWorkbenchPartId =
  | MainPartId
  | FeedMaterialTargetId
  | TopBarMaterialTargetId
  | ToolbarMaterialTargetId
  | NavMaterialTargetId;

export const selectionOverlayModes: readonly SelectionOverlayMode[] = ['off', 'flash', 'persistent'];

export const selectionOverlayLabels: Record<SelectionOverlayMode, string> = {
  off: 'Off',
  flash: 'Flash',
  persistent: 'Persistent',
};

export interface SelectedWorkbenchPartArgs {
  selectedPart: MainPartId;
  selectedFeedTargetId: FeedMaterialTargetId;
  selectedTopBarTargetId: TopBarMaterialTargetId | null;
  selectedToolbarTargetId: ToolbarMaterialTargetId | null;
  selectedNavTargetId: NavMaterialTargetId | null;
}

export const selectedWorkbenchPartId = (args: SelectedWorkbenchPartArgs): MainWorkbenchPartId => {
  if (args.selectedPart === 'feedCards') return args.selectedFeedTargetId;
  if (
    (args.selectedPart === 'profileButton' || args.selectedPart === 'currencyButtons')
    && args.selectedTopBarTargetId
  ) {
    return args.selectedTopBarTargetId;
  }
  if (args.selectedPart === 'toolBar' && args.selectedToolbarTargetId) return args.selectedToolbarTargetId;
  if (args.selectedPart === 'navBar' && args.selectedNavTargetId) return args.selectedNavTargetId;
  return args.selectedPart;
};

export interface WorkbenchSelectionRoute {
  selectedPart: MainPartId;
  feedTargetId?: FeedMaterialTargetId;
  topBarTargetId?: TopBarMaterialTargetId | null;
  toolbarTargetId?: ToolbarMaterialTargetId | null;
  navTargetId?: NavMaterialTargetId | null;
}

export const workbenchSelectionRoute = (part: MainWorkbenchPartId): WorkbenchSelectionRoute => {
  if (part.startsWith(feedCardMaterialTargetPrefix)) {
    return { selectedPart: 'feedCards', feedTargetId: part as FeedMaterialTargetId };
  }
  if (part === topBarProfileTargetId) {
    return { selectedPart: 'profileButton', topBarTargetId: part };
  }
  if (part.startsWith(`${topBarMaterialTargetPrefix}currency:`)) {
    return { selectedPart: 'currencyButtons', topBarTargetId: part as TopBarMaterialTargetId };
  }
  if (part.startsWith(toolbarMaterialTargetPrefix)) {
    return { selectedPart: 'toolBar', toolbarTargetId: part as ToolbarMaterialTargetId };
  }
  if (part.startsWith(navMaterialTargetPrefix)) {
    return { selectedPart: 'navBar', navTargetId: part as NavMaterialTargetId };
  }
  if (part === 'toolBar') return { selectedPart: part, toolbarTargetId: null };
  if (part === 'topBar') return { selectedPart: part, topBarTargetId: null };
  if (part === 'navBarContainer') return { selectedPart: part, navTargetId: null };
  return { selectedPart: part as MainPartId };
};

export interface SelectionTargetClassArgs {
  selected: boolean;
  overlayMode: SelectionOverlayMode;
  flashActive: boolean;
  flashTick: number;
}

export const selectionTargetClass = (args: SelectionTargetClassArgs): string => {
  if (!args.selected) return '';
  if (args.overlayMode === 'persistent') return 'is-editing-persistent';
  if (args.overlayMode === 'flash' && args.flashActive) {
    return `is-editing-flash is-editing-flash-${args.flashTick % 2 === 0 ? 'a' : 'b'}`;
  }
  return '';
};

import type { MainPartId } from './mainMaterialInteractionModel';
import type {
  FeedMaterialTargetId,
  NavMaterialTargetId,
  ToolbarMaterialTargetId,
  TopBarMaterialTargetId,
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


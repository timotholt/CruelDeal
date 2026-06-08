import type { MaterialWorkbenchPart } from '../../ui/material-lab';
import type { MainPartId } from './mainMaterialInteractionModel';
import {
  navNodeSpecs,
  toolbarNodeSpecs,
  topBarCurrencySpecs,
} from './mainMaterialPreview';
import {
  navItemTargetId,
  toolbarMaterialTargetId,
  topBarCurrencyTargetId,
  topBarProfileTargetId,
} from './materialTargetIds';
import type { MainWorkbenchPartId } from './mainMaterialSelectionModel';

export const mainMaterialPartLabels: Array<MaterialWorkbenchPart<MainPartId>> = [
  { id: 'backdrop', label: 'Backdrop', detail: 'second layer' },
  { id: 'topBar', label: 'Top Bar', detail: 'bar material' },
  { id: 'profileButton', label: 'Profile', detail: 'button material' },
  { id: 'currencyButtons', label: 'Wallet', detail: 'chip material' },
  { id: 'feedCards', label: 'Feed', detail: 'glass cards' },
  { id: 'toolBar', label: 'Tool Bar', detail: 'command buttons' },
  { id: 'navBar', label: 'Nav Tabs', detail: 'bottom tab items' },
  { id: 'navBarContainer', label: 'Nav Container', detail: 'bottom bar panel' },
];

export const mainMaterialPartLabelById = Object.fromEntries(
  mainMaterialPartLabels.map((part) => [part.id, part.label]),
) as Record<MainPartId, string>;

export const createMainMaterialWorkbenchParts = (
  feedWorkbenchParts: Array<MaterialWorkbenchPart<MainWorkbenchPartId>>,
  partLabels: Array<MaterialWorkbenchPart<MainPartId>> = mainMaterialPartLabels,
): Array<MaterialWorkbenchPart<MainWorkbenchPartId>> => (
  partLabels.flatMap((part) => {
    if (part.id === 'feedCards') return feedWorkbenchParts;
    if (part.id === 'topBar') {
      return [
        { ...part, id: 'topBar' as MainWorkbenchPartId, depth: 0 },
        { id: topBarProfileTargetId as MainWorkbenchPartId, label: 'Profile', detail: 'button material', depth: 1 },
        ...topBarCurrencySpecs.map((node) => ({
          id: topBarCurrencyTargetId(node.id) as MainWorkbenchPartId,
          label: node.label,
          detail: 'shared wallet style',
          depth: 1,
        })),
      ];
    }
    if (part.id === 'profileButton' || part.id === 'currencyButtons') return [];
    if (part.id === 'toolBar') {
      return [
        { ...part, id: 'toolBar' as MainWorkbenchPartId, depth: 0 },
        ...toolbarNodeSpecs.map((node) => ({
          id: toolbarMaterialTargetId(node.id) as MainWorkbenchPartId,
          label: node.label,
          detail: 'shared command style',
          depth: 1,
        })),
      ];
    }
    if (part.id === 'navBarContainer') {
      return [
        { ...part, id: 'navBarContainer' as MainWorkbenchPartId, depth: 0 },
        ...navNodeSpecs.map((node, index) => ({
          id: navItemTargetId(index) as MainWorkbenchPartId,
          label: node.label,
          detail: 'shared tab style',
          depth: 1,
        })),
      ];
    }
    if (part.id === 'navBar') return [];
    return [{ ...part, id: part.id as MainWorkbenchPartId }];
  })
);

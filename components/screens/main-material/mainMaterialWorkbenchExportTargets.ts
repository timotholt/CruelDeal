import type { SurfaceRecipes } from './mainMaterialPreview';
import {
  navNodeSpecs,
  toolbarNodeSpecs,
  topBarCurrencySpecs,
} from './mainMaterialPreview';
import type { MainMaterialGenericExportTarget } from './mainMaterialExportPlanner';
import {
  createMainMaterialExportGroupDescriptor,
  type MainMaterialExportGroupDescriptor,
} from './mainMaterialExportGroups';
import {
  navItemTargetId,
  toolbarMaterialTargetId,
  topBarCurrencyTargetId,
  topBarProfileTargetId,
} from './materialTargetIds';

const panelExportTarget = (
  recipe: MainMaterialGenericExportTarget['recipe'],
  className: string,
): MainMaterialGenericExportTarget => ({
  kind: 'panel',
  recipe,
  className,
});

const buttonExportTarget = (
  recipe: MainMaterialGenericExportTarget['recipe'],
  text: string,
  className: string,
): MainMaterialGenericExportTarget => ({
  kind: 'button',
  recipe,
  text,
  className,
});

export const createMainMaterialWorkbenchExportTargets = (
  surfaces: SurfaceRecipes,
): Record<string, MainMaterialGenericExportTarget> => ({
  backdrop: panelExportTarget(surfaces.backdrop, 'main-material-preview-backdrop'),
  topBar: panelExportTarget(surfaces.topBar, 'main-material-topbar-shell'),
  [topBarProfileTargetId]: buttonExportTarget(surfaces.profile, 'Profile', 'main-material-profile-button'),
  ...Object.fromEntries(topBarCurrencySpecs.map((item) => [
    topBarCurrencyTargetId(item.id),
    buttonExportTarget(
      surfaces.currencies,
      item.text,
      `main-material-currency-button main-material-currency-button--${item.id}`,
    ),
  ])),
  toolBar: panelExportTarget(surfaces.toolbar, 'main-material-toolbar-shell'),
  ...Object.fromEntries(toolbarNodeSpecs.map((item) => [
    toolbarMaterialTargetId(item.id),
    buttonExportTarget(
      surfaces.toolbar,
      item.text,
      `main-material-toolbar-button main-material-toolbar-button--${item.variant}`,
    ),
  ])),
  navBarContainer: panelExportTarget(surfaces.navContainer, 'main-material-nav-shell'),
  navBar: panelExportTarget(surfaces.nav, 'main-material-nav-tabs'),
  ...Object.fromEntries(navNodeSpecs.map((item, index) => [
    navItemTargetId(index),
    buttonExportTarget(surfaces.nav, item.text, 'main-material-nav-item'),
  ])),
});

export const createMainMaterialWorkbenchExportGroups = (): Record<string, MainMaterialExportGroupDescriptor> => ({
  backdrop: createMainMaterialExportGroupDescriptor('backdrop'),
  topBar: createMainMaterialExportGroupDescriptor('topBar'),
  [topBarProfileTargetId]: createMainMaterialExportGroupDescriptor(topBarProfileTargetId),
  ...Object.fromEntries(topBarCurrencySpecs.map((item) => {
    const targetId = topBarCurrencyTargetId(item.id);
    return [targetId, createMainMaterialExportGroupDescriptor(targetId)];
  })),
  toolBar: createMainMaterialExportGroupDescriptor('toolBar'),
  ...Object.fromEntries(toolbarNodeSpecs.map((item) => {
    const targetId = toolbarMaterialTargetId(item.id);
    return [targetId, createMainMaterialExportGroupDescriptor(targetId)];
  })),
  navBarContainer: createMainMaterialExportGroupDescriptor('navBarContainer'),
  navBar: createMainMaterialExportGroupDescriptor('navBar'),
  ...Object.fromEntries(navNodeSpecs.map((_item, index) => {
    const targetId = navItemTargetId(index);
    return [targetId, createMainMaterialExportGroupDescriptor(targetId)];
  })),
});

import type { MainPartId } from './mainMaterialInteractionModel';
import type { SurfaceRecipes } from './mainMaterialPreview';

export type MainMaterialSurfaceRecipeKey = keyof SurfaceRecipes;

export type MainMaterialRecipeApplicationTarget =
  | { kind: 'feed-target' }
  | { kind: 'surface'; surfaceKey: MainMaterialSurfaceRecipeKey }
  | { kind: 'none' };

export interface MainMaterialSelectedResetPlan {
  resetBackdrop: boolean;
  resetTitle: boolean;
  resetFeed: boolean;
  resetNav: boolean;
  surfaceKey: MainMaterialSurfaceRecipeKey | null;
}

export const surfaceRecipeKeyForPart = (part: MainPartId): MainMaterialSurfaceRecipeKey | null => {
  if (part === 'backdrop') return 'backdrop';
  if (part === 'topBar') return 'topBar';
  if (part === 'profileButton') return 'profile';
  if (part === 'currencyButtons') return 'currencies';
  if (part === 'feedCards') return 'feed';
  if (part === 'toolBar') return 'toolbar';
  if (part === 'navBar') return 'nav';
  if (part === 'navBarContainer') return 'navContainer';
  return null;
};

export const recipeApplicationTargetForPart = (part: MainPartId): MainMaterialRecipeApplicationTarget => {
  if (part === 'feedCards') return { kind: 'feed-target' };
  const surfaceKey = surfaceRecipeKeyForPart(part);
  return surfaceKey ? { kind: 'surface', surfaceKey } : { kind: 'none' };
};

export const surfaceRecipeForPart = <TRecipe>(
  part: MainPartId,
  surfaces: Record<MainMaterialSurfaceRecipeKey, TRecipe>,
  fallbackKey: MainMaterialSurfaceRecipeKey = 'feed',
) => surfaces[surfaceRecipeKeyForPart(part) ?? fallbackKey];

export const selectedResetPlanForPart = (part: MainPartId): MainMaterialSelectedResetPlan => ({
  resetBackdrop: part === 'backdrop',
  resetTitle: part === 'titleBlock',
  resetFeed: part === 'feedCards',
  resetNav: part === 'navBar',
  surfaceKey: surfaceRecipeKeyForPart(part),
});

export const mainMaterialResetAllPlan = {
  resetBackdrop: true,
  resetTitle: true,
  resetFeed: true,
  resetNav: true,
  resetSurfaces: true,
} as const;

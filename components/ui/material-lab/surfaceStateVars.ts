import type { MaterialRecipeState, MaterialSurfaceStateVars } from './MaterialRecipeTypes';
import type { SurfaceOptions } from './surfaceSchema';
import { surfaceStateStyle } from './surfaceFeatures';
import type { UiSurfaceStatesPayload } from './uiNodeValidate';

type ComputableSurfaceState = Extract<MaterialRecipeState, 'hover' | 'pressed' | 'active'>;

const states: ComputableSurfaceState[] = ['hover', 'pressed', 'active'];

const diffCssVars = (
  base: Record<string, unknown>,
  state: Record<string, unknown>,
): MaterialSurfaceStateVars['cssVars'] => {
  const diff: MaterialSurfaceStateVars['cssVars'] = {};
  for (const [key, value] of Object.entries(state)) {
    if (value === undefined || value === null || value === false) continue;
    if (base[key] === value) continue;
    if (!key.startsWith('--')) continue;
    if (key.endsWith('-base')) continue;
    diff[key] = value as string | number;
  }
  return diff;
};

export const compileSurfaceStateVars = (
  base: SurfaceOptions,
  state: SurfaceOptions,
): MaterialSurfaceStateVars => ({
  cssVars: diffCssVars(
    surfaceStateStyle(base) as Record<string, unknown>,
    surfaceStateStyle(state) as Record<string, unknown>,
  ),
});

/**
 * Convert wire-level state overlays into the stateVars shape consumed by the
 * surface CSS. Overlays are authored as partial SurfaceOptions; this function
 * delegates all rendering math to surfaceStateStyle() and only diffs live CSS
 * vars. Base aliases belong only to rest style emission.
 */
export const computeSurfaceStateVars = (
  base: SurfaceOptions,
  overlays?: UiSurfaceStatesPayload,
): Partial<Record<ComputableSurfaceState, MaterialSurfaceStateVars>> => {
  if (!overlays) return {};
  const baseVars = surfaceStateStyle(base) as Record<string, unknown>;
  const computed: Partial<Record<ComputableSurfaceState, MaterialSurfaceStateVars>> = {};

  for (const state of states) {
    const overlay = overlays[state];
    if (!overlay || Object.keys(overlay).length === 0) continue;
    const stateVars = diffCssVars(
      baseVars,
      surfaceStateStyle({ ...base, ...overlay }) as Record<string, unknown>,
    );
    if (Object.keys(stateVars).length > 0) {
      computed[state] = { cssVars: stateVars };
    }
  }

  return computed;
};

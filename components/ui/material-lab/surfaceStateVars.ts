import type { MaterialRecipeState, MaterialSurfaceStateVars } from './MaterialRecipeTypes';
import type { SurfaceOptions } from './surfaceSchema';
import { surfaceStyle } from './surfaceFeatures';
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
    diff[key] = value as string | number;
  }
  return diff;
};

/**
 * Convert wire-level state overlays into the stateVars shape consumed by the
 * surface CSS. Overlays are authored as partial SurfaceOptions; this function
 * delegates all rendering math to surfaceStyle() and only diffs CSS vars.
 */
export const computeSurfaceStateVars = (
  base: SurfaceOptions,
  overlays?: UiSurfaceStatesPayload,
): Partial<Record<ComputableSurfaceState, MaterialSurfaceStateVars>> => {
  if (!overlays) return {};
  const baseVars = surfaceStyle(base) as Record<string, unknown>;
  const computed: Partial<Record<ComputableSurfaceState, MaterialSurfaceStateVars>> = {};

  for (const state of states) {
    const overlay = overlays[state];
    if (!overlay || Object.keys(overlay).length === 0) continue;
    const stateVars = diffCssVars(
      baseVars,
      surfaceStyle({ ...base, ...overlay }) as Record<string, unknown>,
    );
    if (Object.keys(stateVars).length > 0) {
      computed[state] = { cssVars: stateVars };
    }
  }

  return computed;
};

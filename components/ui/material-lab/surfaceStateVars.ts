import type { MaterialRecipeState, MaterialSurfaceStateVars } from './MaterialRecipeTypes';
import type { SurfaceOptions } from './surfaceSchema';
import { surfaceStyle } from './surfaceFeatures';
import type { UiSurfaceStatesPayload } from './uiNodeValidate';

type ComputableSurfaceState = Extract<MaterialRecipeState, 'hover' | 'pressed' | 'active'>;

const states: ComputableSurfaceState[] = ['hover', 'pressed', 'active'];
const contentOptionKeys = new Set<keyof SurfaceOptions>([
  'contentTone',
  'contentOpacity',
  'iconTone',
  'textFontFamily',
  'textSizeRem',
  'fontWeight',
  'fontStyle',
  'textTransform',
  'letterSpacing',
  'textAlign',
  'textX',
  'textY',
  'textEmboss',
  'contentGlowStrength',
  'iconGlowStrength',
]);

const contentCssVarPrefixes = [
  '--content-',
  '--icon-',
];

const hasContentOverlay = (overlay: Partial<SurfaceOptions>) => (
  Object.keys(overlay).some((key) => contentOptionKeys.has(key as keyof SurfaceOptions))
);

const preserveBaseContentVars = (vars: MaterialSurfaceStateVars['cssVars']) => {
  for (const key of Object.keys(vars)) {
    if (contentCssVarPrefixes.some((prefix) => key.startsWith(prefix))) {
      delete vars[key];
    }
  }
  return vars;
};

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
    if (!hasContentOverlay(overlay)) preserveBaseContentVars(stateVars);
    if (Object.keys(stateVars).length > 0) {
      computed[state] = { cssVars: stateVars };
    }
  }

  return computed;
};

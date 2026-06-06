import assert from 'node:assert/strict';
import {
  createMaterialRecipe,
  createMaterialStateOverlay,
  createMaterialStateOverlays,
  materialRecipeToInteractiveSurfaceProps,
  materialRecipeToSurfaceStateVars,
} from './MaterialRecipeTypes';

const identityContent = {
  contentTone: 'inherit',
  iconTone: 'inherit',
  contentGlowStrength: 0,
  iconGlowStrength: 0,
  contentEmboss: 'inherit',
  fontWeight: 'inherit',
  fontStyle: 'inherit',
  textTransform: 'inherit',
  letterSpacing: null,
} as const;

const noGlow = {
  tone: 'none',
  glowStrength: 0,
  corners: [],
  edgeHighlight: [],
  cornerSize: 16,
} as const;

const noEmission = {
  emission: 'none',
  emissionEdge: 'bottom',
  emissionTone: 'gold',
  emissionStrength: 0,
  emissionLength: 42,
  emissionThickness: 1,
  emissionBlipSize: 12,
} as const;

const lightingOnlyRecipe = createMaterialRecipe({
  contentTone: 'black',
  textEmboss: true,
  lightStrength: 24,
  darkStrength: 36,
  states: createMaterialStateOverlays({
    hover: createMaterialStateOverlay({
      enabled: true,
      surface: {
        tint: 'inherit',
        tintStrength: null,
        borderOpacityBoost: 0,
        lightStrengthBoost: 52,
        darkStrengthBoost: -14,
      },
      glow: noGlow,
      emission: noEmission,
      content: identityContent,
      motion: { translateY: 0, scale: 1 },
    }),
  }),
});

const lightingHover = materialRecipeToSurfaceStateVars(lightingOnlyRecipe, 'hover', 'rest').cssVars;
assert.equal(lightingHover['--light-alpha'], '0.76');
assert.equal(lightingHover['--dark-alpha'], '0.22');
assert.equal(lightingHover['--content-shadow'], undefined);
assert.equal(lightingHover['--content-shadow-base'], undefined);
assert.equal(lightingHover['--content-rgb'], undefined);

const contentChangeRecipe = createMaterialRecipe({
  contentTone: 'white',
  textEmboss: true,
  states: createMaterialStateOverlays({
    active: createMaterialStateOverlay({
      enabled: true,
      content: {
        ...identityContent,
        contentTone: 'black',
      },
    }),
  }),
});

const activeContent = materialRecipeToSurfaceStateVars(contentChangeRecipe, 'active', 'rest').cssVars;
assert.equal(activeContent['--content-rgb'], '23 20 15');
assert.equal(activeContent['--content-shadow'], '0 1px 0 rgb(255 255 255 / 0.38)');
assert.equal(activeContent['--content-shadow-base'], undefined);

const interactive = materialRecipeToInteractiveSurfaceProps(lightingOnlyRecipe, 'rest');
assert.equal(interactive.stateVars.hover.cssVars['--light-alpha'], '0.76');
assert.equal(interactive.stateVars.hover.cssVars['--content-shadow'], undefined);
assert.equal(interactive.stateVars.hover.cssVars['--content-shadow-base'], undefined);

console.log('Material recipe compiler tests passed');

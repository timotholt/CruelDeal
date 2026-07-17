import { SHINY_MATERIALS, shinyCssGradient } from './materials';
import { makeShinyTexture } from './textureRegistry';
import type { ShinyMaterialId } from './types';
import {
  LOCKED_METALLIC_REFLECTION,
  METALLIC_MATERIAL_COLORS,
  METALLIC_REFLECTION_DATA_URL,
} from './reflectionFilm';

let injected = false;
let texturesInjected = false;

export const shinySurfaceStyle = (id: ShinyMaterialId, shiftPx = 60) => ({
  'background-image': `var(--metal-${id}-texture)`,
  'background-size': '180% 180%',
  'background-position': `calc(50% + var(--reflex-gx) * ${shiftPx}px) calc(50% + var(--reflex-gy) * ${shiftPx}px)`,
});

export const publishShinyTextureVars = () => {
  if (texturesInjected || typeof document === 'undefined') return;
  const root = document.documentElement.style;
  (Object.keys(SHINY_MATERIALS) as ShinyMaterialId[]).forEach((id) => {
    const spec = SHINY_MATERIALS[id];
    root.setProperty(`--metal-${id}-texture`, `url(${makeShinyTexture(id, { size: spec.textureSize })})`);
    root.setProperty(`--metal-${id}-texture-sm`, `url(${makeShinyTexture(id, { size: spec.smallTextureSize })})`);
  });
  texturesInjected = true;
};

export const publishShinyCssVars = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;

  if (!injected) {
    (Object.keys(SHINY_MATERIALS) as ShinyMaterialId[]).forEach((id) => {
      const spec = SHINY_MATERIALS[id];
      root.setProperty(`--metal-${id}-gradient`, shinyCssGradient(spec));
      root.setProperty(`--metal-${id}-highlight`, spec.highlight);
    });
    root.setProperty('--metal-gold-base', METALLIC_MATERIAL_COLORS.gold);
    root.setProperty('--metal-silver-base', METALLIC_MATERIAL_COLORS.silver);
    root.setProperty('--metal-bronze-base', METALLIC_MATERIAL_COLORS.bronze);
    root.setProperty('--metal-reflection-map', `url("${METALLIC_REFLECTION_DATA_URL}")`);
    root.setProperty('--metal-reflection-map-width', `${LOCKED_METALLIC_REFLECTION.mapWidthPx}px`);
    root.setProperty('--metal-reflection-map-height', `${LOCKED_METALLIC_REFLECTION.mapHeightPx}px`);
    root.setProperty('--metal-reflection-offset-x', `${LOCKED_METALLIC_REFLECTION.offsetXPx}px`);
    root.setProperty('--metal-reflection-offset-y', `${LOCKED_METALLIC_REFLECTION.offsetYPx}px`);
    root.setProperty('--metal-reflection-travel-x', `${LOCKED_METALLIC_REFLECTION.travelXPx}px`);
    root.setProperty('--metal-reflection-travel-y', `${LOCKED_METALLIC_REFLECTION.travelYPx}px`);
    injected = true;
  }
};

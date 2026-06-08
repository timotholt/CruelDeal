import { SHINY_MATERIALS, shinyCssGradient } from './materials';
import { makeShinyTexture } from './textureRegistry';
import type { ShinyMaterialId } from './types';

let injected = false;

export const shinySurfaceStyle = (id: ShinyMaterialId, shiftPx = 60) => ({
  'background-image': `var(--metal-${id}-texture)`,
  'background-size': '180% 180%',
  'background-position': `calc(50% + var(--reflex-gx) * ${shiftPx}px) calc(50% + var(--reflex-gy) * ${shiftPx}px)`,
});

export const publishShinyTextureVars = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  (Object.keys(SHINY_MATERIALS) as ShinyMaterialId[]).forEach((id) => {
    const spec = SHINY_MATERIALS[id];
    root.setProperty(`--metal-${id}-texture`, `url(${makeShinyTexture(id, { size: spec.textureSize })})`);
    root.setProperty(`--metal-${id}-texture-sm`, `url(${makeShinyTexture(id, { size: spec.smallTextureSize })})`);
  });
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
    injected = true;
  }

  publishShinyTextureVars();
};

publishShinyCssVars();

export const METALLIC_MATERIAL_COLORS = {
  gold: '#d6a338',
  silver: '#bcc2c5',
  bronze: '#a66f35',
} as const;

export type MetallicMaterialId = keyof typeof METALLIC_MATERIAL_COLORS;

export const LOCKED_METALLIC_REFLECTION = {
  pattern: 'frames',
  softness: 9,
  zoom: 1,
  whiteColor: '#fffce5',
  whiteOpacity: 0.52,
  blackOpacity: 0.2,
  mapWidthPx: 367.5,
  mapHeightPx: 330,
  offsetXPx: -14,
  offsetYPx: -10,
  travelXPx: 78,
  travelYPx: 96,
} as const;

const reflectionFilmSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-45 -40 245 220" preserveAspectRatio="none">
  <defs>
    <filter id="soft" filterUnits="userSpaceOnUse" x="-160" y="-160" width="420" height="420">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
    <filter id="tight" filterUnits="userSpaceOnUse" x="-160" y="-160" width="420" height="420">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    <filter id="film" filterUnits="userSpaceOnUse" x="-160" y="-160" width="420" height="420">
      <feGaussianBlur stdDeviation="${LOCKED_METALLIC_REFLECTION.softness}"/>
    </filter>
  </defs>
  <g filter="url(#film)" fill="none">
    <g stroke="#000" opacity="${0.16 + LOCKED_METALLIC_REFLECTION.blackOpacity}">
      <rect x="-46" y="-40" width="226" height="210" rx="2" stroke-width="34" opacity=".5" filter="url(#soft)"/>
      <rect x="-8" y="-4" width="150" height="138" rx="2" stroke-width="18" opacity=".58"/>
    </g>
    <g stroke="${LOCKED_METALLIC_REFLECTION.whiteColor}" opacity="${0.22 + LOCKED_METALLIC_REFLECTION.whiteOpacity * 0.9}">
      <rect x="12" y="14" width="110" height="101" rx="2" stroke-width="12" opacity=".68" filter="url(#tight)"/>
      <rect x="42" y="42" width="50" height="46" rx="1" stroke-width="7" opacity=".7"/>
    </g>
  </g>
</svg>`;

export const METALLIC_REFLECTION_DATA_URL =
  `data:image/svg+xml,${encodeURIComponent(reflectionFilmSvg)}`;

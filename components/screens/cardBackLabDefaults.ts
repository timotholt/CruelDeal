import type {
  CardBackFont,
  CardBackLayerVisibility,
  CardBackLight,
  CardBackMotion,
  CardBackRelief,
  CardBackTypography,
  CardBackVariant,
} from '../game-surfaces/system/card-backs/cardBackTypes';

export const CARD_BACK_LAB_SHARP_FONT = 'local:bundled:sharp' as CardBackFont;
export const CARD_BACK_LAB_SHARP_FONT_URL = '/fonts/card-back-authoring/Sharp.ttf';

export interface CardBackLabFavoriteDefaults {
  variant: CardBackVariant;
  font: CardBackFont;
  emblemFont: CardBackFont;
  motion: CardBackMotion;
  showMask: boolean;
  caption: string;
  emblem: string;
  microTextA: string;
  microTextB: string;
  layers: CardBackLayerVisibility;
  light: CardBackLight;
  relief: CardBackRelief;
  typography: CardBackTypography;
}

/** The approved authoring baseline. This does not change the game's runtime card-back contract. */
export const CARD_BACK_LAB_FAVORITE_DEFAULTS: CardBackLabFavoriteDefaults = {
  variant: 'onyx',
  font: CARD_BACK_LAB_SHARP_FONT,
  emblemFont: CARD_BACK_LAB_SHARP_FONT,
  motion: 'dynamic',
  showMask: false,
  caption: 'Cruel Comp',
  emblem: 'cc',
  microTextA: 'Cruel Company',
  microTextB: 'V 1.00',
  layers: {
    substrate: true,
    grooves: true,
    structuralGold: true,
    identity: true,
    finish: true,
    keyLight: true,
    reflection: true,
  },
  light: {
    color: '#ffffff',
    ambient: 1.2,
    x: 0.9,
    y: 0.11,
    height: 0.53,
    intensity: 1.32,
    falloff: 20,
    shadowSoftness: 20,
  },
  relief: {
    outerBorderWidth: 48,
    railWidth: 7,
    hexWidth: 40,
    grooveWidth: 30,
    bevelSoftness: 8.5,
    goldHeight: 0.175,
    hexHeight: 0.4,
    identityHeight: 0.3,
    grooveDepth: 0.12,
    curveRadius: 18,
  },
  typography: {
    caption: { size: 38, spacing: 0, x: 5, y: 12 },
    emblem: { size: 136, spacing: 5, x: 1, y: -22 },
  },
};

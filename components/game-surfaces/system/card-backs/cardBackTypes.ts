import type { Component } from 'solid-js';

export type CardBackVariant = 'onyx' | 'ivory';
export type CardBackMotion = 'dynamic' | 'static' | 'off';
export type CardBackBundledFont = 'industrial' | 'technical' | 'grotesk' | 'monospace' | 'classic';
export type CardBackFont = CardBackBundledFont | `local:${string}`;

export interface CardBackLight {
  color: string;
  ambient: number;
  x: number;
  y: number;
  height: number;
  intensity: number;
  falloff: number;
  shadowSoftness: number;
}

export interface CardBackRelief {
  outerBorderWidth: number;
  railWidth: number;
  hexWidth: number;
  grooveWidth: number;
  bevelSoftness: number;
  goldHeight: number;
  hexHeight: number;
  identityHeight: number;
  grooveDepth: number;
  curveRadius: number;
}

export interface CardBackTextPlacement {
  size: number;
  spacing: number;
  x: number;
  y: number;
}

export interface CardBackTypography {
  caption: CardBackTextPlacement;
  emblem: CardBackTextPlacement;
}

export const DEFAULT_CARD_BACK_TYPOGRAPHY: CardBackTypography = {
  caption: { size: 118, spacing: 0, x: 0, y: 0 },
  emblem: { size: 176, spacing: 0, x: 0, y: 0 },
};

export interface CardBackLayerVisibility {
  substrate: boolean;
  grooves: boolean;
  structuralGold: boolean;
  identity: boolean;
  finish: boolean;
  keyLight: boolean;
  reflection: boolean;
}

export interface CardBackCopy {
  caption: string;
  emblem: string;
  microTextA: string;
  microTextB: string;
}

export interface CardBackArtworkProps extends CardBackCopy {
  variant: CardBackVariant;
  font: CardBackFont;
  emblemFont: CardBackFont;
  layers: CardBackLayerVisibility;
  relief: CardBackRelief;
  typography: CardBackTypography;
  class?: string;
  title?: string;
  ref?: (element: SVGSVGElement) => void;
}

export interface CardBackReflectionProps extends CardBackCopy {
  font: CardBackFont;
  emblemFont: CardBackFont;
  layers: CardBackLayerVisibility;
  relief: CardBackRelief;
  typography: CardBackTypography;
  class?: string;
}

export interface CardBackSurfaceProps extends CardBackCopy {
  variant: CardBackVariant;
  font: CardBackFont;
  emblemFont: CardBackFont;
  layers: CardBackLayerVisibility;
  light: CardBackLight;
  relief: CardBackRelief;
  typography: CardBackTypography;
  class?: string;
}

export interface CardBackDesign {
  id: string;
  defaultCopy: CardBackCopy;
  Surface?: Component<CardBackSurfaceProps>;
  Artwork: Component<CardBackArtworkProps>;
  Finish?: Component<CardBackReflectionProps>;
  Reflection: Component<CardBackReflectionProps>;
}

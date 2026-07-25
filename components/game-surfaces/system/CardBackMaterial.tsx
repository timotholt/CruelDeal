import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { CRUEL_COMPANY_CARD_BACK_DESIGN } from './card-backs/CruelCompanyCardBackDesign';
import type {
  CardBackDesign,
  CardBackLight,
  CardBackRelief,
  CardBackLayerVisibility,
  CardBackMotion,
  CardBackVariant,
  CardBackFont,
  CardBackTypography,
} from './card-backs/cardBackTypes';
import { DEFAULT_CARD_BACK_TYPOGRAPHY } from './card-backs/cardBackTypes';
import '../../../src/styles/card-back-material.css';

export type { CardBackFont, CardBackMotion, CardBackVariant } from './card-backs/cardBackTypes';

export const DEFAULT_CARD_BACK_FONT: CardBackFont = 'industrial';
export const DEFAULT_CARD_BACK_EMBLEM_FONT: CardBackFont = 'grotesk';

export const DEFAULT_CARD_BACK_LAYERS: CardBackLayerVisibility = {
  substrate: true,
  grooves: true,
  structuralGold: true,
  identity: true,
  finish: true,
  keyLight: true,
  reflection: true,
};

export const DEFAULT_CARD_BACK_LIGHT: CardBackLight = {
  color: '#ffffff',
  ambient: 0.58,
  x: 0.88,
  y: 0.08,
  height: 0.62,
  intensity: 1,
  falloff: 6,
  shadowSoftness: 3.8,
};

export const DEFAULT_CARD_BACK_RELIEF: CardBackRelief = {
  outerBorderWidth: 24,
  railWidth: 18,
  hexWidth: 24,
  grooveWidth: 24,
  bevelSoftness: 7,
  goldHeight: 0.11,
  hexHeight: 0.18,
  identityHeight: 0.18,
  grooveDepth: 0.065,
  curveRadius: 0,
};

export { DEFAULT_CARD_BACK_TYPOGRAPHY } from './card-backs/cardBackTypes';

export interface CardBackMaterialProps {
  variant?: CardBackVariant;
  font?: CardBackFont;
  emblemFont?: CardBackFont;
  motion?: CardBackMotion;
  design?: CardBackDesign;
  caption?: string;
  emblem?: string;
  microTextA?: string;
  microTextB?: string;
  layers?: Partial<CardBackLayerVisibility>;
  light?: Partial<CardBackLight>;
  relief?: Partial<CardBackRelief>;
  typography?: {
    caption?: Partial<CardBackTypography['caption']>;
    emblem?: Partial<CardBackTypography['emblem']>;
  };
  renderSurface?: boolean;
  artworkRef?: (element: SVGSVGElement) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const DEFAULT_CARD_BACK_COPY = CRUEL_COMPANY_CARD_BACK_DESIGN.defaultCopy;

/**
 * Production-shaped card-back material. The artwork and its reflection mask
 * share one vector geometry, so authored gold and responsive light cannot
 * drift apart.
 */
export const CardBackMaterial = (props: CardBackMaterialProps) => {
  const design = () => props.design ?? CRUEL_COMPANY_CARD_BACK_DESIGN;
  const renderSurface = () => props.renderSurface ?? true;
  const variant = () => props.variant ?? 'onyx';
  const font = () => props.font ?? DEFAULT_CARD_BACK_FONT;
  const emblemFont = () => props.emblemFont ?? DEFAULT_CARD_BACK_EMBLEM_FONT;
  const motion = () => props.motion ?? 'static';
  const caption = () => props.caption ?? design().defaultCopy.caption;
  const emblem = () => props.emblem ?? design().defaultCopy.emblem;
  const microTextA = () => props.microTextA ?? design().defaultCopy.microTextA;
  const microTextB = () => props.microTextB ?? design().defaultCopy.microTextB;
  const layers = (): CardBackLayerVisibility => ({
    ...DEFAULT_CARD_BACK_LAYERS,
    ...props.layers,
  });
  const light = (): CardBackLight => ({
    ...DEFAULT_CARD_BACK_LIGHT,
    ...props.light,
  });
  const relief = (): CardBackRelief => ({
    ...DEFAULT_CARD_BACK_RELIEF,
    ...props.relief,
  });
  const typography = (): CardBackTypography => ({
    caption: { ...DEFAULT_CARD_BACK_TYPOGRAPHY.caption, ...props.typography?.caption },
    emblem: { ...DEFAULT_CARD_BACK_TYPOGRAPHY.emblem, ...props.typography?.emblem },
  });

  return (
    <div
      class={`card-back-material${motion() === 'dynamic' ? ' metal-surface-gold' : ''}${props.class ? ` ${props.class}` : ''}`}
      data-card-back-design={design().id}
      data-card-back-variant={variant()}
      data-card-back-motion={motion()}
      style={props.style}
      aria-hidden="true"
    >
      {design().Surface && renderSurface() ? (
        <Dynamic
          component={design().Surface}
          class="card-back-material__surface"
          variant={variant()}
          font={font()}
          emblemFont={emblemFont()}
          layers={layers()}
          light={light()}
          relief={relief()}
          typography={typography()}
          caption={caption()}
          emblem={emblem()}
          microTextA={microTextA()}
          microTextB={microTextB()}
        />
      ) : null}
      <Dynamic
        component={design().Artwork}
        ref={props.artworkRef}
        class="card-back-material__base"
        variant={variant()}
        font={font()}
        emblemFont={emblemFont()}
        caption={caption()}
        emblem={emblem()}
        microTextA={microTextA()}
        microTextB={microTextB()}
        layers={layers()}
        relief={relief()}
        typography={typography()}
      />
      {design().Finish && layers().finish ? (
        <Dynamic
          component={design().Finish}
          class="card-back-material__gold-finish"
          caption={caption()}
          font={font()}
          emblemFont={emblemFont()}
          emblem={emblem()}
          microTextA={microTextA()}
          microTextB={microTextB()}
          layers={layers()}
          relief={relief()}
          typography={typography()}
        />
      ) : null}
      {layers().keyLight && (!design().Surface || !renderSurface()) ? <div class="card-back-material__key-light" /> : null}
      {layers().reflection ? (
        <Dynamic
          component={design().Reflection}
          caption={caption()}
          font={font()}
          emblemFont={emblemFont()}
          emblem={emblem()}
          microTextA={microTextA()}
          microTextB={microTextB()}
          layers={layers()}
          relief={relief()}
          typography={typography()}
          class="card-back-material__reflection"
        />
      ) : null}
    </div>
  );
};

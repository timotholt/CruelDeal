import type { JSX } from 'solid-js';
import '../../../src/styles/card-back-material.css';

export type CardBackVariant = 'onyx' | 'ivory';
export type CardBackMotion = 'dynamic' | 'static' | 'off';

export interface CardBackMaterialProps {
  variant?: CardBackVariant;
  motion?: CardBackMotion;
  class?: string;
  style?: JSX.CSSProperties;
}

const CARD_BACK_ART: Record<CardBackVariant, string> = {
  onyx: '/art/card-backs/scg-back-onyx.png',
  ivory: '/art/card-backs/scg-back-ivory.png',
};

/**
 * Production-shaped card-back material. The bitmap owns the design while the
 * shared mask gates only additive light, so a loose mask cannot damage art.
 */
export const CardBackMaterial = (props: CardBackMaterialProps) => {
  const variant = () => props.variant ?? 'onyx';
  const motion = () => props.motion ?? 'static';

  return (
    <div
      class={`card-back-material${props.class ? ` ${props.class}` : ''}`}
      data-card-back-variant={variant()}
      data-card-back-motion={motion()}
      style={props.style}
      aria-hidden="true"
    >
      <img class="card-back-material__base" src={CARD_BACK_ART[variant()]} alt="" draggable={false} />
      <div class="card-back-material__gold-response" />
      <div class="card-back-material__key-light" />
      <div
        class={`card-back-material__reflection${motion() === 'dynamic' ? ' metal-surface-gold' : ''}`}
      />
    </div>
  );
};

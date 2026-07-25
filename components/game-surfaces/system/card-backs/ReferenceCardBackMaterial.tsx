import type { JSX } from 'solid-js';
import type { CardBackMotion } from './cardBackTypes';

interface ReferenceCardBackMaterialProps {
  motion?: CardBackMotion;
  class?: string;
  style?: JSX.CSSProperties;
}

/** The original narrow artwork with the proven four-layer optics stack. */
export const ReferenceCardBackMaterial = (props: ReferenceCardBackMaterialProps) => {
  const motion = () => props.motion ?? 'dynamic';

  return (
    <div
      class={`reference-card-back-material${motion() === 'dynamic' ? ' metal-surface-gold' : ''}${props.class ? ` ${props.class}` : ''}`}
      data-card-back-motion={motion()}
      style={props.style}
      aria-hidden="true"
    >
      <img
        class="reference-card-back-material__base"
        src="/art/card-backs/reference-scg-onyx-original.png"
        alt=""
        draggable={false}
      />
      <div class="reference-card-back-material__gold-response" />
      <div class="reference-card-back-material__key-light" />
      <div class="reference-card-back-material__reflection" />
    </div>
  );
};

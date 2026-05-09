import type { JSX } from 'solid-js';

export type HexBadgeVariant = 'flux' | 'prism' | 'ember' | 'frost' | 'default' | 'custom';
export type HexBadgeGeometry = 'narrow' | 'wide';

/**
 * All base themes are anchored to RED (0deg hue).
 * This ensures hue-rotate provides accurate, non-splitting colors.
 */
const BADGE_VARIANTS = {
  flux: {
    border: 'linear-gradient(135deg, #ff0000, #200000)',
    fill: 'radial-gradient(circle, #ff0000 0%, #050505 70%)',
    delay: '-2s',
  },
  prism: {
    border: 'linear-gradient(135deg, #ff0000, #1a0000)',
    fill: 'radial-gradient(circle, #ff0000 0%, #0a0000 70%)',
    delay: '-4s',
  },
  ember: {
    border: 'linear-gradient(135deg, #ff3300, #401000)',
    fill: 'radial-gradient(circle, #ff4400 0%, #080200 70%)',
    delay: '-3s',
  },
  frost: {
    border: 'linear-gradient(135deg, #ff0000, #100000)',
    fill: 'radial-gradient(circle, #ff0000 0%, #020000 70%)',
    delay: '-1.5s',
  },
  default: {
    border: 'linear-gradient(135deg, #ff0000, #101010)',
    fill: 'radial-gradient(circle, #800000 0%, #050505 70%)',
    delay: '0s',
  },
  custom: {
    border: 'linear-gradient(135deg, #ff0000, #200000)',
    fill: 'radial-gradient(circle, #ff0000 0%, #050505 70%)',
    delay: '0s',
  },
} as const;

export interface HexBadgeProps {
  value: string | number;
  label?: string;
  variant?: HexBadgeVariant;
  size?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  luminosity?: number;
  geometry?: HexBadgeGeometry;
  class?: string;
  className?: string;
  style?: JSX.CSSProperties;
  ariaLabel?: string;
}

export const CardGem = (props: HexBadgeProps) => {
  const theme = () => BADGE_VARIANTS[props.variant ?? 'default'] || BADGE_VARIANTS.default;
  const size = () => props.size ?? 80;
  const displayValue = () => String(props.value);
  const fontSize = () => size() * 0.45;

  return (
    <div
      class={`hex-badge hex-badge--${props.geometry ?? 'narrow'} ${props.className ?? ''} ${props.class ?? ''}`}
      role={props.ariaLabel ? 'img' : undefined}
      aria-label={props.ariaLabel}
      style={{
        '--hex-badge-border': theme().border,
        '--hex-badge-fill': theme().fill,
        '--hex-badge-delay': theme().delay,
        '--hex-badge-size': `${size()}px`,
        opacity: props.opacity ?? 1,
        filter: `hue-rotate(${props.hue ?? 0}deg) saturate(${props.saturation ?? 100}%) brightness(${props.luminosity ?? 100}%) drop-shadow(0 0.625rem 0.9375rem rgba(0, 0, 0, 0.75))`,
        ...props.style,
      }}
    >
      <div class="hex-badge__base" aria-hidden="true" />
      <div class="hex-badge__shape" aria-hidden="true" />
      <div class="hex-badge__value" style={{ 'font-size': `${fontSize()}px` }}>
        {displayValue()}
      </div>
      {props.label && <span class="hex-badge__label">{props.label}</span>}
    </div>
  );
};

export default CardGem;

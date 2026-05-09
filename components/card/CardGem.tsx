import { createUniqueId, type JSX } from 'solid-js';

type GemSize = number | string;

export interface CardGemProps {
  value?: number | string;
  children?: JSX.Element;
  backgroundColor?: string;
  foregroundColor?: string;
  accentColor?: string;
  glowColor?: string;
  font?: string;
  size?: GemSize;
  class?: string;
  style?: JSX.CSSProperties;
  ariaLabel?: string;
}

const DEFAULT_FONT = '"IBM Plex Sans Condensed", "Arial Black", Impact, sans-serif';

const resolveSize = (size: GemSize | undefined): string => {
  if (typeof size === 'number') return `${size}px`;
  return size ?? '3rem';
};

/**
 * Reusable number gem for card stat badges.
 *
 * The component owns only the gem visual. Positioning is intentionally left to
 * callers so the same gem can later be rendered through a portal and placed
 * over card edges without changing the badge art.
 */
export const CardGem = (props: CardGemProps) => {
  const id = createUniqueId();
  const faceGradientId = `card-gem-face-${id}`;
  const bloomGradientId = `card-gem-bloom-${id}`;
  const size = () => resolveSize(props.size);
  const backgroundColor = () => props.backgroundColor ?? '#2563eb';
  const foregroundColor = () => props.foregroundColor ?? '#ffffff';
  const accentColor = () => props.accentColor ?? 'rgba(255,255,255,0.72)';
  const glowColor = () => props.glowColor ?? backgroundColor();
  const font = () => props.font ?? DEFAULT_FONT;
  const label = () => props.ariaLabel ?? (props.value === undefined ? undefined : `${props.value}`);

  return (
    <div
      class={`relative inline-grid place-items-center overflow-visible select-none pointer-events-none ${props.class ?? ''}`}
      role={label() ? 'img' : undefined}
      aria-label={label()}
      style={{
        width: size(),
        height: size(),
        color: foregroundColor(),
        'font-family': font(),
        'font-size': `calc(${size()} * 0.58)`,
        filter: `drop-shadow(0 0 calc(${size()} * 0.2) color-mix(in srgb, ${glowColor()} 72%, transparent)) drop-shadow(0 calc(${size()} * 0.035) calc(${size()} * 0.05) rgba(0,0,0,0.75))`,
        ...props.style,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        class="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={faceGradientId} x1="20" y1="8" x2="82" y2="94" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="rgba(255,255,255,0.74)" />
            <stop offset="0.18" stop-color={backgroundColor()} />
            <stop offset="1" stop-color={backgroundColor()} />
          </linearGradient>
          <radialGradient id={bloomGradientId} cx="28" cy="18" r="78" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="rgba(255,255,255,0.62)" />
            <stop offset="0.36" stop-color={backgroundColor()} stop-opacity="0.76" />
            <stop offset="1" stop-color={backgroundColor()} stop-opacity="0" />
          </radialGradient>
        </defs>

        <path
          d="M29 5 H71 L95 29 V71 L71 95 H29 L5 71 V29 Z"
          fill={backgroundColor()}
          stroke="rgba(0,0,0,0.42)"
          stroke-width="8"
          stroke-linejoin="round"
        />
        <path
          d="M31 9 H69 L91 31 V69 L69 91 H31 L9 69 V31 Z"
          fill={`url(#${faceGradientId})`}
          stroke={accentColor()}
          stroke-width="4"
          stroke-linejoin="round"
        />
        <path
          d="M34 17 H66 L83 34 V66 L66 83 H34 L17 66 V34 Z"
          fill={`url(#${bloomGradientId})`}
          opacity="0.76"
        />
        <path
          d="M24 24 L42 14 H68 L84 31"
          fill="none"
          stroke="rgba(255,255,255,0.64)"
          stroke-width="3"
          stroke-linecap="round"
          opacity="0.82"
        />
        <path
          d="M18 70 L31 83 H67"
          fill="none"
          stroke="rgba(255,255,255,0.38)"
          stroke-width="2.5"
          stroke-linecap="round"
          opacity="0.72"
        />
        <path
          d="M50 13 L59 37 L85 31 L65 50 L85 69 L59 63 L50 87 L41 63 L15 69 L35 50 L15 31 L41 37 Z"
          fill="rgba(255,255,255,0.12)"
        />
      </svg>

      <div
        class="relative z-10 grid h-[72%] w-[72%] place-items-center text-center leading-none"
        style={{
          'font-size': '1em',
          'font-weight': 900,
          'font-style': 'italic',
          'letter-spacing': '0',
          'text-shadow': '0 0.06em 0.04em rgba(0,0,0,0.82), 0 0 0.18em rgba(255,255,255,0.36)',
          'transform': 'translateY(2%)',
        }}
      >
        {props.children ?? props.value}
      </div>
    </div>
  );
};

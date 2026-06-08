import { mergeProps, JSX } from 'solid-js';
import { enableGyro } from './reflex/ReflexController';

/**
 * MotionReflex now hosts only the reusable reflective DOM components. The
 * pointer/tilt source lives in ./reflex/ReflexController, which writes the
 * global direction to :root (--reflex-gx/gy). These components carry the sheen
 * CSS classes and inherit that global var — no per-element JS at all.
 *
 * Controller signals are re-exported here for back-compat with existing imports.
 */
export { sheenEnabled, setSheenEnabled, gyroActive } from './reflex/ReflexController';
export const enableMobileGyroscope = enableGyro;

export type SheenMethod = 'svg' | 'bitmap';
// Pick the fill class: vector gradient (sheen-<type>) or baked bitmap (sheen-baked).
const sheenClass = (method: SheenMethod, type: string) =>
  method === 'bitmap' ? 'sheen-baked' : `sheen-${type}`;

// Reusable Reflective Text Component
export interface ReflectiveTextProps {
  children: string;
  profile?: 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';
  type?: 'linear' | 'radial' | 'box';
  method?: SheenMethod;
  class?: string;
  style?: JSX.CSSProperties;
}

export const ReflectiveText = (rawProps: ReflectiveTextProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    method: 'svg' as const,
    class: '',
    style: {},
  }, rawProps);

  return (
    <span
      class={`sheen-text ${sheenClass(props.method, props.type)} metal-${props.profile} ${props.class}`}
      style={props.style}
    >
      {props.children}
    </span>
  );
};

// Reusable Embossed Reflective Text Component
export const EmbossedReflectiveText = (rawProps: ReflectiveTextProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    method: 'svg' as const,
    class: '',
    style: {},
  }, rawProps);

  return (
    <span
      class={`sheen-text ${sheenClass(props.method, props.type)} metal-${props.profile} embossed-text ${props.class}`}
      style={props.style}
    >
      {props.children}
    </span>
  );
};

// Reflective Progress Bar Component
export interface ReflectiveProgressBarProps {
  value: number; // 0 to 100
  profile?: 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';
  type?: 'linear' | 'radial' | 'box';
  method?: SheenMethod;
  class?: string;
}

export const ReflectiveProgressBar = (rawProps: ReflectiveProgressBarProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    method: 'svg' as const,
    class: '',
  }, rawProps);

  return (
    <div class={`w-full h-4 bg-black/50 rounded-full border border-white/10 overflow-hidden relative shadow-inner ${props.class}`}>
      {/* Dynamic Sheen Bar fill */}
      <div
        class={`h-full sheen-text ${sheenClass(props.method, props.type)} metal-${props.profile} rounded-full transition-all duration-300 relative`}
        style={{
          width: `${Math.max(0, Math.min(100, props.value))}%`,
          "background-clip": "initial",
          "-webkit-background-clip": "initial",
          "color": "transparent",
          "-webkit-text-fill-color": "initial",
          "background-size": props.type === 'box' ? "contain, 200% 200%" : "200% 200%",
        }}
      >
        {/* Volumetric glossy finish overlay */}
        <div class="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/35 rounded-full pointer-events-none" />
      </div>
    </div>
  );
};

// Premium Reflective Button Component
export interface ReflectiveButtonProps {
  onClick?: () => void;
  children: any;
  profile?: 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';
  type?: 'linear' | 'radial' | 'box';
  method?: SheenMethod;
  class?: string;
  disabled?: boolean;
}

export const ReflectiveButton = (rawProps: ReflectiveButtonProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    method: 'svg' as const,
    class: '',
    disabled: false,
  }, rawProps);

  return (
    <button
      onClick={() => !props.disabled && props.onClick?.()}
      disabled={props.disabled}
      class={`
        relative px-6 py-2.5 font-bold uppercase tracking-wider text-black rounded
        transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.97]
        shadow-[0_4px_14px_0_rgba(251,191,36,0.3)] hover:shadow-[0_6px_20px_0_rgba(251,191,36,0.45)]
        border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400
        ${props.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
        ${props.class}
      `}
      style={{
        background: 'none',
        "box-shadow": props.profile === 'gold' || props.profile === 'kan' || props.profile === 'brass'
          ? '0 4px 14px 0 rgba(251, 191, 36, 0.3)'
          : props.profile === 'silver'
            ? '0 4px 14px 0 rgba(148, 163, 184, 0.3)'
            : '0 4px 14px 0 rgba(59, 130, 246, 0.3)',
      }}
    >
      {/* Background with Sheen */}
      <div
        class={`absolute inset-0 sheen-text ${sheenClass(props.method, props.type)} metal-${props.profile} rounded`}
        style={{
          "background-clip": "initial",
          "-webkit-background-clip": "initial",
          "color": "transparent",
          "-webkit-text-fill-color": "initial",
          "background-size": props.type === 'box' ? "contain, 200% 200%" : "200% 200%",
        }}
      />

      {/* Volumetric light shade */}
      <div class="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/40 rounded pointer-events-none" />

      {/* Chiseled inner border highlight */}
      <div class="absolute inset-[1px] border border-white/20 rounded pointer-events-none" />

      {/* Content */}
      <span class="relative z-10 text-shadow-sm font-extrabold text-[#111]">{props.children}</span>
    </button>
  );
};

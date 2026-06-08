import { mergeProps } from 'solid-js';
import type { JSX } from 'solid-js';
import type { SheenMethod, SheenType, ShinyMaterialKey } from '../engine/types';

const sheenClass = (method: SheenMethod, type: SheenType) =>
  method === 'bitmap' ? 'sheen-baked' : `sheen-${type}`;

export interface ReflectiveButtonProps {
  onClick?: () => void;
  children: JSX.Element;
  material?: ShinyMaterialKey;
  profile?: ShinyMaterialKey;
  type?: SheenType;
  method?: SheenMethod;
  class?: string;
  disabled?: boolean;
}

export const ReflectiveButton = (rawProps: ReflectiveButtonProps) => {
  const props = mergeProps({
    material: undefined as ShinyMaterialKey | undefined,
    profile: 'gold' as ShinyMaterialKey,
    type: 'linear' as SheenType,
    method: 'svg' as SheenMethod,
    class: '',
    disabled: false,
  }, rawProps);
  const material = () => props.material ?? props.profile;

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
        'box-shadow': material() === 'gold' || material() === 'kan' || material() === 'brass' || material() === 'bronze'
          ? '0 4px 14px 0 rgba(251, 191, 36, 0.3)'
          : material() === 'silver'
            ? '0 4px 14px 0 rgba(148, 163, 184, 0.3)'
            : '0 4px 14px 0 rgba(59, 130, 246, 0.3)',
      }}
    >
      <div
        class={`absolute inset-0 sheen-text ${sheenClass(props.method, props.type)} metal-${material()} rounded`}
        style={{
          'background-clip': 'initial',
          '-webkit-background-clip': 'initial',
          color: 'transparent',
          '-webkit-text-fill-color': 'initial',
          'background-size': props.type === 'box' ? 'contain, 200% 200%' : '200% 200%',
        }}
      />
      <div class="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/40 rounded pointer-events-none" />
      <div class="absolute inset-[1px] border border-white/20 rounded pointer-events-none" />
      <span class="relative z-10 text-shadow-sm font-extrabold text-[#111]">{props.children}</span>
    </button>
  );
};

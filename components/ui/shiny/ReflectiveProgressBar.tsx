import { mergeProps } from 'solid-js';
import type { SheenMethod, SheenType, ShinyMaterialKey } from './types';

const sheenClass = (method: SheenMethod, type: SheenType) =>
  method === 'bitmap' ? 'sheen-baked' : `sheen-${type}`;

export interface ReflectiveProgressBarProps {
  value: number;
  material?: ShinyMaterialKey;
  profile?: ShinyMaterialKey;
  type?: SheenType;
  method?: SheenMethod;
  class?: string;
}

export const ReflectiveProgressBar = (rawProps: ReflectiveProgressBarProps) => {
  const props = mergeProps({
    material: undefined as ShinyMaterialKey | undefined,
    profile: 'gold' as ShinyMaterialKey,
    type: 'linear' as SheenType,
    method: 'svg' as SheenMethod,
    class: '',
  }, rawProps);
  const material = () => props.material ?? props.profile;

  return (
    <div class={`w-full h-4 bg-black/50 rounded-full border border-white/10 overflow-hidden relative shadow-inner ${props.class}`}>
      <div
        class={`h-full sheen-text ${sheenClass(props.method, props.type)} metal-${material()} rounded-full transition-all duration-300 relative`}
        style={{
          width: `${Math.max(0, Math.min(100, props.value))}%`,
          'background-clip': 'initial',
          '-webkit-background-clip': 'initial',
          color: 'transparent',
          '-webkit-text-fill-color': 'initial',
          'background-size': props.type === 'box' ? 'contain, 200% 200%' : '200% 200%',
        }}
      >
        <div class="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/35 rounded-full pointer-events-none" />
      </div>
    </div>
  );
};

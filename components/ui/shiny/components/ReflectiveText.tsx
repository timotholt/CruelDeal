import { mergeProps } from 'solid-js';
import type { JSX } from 'solid-js';
import type { SheenMethod, SheenType, ShinyMaterialKey } from '../engine/types';

const sheenClass = (method: SheenMethod, type: SheenType) =>
  method === 'bitmap' ? 'sheen-baked' : `sheen-${type}`;

export interface ReflectiveTextProps {
  children: string;
  material?: ShinyMaterialKey;
  profile?: ShinyMaterialKey;
  type?: SheenType;
  method?: SheenMethod;
  class?: string;
  style?: JSX.CSSProperties;
}

export const ReflectiveText = (rawProps: ReflectiveTextProps) => {
  const props = mergeProps({
    material: undefined as ShinyMaterialKey | undefined,
    profile: 'gold' as ShinyMaterialKey,
    type: 'linear' as SheenType,
    method: 'svg' as SheenMethod,
    class: '',
    style: {},
  }, rawProps);
  const material = () => props.material ?? props.profile;

  return (
    <span
      class={`sheen-text ${sheenClass(props.method, props.type)} metal-${material()} ${props.class}`}
      style={props.style}
    >
      {props.children}
    </span>
  );
};

export const EmbossedReflectiveText = (rawProps: ReflectiveTextProps) => {
  const props = mergeProps({
    material: undefined as ShinyMaterialKey | undefined,
    profile: 'gold' as ShinyMaterialKey,
    type: 'linear' as SheenType,
    method: 'svg' as SheenMethod,
    class: '',
    style: {},
  }, rawProps);
  const material = () => props.material ?? props.profile;

  return (
    <span
      class={`sheen-text ${sheenClass(props.method, props.type)} metal-${material()} embossed-text ${props.class}`}
      style={props.style}
    >
      {props.children}
    </span>
  );
};

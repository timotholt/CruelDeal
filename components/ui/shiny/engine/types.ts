import type { Accessor, JSX } from 'solid-js';

export type ShinyMaterialId = 'gold' | 'silver' | 'bronze' | 'kan' | 'credit' | 'mark' | 'engraved';

export interface ShinyStop {
  offset: number;
  color: string;
}

export interface ShinyMaterialDefinition {
  id: ShinyMaterialId;
  displayName: string;
  stops: ShinyStop[];
  highlight: string;
  angle: number;
  textureSize: number;
  smallTextureSize: number;
  grain: number;
  seed: number;
}

export interface ShinyTextureOptions {
  size?: number;
  grain?: number;
  angle?: number;
  seed?: number;
}

export interface ReflexPointer {
  x: number;
  y: number;
  hasPosition: boolean;
  source: 'mouse' | 'gyro' | 'none';
}

export interface ReflexDirection {
  gx: number;
  gy: number;
}

export interface ReflexShift {
  nx: number;
  ny: number;
}

export type ReflexShiftAccessor = Accessor<ReflexShift>;
export type SheenMethod = 'svg' | 'bitmap';
export type SheenType = 'linear' | 'radial' | 'box';

export interface ShinySurfaceProps {
  material?: ShinyMaterialId;
  profile?: ShinyMaterialId;
  type?: SheenType;
  method?: SheenMethod;
  class?: string;
  style?: JSX.CSSProperties;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type RoadClass = 'highway' | 'major' | 'minor' | 'alley';

export interface TensorRoadSegment {
  id: string;
  roadClass: RoadClass;
  points: Vec2[];
  tags: string[];
}

export interface TensorSample {
  pos: Vec2;
  angle: number;
  strength: number;
}

export type TensorFieldKind =
  | 'grid'
  | 'radial'
  | 'coast_following'
  | 'noise'
  | 'attractor'
  | 'repulsor';

export interface TensorFieldConfig {
  id: string;
  kind: TensorFieldKind;
  position?: Vec2;
  angle?: number;
  size?: number;
  decay?: number;
  strength: number;
}

export type TensorPreset =
  | 'organized_city'
  | 'island_city'
  | 'old_downtown'
  | 'beachfront_resort'
  | 'debug_minimal';

export interface TensorGenerationConfig {
  preset?: TensorPreset;
  roadDensity?: { main?: number; major?: number; minor?: number };
  stepSize?: number;
  collisionRadius?: number;
  simplifyTolerance?: number;
  fields?: TensorFieldConfig[];
  clipping?: { enabled?: boolean; boundaryMode?: 'stop' | 'clip' };
  debug?: { exposeTensorField?: boolean; exposeStreamlines?: boolean; exposeRejectedRoads?: boolean };
}

export interface IslandMask {
  outline: Vec2[];
  inset: Vec2[];
  containsPoint(x: number, y: number): boolean;
  containsPolygon(poly: Vec2[], threshold?: number): boolean;
}

export interface TensorField {
  sample(x: number, y: number): TensorSample;
}

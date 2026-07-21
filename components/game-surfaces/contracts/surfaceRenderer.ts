import type { RasterSize, SurfacePoint } from './primitives';

export interface RasterArtifact {
  readonly key: string;
  readonly size: RasterSize;
  readonly bitmap: ImageBitmap;
}

export interface ContentRasterizer<Spec> {
  rasterize(spec: Spec, size: RasterSize): Promise<RasterArtifact>;
}

export interface SurfaceEffectLease {
  cancel(): void;
}

export interface SurfaceInstance<Model, Cue, HitResult> {
  update(model: Model): void;
  playVfx(cue: Cue): SurfaceEffectLease;
  hitTest(point: SurfacePoint): HitResult | null;
  dispose(): void;
}

export interface SurfaceRenderer<Model, Cue, HitResult> {
  mount(host: HTMLElement, model: Model): SurfaceInstance<Model, Cue, HitResult>;
}

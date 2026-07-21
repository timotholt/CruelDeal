import type {
  ContentRasterizer,
  RasterArtifact,
  RasterSize,
} from '../contracts';

export interface RasterCacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly inFlightDedupe: number;
  readonly evictions: number;
  readonly rasterDurationMs: number;
}

export class RasterArtifactCache<Spec extends { readonly cacheKey: string }> {
  private readonly artifacts = new Map<string, RasterArtifact>();
  private readonly inFlight = new Map<string, Promise<RasterArtifact>>();
  private metricHits = 0;
  private metricMisses = 0;
  private metricDedupe = 0;
  private metricEvictions = 0;
  private metricRasterDurationMs = 0;

  constructor(
    private readonly limit: number,
    private readonly size: RasterSize,
    private readonly rasterizer: ContentRasterizer<Spec>,
  ) {}

  get(spec: Spec): Promise<RasterArtifact> {
    const cached = this.artifacts.get(spec.cacheKey);
    if (cached) {
      this.metricHits += 1;
      this.artifacts.delete(spec.cacheKey);
      this.artifacts.set(spec.cacheKey, cached);
      return Promise.resolve(cached);
    }
    const pending = this.inFlight.get(spec.cacheKey);
    if (pending) {
      this.metricDedupe += 1;
      return pending;
    }

    this.metricMisses += 1;
    const startedAt = performance.now();
    const request = this.rasterizer.rasterize(spec, this.size).then((artifact) => {
      this.metricRasterDurationMs += performance.now() - startedAt;
      this.inFlight.delete(spec.cacheKey);
      this.artifacts.set(spec.cacheKey, artifact);
      this.evictIfNeeded();
      return artifact;
    }, (error: unknown) => {
      this.metricRasterDurationMs += performance.now() - startedAt;
      this.inFlight.delete(spec.cacheKey);
      throw error;
    });
    this.inFlight.set(spec.cacheKey, request);
    return request;
  }

  peek(key: string): RasterArtifact | null {
    return this.artifacts.get(key) ?? null;
  }

  get metrics(): RasterCacheMetrics {
    return Object.freeze({
      hits: this.metricHits,
      misses: this.metricMisses,
      inFlightDedupe: this.metricDedupe,
      evictions: this.metricEvictions,
      rasterDurationMs: this.metricRasterDurationMs,
    });
  }

  clear(): void {
    for (const artifact of this.artifacts.values()) artifact.bitmap.close();
    this.artifacts.clear();
    this.inFlight.clear();
    this.metricHits = 0;
    this.metricMisses = 0;
    this.metricDedupe = 0;
    this.metricEvictions = 0;
    this.metricRasterDurationMs = 0;
  }

  private evictIfNeeded(): void {
    while (this.artifacts.size > this.limit) {
      const oldestKey = this.artifacts.keys().next().value as string | undefined;
      if (oldestKey === undefined) return;
      const artifact = this.artifacts.get(oldestKey);
      this.artifacts.delete(oldestKey);
      artifact?.bitmap.close();
      this.metricEvictions += 1;
    }
  }
}

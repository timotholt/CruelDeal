import { describe, expect, it, vi } from 'vitest';
import type { ContentRasterizer, RasterArtifact } from '../contracts';
import { RasterArtifactCache } from './rasterArtifactCache';

interface Spec { readonly cacheKey: string }

const artifact = (key: string): RasterArtifact => ({
  key,
  size: { width: 10, height: 10 },
  bitmap: { close: vi.fn() } as unknown as ImageBitmap,
});

describe('RasterArtifactCache', () => {
  it('deduplicates in-flight work and reuses the immutable artifact', async () => {
    let resolve!: (value: RasterArtifact) => void;
    const rasterize = vi.fn(() => new Promise<RasterArtifact>((done) => { resolve = done; }));
    const cache = new RasterArtifactCache(2, { width: 10, height: 10 }, { rasterize });
    const first = cache.get({ cacheKey: 'one' });
    const second = cache.get({ cacheKey: 'one' });
    resolve(artifact('one'));
    expect(await first).toBe(await second);
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(cache.metrics.inFlightDedupe).toBe(1);
    expect(await cache.get({ cacheKey: 'one' })).toBe(cache.peek('one'));
    expect(cache.metrics.hits).toBe(1);
  });

  it('bounds entries and closes evicted bitmaps', async () => {
    const made: RasterArtifact[] = [];
    const rasterizer: ContentRasterizer<Spec> = {
      rasterize: vi.fn(async (spec) => {
        const value = artifact(spec.cacheKey);
        made.push(value);
        return value;
      }),
    };
    const cache = new RasterArtifactCache(1, { width: 10, height: 10 }, rasterizer);
    await cache.get({ cacheKey: 'one' });
    await cache.get({ cacheKey: 'two' });
    expect(made[0].bitmap.close).toHaveBeenCalledTimes(1);
    expect(cache.peek('one')).toBeNull();
    expect(cache.peek('two')).toBe(made[1]);
    expect(cache.metrics.evictions).toBe(1);
  });
});

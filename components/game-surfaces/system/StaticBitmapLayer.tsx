import { createEffect, createResource, onCleanup, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { RasterArtifact } from '../contracts';

interface StaticBitmapLayerProps {
  readonly cacheKey: string;
  readonly load: () => Promise<RasterArtifact>;
  readonly class: string;
  readonly fallback: JSX.Element;
}

const BitmapCanvas = (props: { artifact: RasterArtifact; class: string }) => {
  let canvas: HTMLCanvasElement | undefined;
  createEffect(() => {
    const target = canvas;
    const artifact = props.artifact;
    if (!target) return;
    target.width = artifact.size.width;
    target.height = artifact.size.height;
    target.getContext('2d')?.drawImage(artifact.bitmap, 0, 0);
  });
  onCleanup(() => {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  });
  return <canvas ref={canvas} class={props.class} aria-hidden="true" />;
};

export const StaticBitmapLayer = (props: StaticBitmapLayerProps) => {
  const [artifact] = createResource(
    () => props.cacheKey,
    async () => {
      if (typeof createImageBitmap !== 'function') return null;
      try {
        return await props.load();
      } catch {
        return null;
      }
    },
  );
  return (
    <Show when={artifact()} keyed fallback={props.fallback}>
      {(value) => <BitmapCanvas artifact={value} class={props.class} />}
    </Show>
  );
};

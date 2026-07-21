import type {
  ContentRasterizer,
  LocationContentSpec,
  RasterArtifact,
  RasterSize,
} from '../contracts';
import {
  canvasContext,
  commitRaster,
  createRasterCanvas,
  drawCover,
  drawFittedText,
  loadVisualAsset,
  waitForFonts,
} from '../system/canvasRaster';

export class LocationContentRasterizer implements ContentRasterizer<LocationContentSpec> {
  async rasterize(spec: LocationContentSpec, size: RasterSize): Promise<RasterArtifact> {
    await waitForFonts();
    const canvas = createRasterCanvas(size);
    const context = canvasContext(canvas);
    context.save();
    context.beginPath();
    context.roundRect(6, 6, size.width - 12, size.height - 12, 44);
    context.clip();

    context.fillStyle = spec.accent;
    context.fillRect(0, 0, size.width, size.height);
    if (spec.artwork) {
      try {
        drawCover(context, await loadVisualAsset(spec.artwork), size.width, size.height);
      } catch {
        // The accent is the deterministic public fallback.
      }
    }
    const shade = context.createLinearGradient(0, 0, 0, size.height);
    shade.addColorStop(0, 'rgba(5, 8, 12, 0.68)');
    shade.addColorStop(0.38, 'rgba(5, 8, 12, 0.28)');
    shade.addColorStop(1, 'rgba(5, 8, 12, 0.72)');
    context.fillStyle = shade;
    context.fillRect(0, 0, size.width, size.height);

    drawFittedText(context, {
      text: spec.name,
      x: 76,
      y: 68,
      width: size.width - 152,
      height: 118,
      maxFontSize: 76,
      minFontSize: 36,
      maxLines: 2,
      fontFamily: '"Unica One", sans-serif',
      fontWeight: 400,
      lineHeight: 1,
      color: '#f6f3e8',
      uppercase: true,
      strokeColor: 'rgba(0, 0, 0, 0.84)',
      strokeWidth: 6,
    });
    drawFittedText(context, {
      text: spec.rulesText,
      x: 76,
      y: 198,
      width: size.width - 152,
      height: 250,
      maxFontSize: 52,
      minFontSize: 28,
      maxLines: 4,
      fontFamily: '"IBM Plex Sans Condensed", sans-serif',
      fontWeight: 600,
      lineHeight: 1.2,
      color: '#f1f4f2',
      strokeColor: 'rgba(0, 0, 0, 0.9)',
      strokeWidth: 5,
    });
    context.restore();
    return commitRaster(spec.cacheKey, size, canvas);
  }
}

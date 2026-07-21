import type {
  CardContentSpec,
  ContentRasterizer,
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

const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const drawRegular = async (
  context: CanvasRenderingContext2D,
  spec: CardContentSpec,
  size: RasterSize,
): Promise<void> => {
  context.save();
  roundedRect(context, 6, 6, size.width - 12, size.height - 12, 46);
  context.clip();
  const background = context.createLinearGradient(0, 0, 0, size.height);
  background.addColorStop(0, '#202b38');
  background.addColorStop(1, '#0d141d');
  context.fillStyle = background;
  context.fillRect(0, 0, size.width, size.height);

  if (spec.artwork) {
    try {
      const image = await loadVisualAsset(spec.artwork);
      drawCover(context, image, size.width, size.height);
      const shade = context.createLinearGradient(0, 0, 0, size.height);
      shade.addColorStop(0, 'rgba(5, 10, 16, 0.08)');
      shade.addColorStop(0.55, 'rgba(5, 10, 16, 0.36)');
      shade.addColorStop(1, 'rgba(5, 10, 16, 0.92)');
      context.fillStyle = shade;
      context.fillRect(0, 0, size.width, size.height);
    } catch {
      // The deterministic accent treatment below is the public fallback.
    }
  }

  context.fillStyle = spec.accent;
  context.globalAlpha = 0.74;
  context.fillRect(38, 174, size.width - 76, 30);
  context.globalAlpha = 1;
  drawFittedText(context, {
    text: spec.name,
    x: 48,
    y: 430,
    width: size.width - 96,
    height: 200,
    maxFontSize: 100,
    minFontSize: 46,
    maxLines: 3,
    fontFamily: '"Unica One", sans-serif',
    fontWeight: 400,
    lineHeight: 0.96,
    color: '#f7f7f4',
    uppercase: true,
    strokeColor: 'rgba(0, 0, 0, 0.7)',
    strokeWidth: 3,
  });
  context.restore();
};

const drawSpell = (
  context: CanvasRenderingContext2D,
  spec: CardContentSpec,
  size: RasterSize,
): void => {
  const base = context.createLinearGradient(0, 330, 0, size.height);
  base.addColorStop(0, '#25203a');
  base.addColorStop(1, '#11101e');
  context.fillStyle = base;
  roundedRect(context, 80, 335, size.width - 160, size.height - 341, 50);
  context.fill();

  const circle = context.createRadialGradient(250, 190, 20, 250, 250, 250);
  circle.addColorStop(0, '#57407b');
  circle.addColorStop(0.56, '#25203a');
  circle.addColorStop(1, '#100f1d');
  context.fillStyle = circle;
  context.beginPath();
  context.arc(250, 250, 246, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(215, 187, 255, 0.82)';
  context.font = '400 110px "Unica One", sans-serif';
  context.textAlign = 'center';
  context.fillText('✦', 250, 250);
  drawFittedText(context, {
    text: spec.name,
    x: 58,
    y: 275,
    width: size.width - 116,
    height: 190,
    maxFontSize: 108,
    minFontSize: 48,
    maxLines: 3,
    fontFamily: '"Unica One", sans-serif',
    fontWeight: 400,
    lineHeight: 0.96,
    color: '#f7f7f4',
    uppercase: true,
    strokeColor: 'rgba(0, 0, 0, 0.66)',
    strokeWidth: 3,
  });
};

export class CardContentRasterizer implements ContentRasterizer<CardContentSpec> {
  async rasterize(spec: CardContentSpec, size: RasterSize): Promise<RasterArtifact> {
    await waitForFonts();
    const canvas = createRasterCanvas(size);
    const context = canvasContext(canvas);
    if (spec.layout === 'spell') drawSpell(context, spec, size);
    else await drawRegular(context, spec, size);
    return commitRaster(spec.cacheKey, size, canvas);
  }
}

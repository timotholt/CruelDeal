import type { RasterArtifact, RasterSize, VisualAssetRef } from '../contracts';

export const createRasterCanvas = (size: RasterSize): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
};

export const canvasContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');
  return context;
};

export const commitRaster = async (
  key: string,
  size: RasterSize,
  canvas: HTMLCanvasElement,
): Promise<RasterArtifact> => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('ImageBitmap is unavailable');
  }
  return Object.freeze({
    key,
    size,
    bitmap: await createImageBitmap(canvas),
  });
};

export const waitForFonts = async (): Promise<void> => {
  await document.fonts?.ready;
};

export const loadVisualAsset = async (asset: VisualAssetRef): Promise<HTMLImageElement> => {
  const image = new Image();
  image.decoding = 'async';
  image.src = asset.src;
  await image.decode();
  return image;
};

export const drawCover = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
): void => {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const sourceX = (sourceWidth - cropWidth) / 2;
  const sourceY = (sourceHeight - cropHeight) / 2;
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);
};

const wrapWords = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const previous = lines.at(-1);
    const candidate = previous ? `${previous} ${word}` : word;
    if (!previous || context.measureText(candidate).width <= maxWidth) {
      if (previous) lines[lines.length - 1] = candidate;
      else lines.push(candidate);
    } else {
      lines.push(word);
    }
  }
  return lines.length ? lines : [''];
};

export interface FitTextOptions {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly maxFontSize: number;
  readonly minFontSize: number;
  readonly maxLines: number;
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly lineHeight: number;
  readonly color: string;
  readonly uppercase?: boolean;
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
}

export const drawFittedText = (
  context: CanvasRenderingContext2D,
  options: FitTextOptions,
): void => {
  const text = options.uppercase ? options.text.toLocaleUpperCase() : options.text;
  let size = options.maxFontSize;
  let lines: string[] = [];
  while (size >= options.minFontSize) {
    context.font = `${options.fontWeight} ${size}px ${options.fontFamily}`;
    lines = wrapWords(context, text, options.width);
    if (lines.length <= options.maxLines && lines.length * size * options.lineHeight <= options.height) break;
    size -= 2;
  }
  lines = lines.slice(0, options.maxLines);
  const lineHeight = size * options.lineHeight;
  const startY = options.y + (options.height - lines.length * lineHeight) / 2 + size * 0.82;
  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.font = `${options.fontWeight} ${size}px ${options.fontFamily}`;
  context.lineJoin = 'round';
  for (const [index, line] of lines.entries()) {
    const lineY = startY + index * lineHeight;
    if (options.strokeColor && options.strokeWidth) {
      context.strokeStyle = options.strokeColor;
      context.lineWidth = options.strokeWidth;
      context.strokeText(line, options.x + options.width / 2, lineY);
    }
    context.fillStyle = options.color;
    context.fillText(line, options.x + options.width / 2, lineY);
  }
  context.restore();
};

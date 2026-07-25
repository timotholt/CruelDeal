import { CARD_BACK_HEIGHT, CARD_BACK_WIDTH } from './ProceduralCardBackPrimitives';

export const CARD_BACK_RUNTIME_WIDTH = 640;
export const CARD_BACK_RUNTIME_HEIGHT = 896;

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error('Unable to embed card-back artwork.'));
  reader.onload = () => resolve(String(reader.result));
  reader.readAsDataURL(blob);
});

const inlineLinkedImages = async (svg: SVGSVGElement) => {
  const images = Array.from(svg.querySelectorAll('image'));
  await Promise.all(images.map(async (image) => {
    const href = image.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    const response = await fetch(href);
    if (!response.ok) throw new Error(`Unable to embed ${href}.`);
    image.setAttribute('href', await blobToDataUrl(await response.blob()));
  }));
};

export const serializeCardBackSvg = async (source: SVGSVGElement) => {
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(CARD_BACK_WIDTH));
  svg.setAttribute('height', String(CARD_BACK_HEIGHT));
  svg.removeAttribute('aria-hidden');
  await inlineLinkedImages(svg);
  return new XMLSerializer().serializeToString(svg);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 0);
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`${type} encoding failed.`)), type, quality);
});

const blobToDownloadDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error('Unable to serialize card-back bitmap.'));
  reader.onload = () => resolve(String(reader.result));
  reader.readAsDataURL(blob);
});

const runtimeCanvas = (source: HTMLCanvasElement) => {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_BACK_RUNTIME_WIDTH;
  canvas.height = CARD_BACK_RUNTIME_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/** Flatten the authoring renderer into the exact bitmap contract used by the game asset pipeline. */
export const createRuntimeCardBackWebp = async (source: HTMLCanvasElement) => (
  canvasToBlob(runtimeCanvas(source), 'image/webp', 0.94)
);

export const createRuntimeCardBackDataUrl = async (source: HTMLCanvasElement) => (
  blobToDownloadDataUrl(await createRuntimeCardBackWebp(source))
);

export const downloadRuntimeCardBackWebp = async (source: HTMLCanvasElement, filename: string) => {
  downloadBlob(await createRuntimeCardBackWebp(source), filename);
};

export const downloadCardBackSvg = async (source: SVGSVGElement, filename: string) => {
  downloadBlob(new Blob([await serializeCardBackSvg(source)], { type: 'image/svg+xml;charset=utf-8' }), filename);
};

export const downloadCardBackPng = async (source: SVGSVGElement, filename: string) => {
  const svgBlob = new Blob([await serializeCardBackSvg(source)], { type: 'image/svg+xml;charset=utf-8' });
  const href = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = 'sync';
    image.src = href;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = CARD_BACK_WIDTH;
    canvas.height = CARD_BACK_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    context.drawImage(image, 0, 0, CARD_BACK_WIDTH, CARD_BACK_HEIGHT);

    const png = await canvasToBlob(canvas, 'image/png');
    downloadBlob(png, filename);
  } finally {
    URL.revokeObjectURL(href);
  }
};

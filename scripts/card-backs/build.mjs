#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUTPUT = resolve(ROOT, 'public/art/card-backs');
const SOURCE_IVORY = process.env.CARD_BACK_IVORY
  ?? '/Users/timotholt/Desktop/Cruel Deal/image_b40f3dde.png';
const SOURCE_ONYX = process.env.CARD_BACK_ONYX
  ?? '/Users/timotholt/Desktop/Cruel Deal/image_f6df683f.png';

const SOURCE_WIDTH = 896;
const SOURCE_HEIGHT = 1200;
const WIDTH = 1000;
const HEIGHT = 1400;
const DIFFERENCE_THRESHOLD = 35;
const ROW_COVERAGE_THRESHOLD = 0.22;
const MASK_DILATION_RADIUS = 2;
const MASK_BLUR_RADIUS = 2;

function decodeRgb(path) {
  const data = execFileSync('ffmpeg', [
    '-v', 'error', '-i', path,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { maxBuffer: 16 * 1024 * 1024 });
  const expected = SOURCE_WIDTH * SOURCE_HEIGHT * 3;
  if (data.length !== expected) {
    throw new Error(`Expected ${expected} decoded bytes from ${path}; got ${data.length}`);
  }
  return data;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.round((sorted.length - 1) * fraction)];
}

function detectCardRect(ivory, onyx) {
  const rows = [];
  for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
    let count = 0;
    let minimum = SOURCE_WIDTH;
    let maximum = -1;
    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const index = (y * SOURCE_WIDTH + x) * 3;
      const difference = (
        Math.abs(ivory[index] - onyx[index])
        + Math.abs(ivory[index + 1] - onyx[index + 1])
        + Math.abs(ivory[index + 2] - onyx[index + 2])
      ) / 3;
      if (difference > DIFFERENCE_THRESHOLD) {
        count += 1;
        minimum = Math.min(minimum, x);
        maximum = Math.max(maximum, x);
      }
    }
    if (count > SOURCE_WIDTH * ROW_COVERAGE_THRESHOLD) {
      rows.push({ y, minimum, maximum });
    }
  }

  if (rows.length < SOURCE_HEIGHT * 0.4) {
    throw new Error('Could not find a stable card region from the paired source images.');
  }

  const interiorLeft = percentile(rows.map((row) => row.minimum), 0.05);
  const interiorRight = percentile(rows.map((row) => row.maximum), 0.95);
  const interiorWidth = interiorRight - interiorLeft + 1;
  const interiorTop = rows[0].y;
  const interiorBottom = rows.at(-1).y;
  const interiorHeight = interiorBottom - interiorTop + 1;

  // The paired difference stops at the substrate edge. Expand to include the
  // unchanged gold rim and its antialiased outer edge.
  const horizontalMargin = Math.round(interiorWidth * 0.021);
  const verticalMargin = Math.round(interiorHeight * 0.016);
  return {
    left: interiorLeft - horizontalMargin,
    top: interiorTop - verticalMargin,
    right: interiorRight + horizontalMargin,
    bottom: interiorBottom + verticalMargin,
  };
}

function sampleBilinear(rgb, x, y, channel) {
  const x0 = Math.max(0, Math.min(SOURCE_WIDTH - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(SOURCE_HEIGHT - 1, Math.floor(y)));
  const x1 = Math.min(SOURCE_WIDTH - 1, x0 + 1);
  const y1 = Math.min(SOURCE_HEIGHT - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = rgb[(y0 * SOURCE_WIDTH + x0) * 3 + channel];
  const b = rgb[(y0 * SOURCE_WIDTH + x1) * 3 + channel];
  const c = rgb[(y1 * SOURCE_WIDTH + x0) * 3 + channel];
  const d = rgb[(y1 * SOURCE_WIDTH + x1) * 3 + channel];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function smoothstep(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function roundedRectCoverage(x, y) {
  const radius = 43;
  const cx = x < radius ? radius : x >= WIDTH - radius ? WIDTH - radius - 1 : x;
  const cy = y < radius ? radius : y >= HEIGHT - radius ? HEIGHT - radius - 1 : y;
  const distance = Math.hypot(x - cx, y - cy);
  return 1 - smoothstep(radius - 1.5, radius + 1.5, distance);
}

function rectify(rgb, rect) {
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
  const rectWidth = rect.right - rect.left;
  const rectHeight = rect.bottom - rect.top;
  for (let y = 0; y < HEIGHT; y += 1) {
    const sourceY = rect.top + (y / (HEIGHT - 1)) * rectHeight;
    for (let x = 0; x < WIDTH; x += 1) {
      const sourceX = rect.left + (x / (WIDTH - 1)) * rectWidth;
      const index = (y * WIDTH + x) * 4;
      rgba[index] = Math.round(sampleBilinear(rgb, sourceX, sourceY, 0));
      rgba[index + 1] = Math.round(sampleBilinear(rgb, sourceX, sourceY, 1));
      rgba[index + 2] = Math.round(sampleBilinear(rgb, sourceX, sourceY, 2));
      rgba[index + 3] = Math.round(255 * roundedRectCoverage(x, y));
    }
  }
  return rgba;
}

function makeInitialGoldMask(onyx, ivory) {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * 4;
    const r = onyx[offset];
    const g = onyx[offset + 1];
    const b = onyx[offset + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const warmth = 0.68 * (r - b) + 0.32 * (g - b);
    const warmMetal = smoothstep(3, 31, warmth) * (0.42 + 0.58 * smoothstep(24, 155, luminance));

    const crossDifference = (
      Math.abs(r - ivory[offset])
      + Math.abs(g - ivory[offset + 1])
      + Math.abs(b - ivory[offset + 2])
    ) / 3;
    const neutralHighlight = smoothstep(78, 190, luminance)
      * (1 - smoothstep(28, 90, crossDifference)) * 0.72;
    const faintWarmLine = smoothstep(1.5, 12, warmth) * smoothstep(24, 72, luminance) * 0.38;
    const score = Math.max(warmMetal, neutralHighlight, faintWarmLine);
    mask[i] = Math.round(255 * score * (onyx[offset + 3] / 255));
  }
  return mask;
}

function dilate(source, radius) {
  const output = new Uint8Array(source.length);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      let maximum = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const sy = Math.max(0, Math.min(HEIGHT - 1, y + dy));
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sx = Math.max(0, Math.min(WIDTH - 1, x + dx));
          maximum = Math.max(maximum, source[sy * WIDTH + sx]);
        }
      }
      output[y * WIDTH + x] = maximum;
    }
  }
  return output;
}

function boxBlur(source, radius) {
  let input = source;
  for (let pass = 0; pass < 2; pass += 1) {
    const horizontal = new Float32Array(source.length);
    for (let y = 0; y < HEIGHT; y += 1) {
      let sum = 0;
      for (let x = -radius; x <= radius; x += 1) {
        sum += input[y * WIDTH + Math.max(0, Math.min(WIDTH - 1, x))];
      }
      for (let x = 0; x < WIDTH; x += 1) {
        horizontal[y * WIDTH + x] = sum / (radius * 2 + 1);
        sum -= input[y * WIDTH + Math.max(0, x - radius)];
        sum += input[y * WIDTH + Math.min(WIDTH - 1, x + radius + 1)];
      }
    }
    const vertical = new Uint8Array(source.length);
    for (let x = 0; x < WIDTH; x += 1) {
      let sum = 0;
      for (let y = -radius; y <= radius; y += 1) {
        sum += horizontal[Math.max(0, Math.min(HEIGHT - 1, y)) * WIDTH + x];
      }
      for (let y = 0; y < HEIGHT; y += 1) {
        vertical[y * WIDTH + x] = Math.round(sum / (radius * 2 + 1));
        sum -= horizontal[Math.max(0, y - radius) * WIDTH + x];
        sum += horizontal[Math.min(HEIGHT - 1, y + radius + 1) * WIDTH + x];
      }
    }
    input = vertical;
  }
  return input;
}

function maskAsRgba(mask) {
  const rgba = Buffer.alloc(mask.length * 4);
  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * 4;
    // CSS image masks use alpha by default. Keep the visible mask white and
    // place classification confidence in alpha so every browser clips the
    // reflection without requiring mask-mode: luminance.
    rgba[offset] = 255;
    rgba[offset + 1] = 255;
    rgba[offset + 2] = 255;
    rgba[offset + 3] = mask[i];
  }
  return rgba;
}

function overlayMask(base, mask) {
  const output = Buffer.from(base);
  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * 4;
    const alpha = (mask[i] / 255) * 0.72;
    output[offset] = Math.round(output[offset] * (1 - alpha) + 255 * alpha);
    output[offset + 1] = Math.round(output[offset + 1] * (1 - alpha) + 45 * alpha);
    output[offset + 2] = Math.round(output[offset + 2] * (1 - alpha) + 185 * alpha);
  }
  return output;
}

function compositePreview(base, mask, reflectionX) {
  const output = Buffer.from(base);
  for (let y = 0; y < HEIGHT; y += 1) {
    const ny = y / HEIGHT;
    for (let x = 0; x < WIDTH; x += 1) {
      const nx = x / WIDTH;
      const index = y * WIDTH + x;
      const offset = index * 4;

      // Static upper-right key light and a weak opposing falloff ground the card.
      const keyDistance = Math.hypot((nx - 0.88) / 0.88, (ny - 0.05) / 0.68);
      const key = Math.max(0, 1 - keyDistance) ** 1.7;
      const opposing = Math.max(0, 1 - Math.hypot((nx - 0.05) / 1.0, (ny - 1.0) / 0.9));
      const keyGain = 1 + key * 0.20 - opposing * 0.055;
      output[offset] = Math.min(255, output[offset] * keyGain + key * 7);
      output[offset + 1] = Math.min(255, output[offset + 1] * keyGain + key * 5);
      output[offset + 2] = Math.min(255, output[offset + 2] * keyGain + key * 1);

      // A broad diagonal film reflection, gated by the forgiving gold mask.
      const diagonal = nx + ny * 0.30;
      const stripe = Math.exp(-((diagonal - reflectionX) ** 2) / 0.012);
      const bloom = Math.exp(-(((nx - (reflectionX - 0.16)) ** 2) / 0.11 + ((ny - 0.22) ** 2) / 0.14));
      const reflection = (stripe * 0.72 + bloom * 0.22) * (mask[index] / 255);
      output[offset] = Math.min(255, output[offset] + 105 * reflection);
      output[offset + 1] = Math.min(255, output[offset + 1] + 86 * reflection);
      output[offset + 2] = Math.min(255, output[offset + 2] + 38 * reflection);
    }
  }
  return output;
}

function encodePng(path, rgba) {
  const rawPath = resolve(OUTPUT, '.card-back-frame.rgba');
  writeFileSync(rawPath, rgba);
  try {
    execFileSync('ffmpeg', [
      '-v', 'error', '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${WIDTH}x${HEIGHT}`,
      '-i', rawPath, '-frames:v', '1', path,
    ], { maxBuffer: 16 * 1024 * 1024 });
  } finally {
    rmSync(rawPath, { force: true });
  }
}

mkdirSync(OUTPUT, { recursive: true });
const ivorySource = decodeRgb(SOURCE_IVORY);
const onyxSource = decodeRgb(SOURCE_ONYX);
const rect = detectCardRect(ivorySource, onyxSource);
const ivory = rectify(ivorySource, rect);
const onyx = rectify(onyxSource, rect);
const initialMask = makeInitialGoldMask(onyx, ivory);
const mask = boxBlur(dilate(initialMask, MASK_DILATION_RADIUS), MASK_BLUR_RADIUS);

encodePng(resolve(OUTPUT, 'scg-back-ivory.png'), ivory);
encodePng(resolve(OUTPUT, 'scg-back-onyx.png'), onyx);
encodePng(resolve(OUTPUT, 'scg-back-gold-mask.png'), maskAsRgba(mask));
encodePng(resolve(OUTPUT, 'debug-gold-mask-overlay.png'), overlayMask(onyx, mask));
encodePng(resolve(OUTPUT, 'preview-onyx-reflection-left.png'), compositePreview(onyx, mask, 0.45));
encodePng(resolve(OUTPUT, 'preview-onyx-reflection-right.png'), compositePreview(onyx, mask, 1.03));
encodePng(resolve(OUTPUT, 'preview-ivory-reflection.png'), compositePreview(ivory, mask, 0.78));

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: { ivory: SOURCE_IVORY, onyx: SOURCE_ONYX, width: SOURCE_WIDTH, height: SOURCE_HEIGHT },
  output: { width: WIDTH, height: HEIGHT, aspectRatio: '5:7' },
  detectedRect: rect,
  parameters: {
    differenceThreshold: DIFFERENCE_THRESHOLD,
    rowCoverageThreshold: ROW_COVERAGE_THRESHOLD,
    maskDilationRadius: MASK_DILATION_RADIUS,
    maskBlurRadius: MASK_BLUR_RADIUS,
  },
  runtimeAssets: ['scg-back-ivory.png', 'scg-back-onyx.png', 'scg-back-gold-mask.png'],
};
writeFileSync(resolve(OUTPUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify(manifest, null, 2));

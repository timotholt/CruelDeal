import type { ShinyStop, ShinyTextureOptions } from './types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp255 = (v: number) => Math.max(0, Math.min(255, v));

const seededUnit = (seed: number) => {
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function bakeShinyTextureFromStops(stops: ShinyStop[], opts: ShinyTextureOptions = {}): string {
  if (typeof document === 'undefined' || stops.length === 0) return '';
  const size = opts.size ?? 512;
  const grain = opts.grain ?? 8;
  const angle = opts.angle ?? 135;
  const seed = opts.seed ?? 1337;
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const rad = (angle * Math.PI) / 180;
  const half = size / 2;
  const dx = Math.cos(rad) * half;
  const dy = Math.sin(rad) * half;
  const gradient = ctx.createLinearGradient(half - dx, half - dy, half + dx, half + dy);
  sorted.forEach((s) => gradient.addColorStop(clamp01(s.offset / 100), s.color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  if (grain > 0) {
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let y = 0; y < size; y++) {
      const streak = (seededUnit(seed + y * 374761393) - 0.5) * grain;
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n = streak + (seededUnit(seed + y * 668265263 + x * 2246822519) - 0.5) * grain * 0.5;
        data[idx] = clamp255(data[idx] + n);
        data[idx + 1] = clamp255(data[idx + 1] + n);
        data[idx + 2] = clamp255(data[idx + 2] + n);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toDataURL('image/png');
}

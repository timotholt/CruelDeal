import type { IslandMask, TensorField, TensorFieldConfig, TensorSample, Vec2 } from './types';

export function createTensorField(
  configs: TensorFieldConfig[],
  island: IslandMask,
  rng: () => number,
): TensorField {
  const fields = configs.map((cfg) => buildField(cfg, island, rng));

  return {
    sample(x: number, y: number): TensorSample {
      let totalAngle = 0;
      let totalStrength = 0;

      for (const field of fields) {
        const s = field.sample(x, y);
        if (s.strength <= 0) continue;
        totalAngle += s.angle * s.strength;
        totalStrength += s.strength;
      }

      if (totalStrength < 0.001) {
        return { pos: { x, y }, angle: 0, strength: 0 };
      }

      return {
        pos: { x, y },
        angle: totalAngle / totalStrength,
        strength: Math.min(totalStrength, 1),
      };
    },
  };
}

interface LocalField {
  sample(x: number, y: number): TensorSample;
}

function buildField(cfg: TensorFieldConfig, island: IslandMask, rng: () => number): LocalField {
  switch (cfg.kind) {
    case 'grid':
      return buildGridField(cfg);
    case 'radial':
      return buildRadialField(cfg, island);
    case 'coast_following':
      return buildCoastFollowingField(cfg, island);
    case 'noise':
      return buildNoiseField(cfg, rng);
    case 'attractor':
      return buildAttractorField(cfg);
    case 'repulsor':
      return buildRepulsorField(cfg);
    default:
      return buildGridField(cfg);
  }
}

function buildGridField(cfg: TensorFieldConfig): LocalField {
  const angleRad = ((cfg.angle ?? 0) * Math.PI) / 180;
  const pos = cfg.position;
  const size = cfg.size;

  return {
    sample(x: number, y: number): TensorSample {
      if (pos && size) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) / size;
        if (dist > 1) return { pos: { x, y }, angle: 0, strength: 0 };
        const falloff = 1 - dist;
        return { pos: { x, y }, angle: angleRad, strength: cfg.strength * falloff };
      }
      return { pos: { x, y }, angle: angleRad, strength: cfg.strength };
    },
  };
}

function buildRadialField(cfg: TensorFieldConfig, island: IslandMask): LocalField {
  const center = cfg.position || centroid(island.outline);
  const size = cfg.size || 0.5;

  return {
    sample(x: number, y: number): TensorSample {
      const dx = x - center.x;
      const dy = y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) return { pos: { x, y }, angle: 0, strength: 0 };
      const angle = Math.atan2(dy, dx) + Math.PI / 2;
      const falloff = Math.max(0, 1 - dist / size);
      return { pos: { x, y }, angle, strength: cfg.strength * falloff };
    },
  };
}

function buildCoastFollowingField(cfg: TensorFieldConfig, island: IslandMask): LocalField {
  const outline = island.outline;
  if (outline.length < 3) return buildGridField({ ...cfg, kind: 'grid', angle: 0 });

  return {
    sample(x: number, y: number): TensorSample {
      let bestDist = Infinity;
      let bestAngle = 0;

      for (let i = 0; i < outline.length; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % outline.length];
        const { dist, t } = pointToSegmentDist2({ x, y }, a, b);
        if (dist < bestDist) {
          bestDist = dist;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          bestAngle = Math.atan2(dy, dx);
        }
      }

      const falloff = Math.max(0, 1 - bestDist / 80);
      return { pos: { x, y }, angle: bestAngle, strength: cfg.strength * falloff };
    },
  };
}

function buildNoiseField(cfg: TensorFieldConfig, rng: () => number): LocalField {
  const scale = 0.008;
  const offsets: number[] = [];
  for (let i = 0; i < 16; i++) offsets.push(rng() * 1000);

  return {
    sample(x: number, y: number): TensorSample {
      const nx = x * scale;
      const ny = y * scale;
      const angle = noise2d(nx + offsets[0], ny + offsets[1], offsets) * Math.PI * 2;
      return { pos: { x, y }, angle, strength: cfg.strength };
    },
  };
}

function buildAttractorField(cfg: TensorFieldConfig): LocalField {
  const center = cfg.position || { x: 0.5, y: 0.5 };
  const size = cfg.size || 0.3;

  return {
    sample(x: number, y: number): TensorSample {
      const dx = center.x - x;
      const dy = center.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) return { pos: { x, y }, angle: 0, strength: 0 };
      const angle = Math.atan2(dy, dx);
      const falloff = Math.max(0, 1 - dist / size);
      return { pos: { x, y }, angle, strength: cfg.strength * falloff };
    },
  };
}

function buildRepulsorField(cfg: TensorFieldConfig): LocalField {
  const center = cfg.position || { x: 0.5, y: 0.5 };
  const size = cfg.size || 0.3;

  return {
    sample(x: number, y: number): TensorSample {
      const dx = x - center.x;
      const dy = y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) return { pos: { x, y }, angle: 0, strength: 0 };
      const angle = Math.atan2(dy, dx);
      const falloff = Math.max(0, 1 - dist / size);
      return { pos: { x, y }, angle, strength: cfg.strength * falloff };
    },
  };
}

function centroid(poly: Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / poly.length, y: cy / poly.length };
}

function pointToSegmentDist2(p: Vec2, a: Vec2, b: Vec2): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.001) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return { dist: Math.sqrt(ex * ex + ey * ey), t: 0 };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  const ex = p.x - cx;
  const ey = p.y - cy;
  return { dist: Math.sqrt(ex * ex + ey * ey), t };
}

function noise2d(x: number, y: number, offsets: number[]): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const sx = smoothstep(fx);
  const sy = smoothstep(fy);

  const n00 = hash(ix, iy, offsets);
  const n10 = hash(ix + 1, iy, offsets);
  const n01 = hash(ix, iy + 1, offsets);
  const n11 = hash(ix + 1, iy + 1, offsets);

  const nx0 = lerp(n00, n10, sx);
  const nx1 = lerp(n01, n11, sx);

  return lerp(nx0, nx1, sy);
}

function hash(x: number, y: number, offsets: number[]): number {
  const i = Math.abs(x * 374761393 + y * 668265263 + offsets[x & 15]) % 1;
  return i;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

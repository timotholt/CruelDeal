import type { IslandMask, Vec2 } from './types';

export function createIslandMask(outline: Vec2[], inset: Vec2[]): IslandMask {
  return {
    outline,
    inset,
    containsPoint(x: number, y: number): boolean {
      return pointInPolygon({ x, y }, inset.length > 0 ? inset : outline);
    },
    containsPolygon(poly: Vec2[], threshold = 0.5): boolean {
      if (poly.length === 0) return false;
      let inside = 0;
      for (const p of poly) {
        if (this.containsPoint(p.x, p.y)) inside++;
      }
      return inside / poly.length >= threshold;
    },
  };
}

function pointInPolygon(p: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

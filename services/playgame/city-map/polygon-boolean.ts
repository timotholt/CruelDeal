import polygonClipping from 'polygon-clipping';
import { polygonArea } from './geometry';
import type { Point } from './types';

export type PolygonSet = Point[][];

type Ring = number[][];
type MultiPolygon = Ring[][][];

const MIN_AREA = 1.5;

function cleanPolygon(polygon: readonly Point[]) {
  const out: Point[] = [];
  for (const point of polygon || []) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(point.x - prev.x, point.y - prev.y) > 0.025) {
      out.push({ x: point.x, y: point.y });
    }
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.025) out.pop();
  }
  return out.length >= 3 && polygonArea(out) >= MIN_AREA ? out : [];
}

function toMultiPolygon(polygons: PolygonSet): MultiPolygon {
  return polygons
    .map(cleanPolygon)
    .filter((polygon) => polygon.length >= 3)
    .map((polygon) => [[
      ...polygon.map((point) => [point.x, point.y]),
      [polygon[0].x, polygon[0].y],
    ]]);
}

function fromMultiPolygon(result: MultiPolygon): PolygonSet {
  const out: PolygonSet = [];
  for (const polygon of result || []) {
    const outerRing = polygon[0] || [];
    const points = cleanPolygon(outerRing.slice(0, -1).map(([x, y]) => ({ x, y })));
    if (points.length >= 3) out.push(points);
  }
  return out.sort((a, b) => polygonArea(b) - polygonArea(a));
}

function emptyIfNoInput(polygons: PolygonSet) {
  return toMultiPolygon(polygons).length ? null : [];
}

export const polygonBoolean = {
  union(polygons: PolygonSet): PolygonSet {
    const empty = emptyIfNoInput(polygons);
    if (empty) return empty;
    try {
      return fromMultiPolygon(polygonClipping.union(toMultiPolygon(polygons)) as MultiPolygon);
    } catch {
      return polygonBoolean.clean(polygons);
    }
  },

  difference(subject: PolygonSet, mask: PolygonSet): PolygonSet {
    const subjectMulti = toMultiPolygon(subject);
    if (!subjectMulti.length) return [];
    const maskMulti = toMultiPolygon(mask);
    if (!maskMulti.length) return fromMultiPolygon(subjectMulti);
    try {
      return fromMultiPolygon(polygonClipping.difference(subjectMulti, maskMulti) as MultiPolygon);
    } catch {
      return fromMultiPolygon(subjectMulti);
    }
  },

  intersection(a: PolygonSet, b: PolygonSet): PolygonSet {
    const aMulti = toMultiPolygon(a);
    const bMulti = toMultiPolygon(b);
    if (!aMulti.length || !bMulti.length) return [];
    try {
      return fromMultiPolygon(polygonClipping.intersection(aMulti, bMulti) as MultiPolygon);
    } catch {
      return [];
    }
  },

  clean(polygons: PolygonSet): PolygonSet {
    return polygons.map(cleanPolygon).filter((polygon) => polygon.length >= 3);
  },
};

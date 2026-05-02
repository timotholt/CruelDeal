import * as THREE from 'three';
import type { Building, Point, RoadEdge } from '@/services/playgame/city-map';

export function mapPointToThree(point: Point) {
  return new THREE.Vector3(point.x, 0, point.y);
}

export function threePointToMap(position: THREE.Vector3): Point {
  return { x: position.x, y: position.z };
}

export function createMapPlane(width: number, height: number) {
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(width / 2, 0, height / 2);
  return geometry;
}

function cleanPolygon(points: readonly Point[] | undefined) {
  if (!points || points.length < 3) return [];
  const cleaned: Point[] = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 0.001) cleaned.push(point);
  }
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) <= 0.001) cleaned.pop();
  return cleaned.length >= 3 ? cleaned : [];
}

function smoothClosedPolygon(points: readonly Point[], iterations = 2) {
  let smoothed = points.slice();
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next: Point[] = [];
    for (let i = 0; i < smoothed.length; i++) {
      const a = smoothed[i];
      const b = smoothed[(i + 1) % smoothed.length];
      next.push({
        x: a.x * 0.75 + b.x * 0.25,
        y: a.y * 0.75 + b.y * 0.25,
      });
      next.push({
        x: a.x * 0.25 + b.x * 0.75,
        y: a.y * 0.25 + b.y * 0.75,
      });
    }
    smoothed = next;
  }
  return smoothed;
}

export function createPolygonGeometry(points: readonly Point[] | undefined, elevation = 0) {
  const polygon = cleanPolygon(points);
  if (!polygon.length) return null;

  const shape = new THREE.Shape();
  shape.moveTo(polygon[0].x, polygon[0].y);
  for (const point of polygon.slice(1)) shape.lineTo(point.x, point.y);
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, elevation, 0);
  return geometry;
}

export function createSmoothPolygonGeometry(points: readonly Point[] | undefined, elevation = 0, iterations = 2) {
  const polygon = cleanPolygon(points);
  return createPolygonGeometry(polygon.length ? smoothClosedPolygon(polygon, iterations) : polygon, elevation);
}

function createMapShape(points: readonly Point[] | undefined) {
  const polygon = cleanPolygon(points);
  if (!polygon.length) return null;

  const shape = new THREE.Shape();
  shape.moveTo(polygon[0].x, -polygon[0].y);
  for (const point of polygon.slice(1)) shape.lineTo(point.x, -point.y);
  shape.closePath();
  return shape;
}

export function createBuildingGeometry(building: Building) {
  const shape = createMapShape(building.polygon);
  if (!shape) return null;

  const height = Math.max(0.6, (building.render?.height ?? 2.4) * 0.72);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, building.render?.baseElevation ?? 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

export function createRoadStripGeometry(edge: RoadEdge, width: number, elevation = 0) {
  const points = Array.isArray(edge.points) ? edge.points as Point[] : [];
  const renderPoints = points.length >= 2 ? smoothPolylineForRender(points, edge) : [edge.a, edge.b];
  return createPolylineStripGeometry(renderPoints, width, elevation);
}

export function createSegmentStripGeometry(a: Point, b: Point, width: number, elevation = 0) {
  return createPolylineStripGeometry([a, b], width, elevation);
}

export function createPolylineStripGeometry(points: readonly Point[] | undefined, width: number, elevation = 0) {
  const polyline = cleanPolyline(points);
  if (polyline.length < 2) return null;

  const halfWidth = width / 2;
  const left: Point[] = [];
  const right: Point[] = [];
  const normals = [];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) continue;
    normals.push({ x: -dy / length, y: dx / length });
  }

  if (!normals.length) return null;

  for (let i = 0; i < polyline.length; i++) {
    const p = polyline[i];
    const prevNormal = normals[Math.max(0, i - 1)];
    const nextNormal = normals[Math.min(normals.length - 1, i)];
    let nx = prevNormal.x + nextNormal.x;
    let ny = prevNormal.y + nextNormal.y;
    let normalLength = Math.hypot(nx, ny);
    if (normalLength <= 0.001) {
      nx = nextNormal.x;
      ny = nextNormal.y;
      normalLength = Math.hypot(nx, ny) || 1;
    }

    nx /= normalLength;
    ny /= normalLength;

    const dot = Math.max(0.35, Math.abs(nx * nextNormal.x + ny * nextNormal.y));
    const miter = Math.min(halfWidth / dot, halfWidth * 2.35);
    left.push({ x: p.x + nx * miter, y: p.y + ny * miter });
    right.push({ x: p.x - nx * miter, y: p.y - ny * miter });
  }

  return createPolygonGeometry([...left, ...right.reverse()], elevation);
}

function cleanPolyline(points: readonly Point[] | undefined) {
  if (!points || points.length < 2) return [];
  const cleaned: Point[] = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 0.001) cleaned.push(point);
  }
  return cleaned.length >= 2 ? cleaned : [];
}

function smoothPolylineForRender(points: readonly Point[], edge: RoadEdge) {
  const polyline = cleanPolyline(points);
  if (polyline.length < 3) return polyline;

  const isClosed = Math.hypot(polyline[0].x - polyline[polyline.length - 1].x, polyline[0].y - polyline[polyline.length - 1].y) <= 0.001;
  const source = String(edge.source || '');
  const shouldSmooth = isClosed || source === 'coast-road' || edge.riverBank || polyline.length >= 5;
  if (!shouldSmooth) return polyline;

  const base = isClosed ? polyline.slice(0, -1) : polyline;
  let smoothed = isClosed ? smoothClosedPolygon(base, 2) : smoothOpenPolyline(base, 2);
  if (isClosed) smoothed = [...smoothed, smoothed[0]];
  return smoothed;
}

function smoothOpenPolyline(points: readonly Point[], iterations = 2) {
  let smoothed = points.slice();
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next: Point[] = [smoothed[0]];
    for (let i = 0; i < smoothed.length - 1; i++) {
      const a = smoothed[i];
      const b = smoothed[i + 1];
      next.push({
        x: a.x * 0.75 + b.x * 0.25,
        y: a.y * 0.75 + b.y * 0.25,
      });
      next.push({
        x: a.x * 0.25 + b.x * 0.75,
        y: a.y * 0.25 + b.y * 0.75,
      });
    }
    next.push(smoothed[smoothed.length - 1]);
    smoothed = next;
  }
  return smoothed;
}

export function buildingCentroid(building: Building) {
  if (building.centroid) return building.centroid;
  const polygon = cleanPolygon(building.polygon);
  if (!polygon.length) return null;
  return {
    x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
    y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
  };
}

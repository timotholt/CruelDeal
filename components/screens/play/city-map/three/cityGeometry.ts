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
  return createSegmentStripGeometry(edge.a, edge.b, width, elevation);
}

export function createSegmentStripGeometry(a: Point, b: Point, width: number, elevation = 0) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return null;

  const nx = -dy / length;
  const ny = dx / length;
  const halfWidth = width / 2;
  return createPolygonGeometry([
    { x: a.x + nx * halfWidth, y: a.y + ny * halfWidth },
    { x: b.x + nx * halfWidth, y: b.y + ny * halfWidth },
    { x: b.x - nx * halfWidth, y: b.y - ny * halfWidth },
    { x: a.x - nx * halfWidth, y: a.y - ny * halfWidth },
  ], elevation);
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

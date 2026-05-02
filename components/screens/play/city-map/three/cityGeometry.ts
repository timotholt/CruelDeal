import * as THREE from 'three';
import type { Point } from '@/services/playgame/city-map';

export function mapPointToThree(point: Point) {
  return new THREE.Vector3(point.x, 0, point.y);
}

export function threePointToMap(position: THREE.Vector3): Point {
  return { x: position.x, y: position.z };
}

export function createMapPlane(width: number, height: number) {
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(width / 2, 0, height / 2);
  return geometry;
}

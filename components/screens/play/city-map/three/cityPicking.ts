import * as THREE from 'three';
import type { Point } from '@/services/playgame/city-map';
import type { CityMapViewport, Size } from '../camera';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const scratch = new THREE.Vector3();

export function screenPointToMapPoint(
  point: { x: number; y: number },
  camera: THREE.Camera,
  viewport: CityMapViewport,
  surfaceSize: Size,
): Point | null {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(
    (point.x / Math.max(1, surfaceSize.width)) * 2 - 1,
    -(point.y / Math.max(1, surfaceSize.height)) * 2 + 1,
  );

  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.ray.intersectPlane(groundPlane, scratch);
  if (!hit) return null;
  if (hit.x < viewport.x || hit.x > viewport.x + viewport.width || hit.z < viewport.y || hit.z > viewport.y + viewport.height) {
    return null;
  }
  return { x: hit.x, y: hit.z };
}

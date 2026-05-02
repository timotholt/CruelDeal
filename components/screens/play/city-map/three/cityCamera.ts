import * as THREE from 'three';
import type { CityMapViewport, Size } from '../camera';

export function createCityOrthographicCamera() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  camera.up.set(0, 0, -1);
  return camera;
}

export function updateCityCamera(camera: THREE.OrthographicCamera, viewport: CityMapViewport, surfaceSize: Size) {
  const aspect = surfaceSize.width / Math.max(1, surfaceSize.height);
  const halfHeight = viewport.height / 2;
  const halfWidth = halfHeight * aspect;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.near = 0.1;
  camera.far = 5000;
  camera.position.set(viewport.x + viewport.width / 2, 1000, viewport.y + viewport.height / 2);
  camera.lookAt(viewport.x + viewport.width / 2, 0, viewport.y + viewport.height / 2);
  camera.updateProjectionMatrix();
}

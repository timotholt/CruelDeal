import * as THREE from 'three';

export function addCityLights(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0x6f8fbc, 1.25);
  const key = new THREE.DirectionalLight(0xcfeaff, 1.8);
  key.position.set(-140, 260, -180);

  scene.add(ambient, key);
}

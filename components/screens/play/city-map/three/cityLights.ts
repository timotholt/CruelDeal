import * as THREE from 'three';

export function addCityLights(scene: THREE.Scene) {
  const ambient = new THREE.HemisphereLight(0x9edcff, 0x06101f, 1.35);
  const key = new THREE.DirectionalLight(0xd8f7ff, 2.6);
  key.position.set(-180, 420, -260);
  const rim = new THREE.DirectionalLight(0x3edcff, 0.9);
  rim.position.set(260, 180, 320);

  scene.add(ambient, key, rim);
}

import * as THREE from 'three';

export function createCityMaterials() {
  return {
    water: new THREE.MeshBasicMaterial({ color: 0x07111f }),
    terrain: new THREE.MeshStandardMaterial({ color: 0x17305b, roughness: 0.78, metalness: 0.06 }),
    debugGrid: new THREE.LineBasicMaterial({ color: 0x2dfff0, transparent: true, opacity: 0.16 }),
  };
}

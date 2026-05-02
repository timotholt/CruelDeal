import * as THREE from 'three';

export function createCityMaterials() {
  return {
    water: new THREE.MeshBasicMaterial({ color: 0x0d1d37, side: THREE.DoubleSide }),
    terrain: new THREE.MeshStandardMaterial({ color: 0x255490, roughness: 0.78, metalness: 0.06, side: THREE.DoubleSide }),
    park: new THREE.MeshStandardMaterial({ color: 0x27936f, roughness: 0.8, metalness: 0.02, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
    plaza: new THREE.MeshStandardMaterial({ color: 0x386fa3, roughness: 0.74, metalness: 0.04, transparent: true, opacity: 0.76, side: THREE.DoubleSide }),
    roadUnderlay: new THREE.MeshBasicMaterial({ color: 0x020814, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    roadLocal: new THREE.MeshBasicMaterial({ color: 0x35a5ff, transparent: true, opacity: 0.78, side: THREE.DoubleSide }),
    roadStreet: new THREE.MeshBasicMaterial({ color: 0x55bdff, transparent: true, opacity: 0.84, side: THREE.DoubleSide }),
    roadAvenue: new THREE.MeshBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    roadHighway: new THREE.MeshBasicMaterial({ color: 0xb8f1ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    bridge: new THREE.MeshBasicMaterial({ color: 0xd8fbff, transparent: true, opacity: 0.96, side: THREE.DoubleSide }),
    buildingLowrise: new THREE.MeshStandardMaterial({ color: 0x3d7fc4, roughness: 0.68, metalness: 0.08, transparent: true, opacity: 0.78, side: THREE.DoubleSide }),
    buildingMidrise: new THREE.MeshStandardMaterial({ color: 0x4f9be2, roughness: 0.64, metalness: 0.1, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    buildingTower: new THREE.MeshStandardMaterial({ color: 0x65b9ff, roughness: 0.58, metalness: 0.12, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    buildingLandmark: new THREE.MeshStandardMaterial({ color: 0x92f4ff, roughness: 0.5, metalness: 0.16, transparent: true, opacity: 0.94, side: THREE.DoubleSide }),
    debugGrid: new THREE.LineBasicMaterial({ color: 0x2dfff0, transparent: true, opacity: 0.16 }),
    debugWireframe: new THREE.MeshBasicMaterial({ color: 0x8dfcff, wireframe: true, transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
  };
}

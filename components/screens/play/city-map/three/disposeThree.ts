import * as THREE from 'three';

function disposeMaterial(material: THREE.Material, disposedTextures: Set<THREE.Texture>) {
  const textured = material as THREE.Material & Record<string, unknown>;
  for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
    const texture = textured[key] as THREE.Texture | undefined;
    if (texture && !disposedTextures.has(texture)) {
      texture.dispose();
      disposedTextures.add(texture);
    }
  }
  material.dispose();
}

export function disposeThreeObject(root: THREE.Object3D) {
  const disposedTextures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();

    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) disposeMaterial(entry, disposedTextures);
    } else {
      if (material) disposeMaterial(material, disposedTextures);
    }
  });
}

import * as THREE from 'three';
import type { CityMapRenderModel } from '../render-model';
import { createMapPlane } from './cityGeometry';
import { addCityLights } from './cityLights';
import { createCityMaterials } from './cityMaterials';

export function createCityScene(model: CityMapRenderModel) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  const materials = createCityMaterials();
  const ground = new THREE.Mesh(createMapPlane(model.world.width, model.world.height), materials.terrain);
  ground.name = 'city-map-ground';
  scene.add(ground);

  const grid = new THREE.GridHelper(Math.max(model.world.width, model.world.height), 16, 0x2dfff0, 0x2dfff0);
  grid.position.set(model.world.width / 2, 0.04, model.world.height / 2);
  grid.material = materials.debugGrid;
  grid.name = 'city-map-debug-grid';
  scene.add(grid);

  addCityLights(scene);

  return { scene, materials };
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Bridge, Building, Point, RoadEdge, TerrainRenderMeta } from '@/services/playgame/city-map';
import type { CityMapRenderModel } from '../render-model';
import type { CityMapDebugState } from '../CityMapDebugDock';
import { createBuildingGeometry, createMapPlane, createPolygonGeometry, createRoadStripGeometry, createSegmentStripGeometry } from './cityGeometry';
import { addCityLights } from './cityLights';
import { createCityMaterials } from './cityMaterials';

function terrainElevation(render: TerrainRenderMeta | undefined, fallback: number) {
  return render?.elevation ?? fallback;
}

function materialForOpenSpace(materials: ReturnType<typeof createCityMaterials>, materialKey?: string) {
  if (materialKey === 'plaza' || materialKey === 'industrial') return materials.plaza;
  return materials.park;
}

function roadKind(edge: RoadEdge) {
  const key = edge.render?.materialKey;
  if (key && key !== 'bridge' && key !== 'route') return key;
  if (edge.kind === 'highway') return 'highway';
  if (edge.kind === 'avenue' || edge.kind === 'coast') return 'avenue';
  if (edge.kind === 'main' || edge.kind === 'street') return 'street';
  return 'local';
}

function roadWidth(edge: RoadEdge, underlay = false) {
  const base = edge.render?.width
    ?? (roadKind(edge) === 'highway' ? 1.42 : roadKind(edge) === 'avenue' ? 1.05 : roadKind(edge) === 'street' ? 0.72 : 0.38);
  return underlay ? base + Math.max(0.7, base * 1.65) : base;
}

function materialForRoad(materials: ReturnType<typeof createCityMaterials>, edge: RoadEdge) {
  switch (roadKind(edge)) {
    case 'highway':
      return materials.roadHighway;
    case 'avenue':
      return materials.roadAvenue;
    case 'street':
      return materials.roadStreet;
    default:
      return materials.roadLocal;
  }
}

function materialForBuilding(materials: ReturnType<typeof createCityMaterials>, building: Building) {
  switch (building.render?.materialKey) {
    case 'landmark':
      return materials.buildingLandmark;
    case 'tower':
      return materials.buildingTower;
    case 'midrise':
      return materials.buildingMidrise;
    default:
      return materials.buildingLowrise;
  }
}

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry | null,
  material: THREE.Material,
  name: string,
  debugWireframe?: THREE.Material,
  renderOrder = 0,
) {
  if (!geometry) return;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = renderOrder;
  group.add(mesh);

  if (!debugWireframe) return;
  const wire = new THREE.Mesh(geometry.clone(), debugWireframe);
  wire.name = `${name}:wireframe`;
  wire.position.y += 0.08;
  wire.renderOrder = renderOrder + 0.5;
  group.add(wire);
}

function addBatchedMesh(
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  name: string,
  debugWireframe?: THREE.Material,
  renderOrder = 0,
) {
  if (!geometries.length) return;
  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
  if (!merged) return;
  merged.computeBoundingSphere();

  const mesh = new THREE.Mesh(merged, material);
  mesh.name = name;
  mesh.renderOrder = renderOrder;
  group.add(mesh);

  if (debugWireframe) {
    const wire = new THREE.Mesh(merged.clone(), debugWireframe);
    wire.name = `${name}:wireframe`;
    wire.position.y += 0.08;
    wire.renderOrder = renderOrder + 0.5;
    group.add(wire);
  }

  for (const geometry of geometries) {
    if (geometry !== merged) geometry.dispose();
  }
}

interface GeometryBatch {
  material: THREE.Material;
  geometries: THREE.BufferGeometry[];
  renderOrder: number;
  name: string;
}

function pushGeometry(
  batches: Map<THREE.Material, GeometryBatch>,
  material: THREE.Material,
  geometry: THREE.BufferGeometry | null,
  renderOrder: number,
  name: string,
) {
  if (!geometry) return;
  const batch = batches.get(material);
  if (batch) {
    batch.geometries.push(geometry);
  } else {
    batches.set(material, { material, geometries: [geometry], renderOrder, name });
  }
}

function bridgeEndpoints(bridge: Bridge): { a: Point; b: Point } | null {
  const path = typeof bridge.path === 'string' ? bridge.path : '';
  const match = path.match(/M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+L\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return {
    a: { x: Number(match[1]), y: Number(match[2]) },
    b: { x: Number(match[3]), y: Number(match[4]) },
  };
}

export function createCityScene(model: CityMapRenderModel, debugState: CityMapDebugState) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  const materials = createCityMaterials();
  const debugWireframe = debugState.showTerrainDebug ? materials.debugWireframe : undefined;
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'city-map-terrain';
  scene.add(terrainGroup);

  const waterPlane = new THREE.Mesh(createMapPlane(model.world.width, model.world.height), materials.water);
  waterPlane.name = 'city-map-water-plane';
  waterPlane.renderOrder = 0;
  terrainGroup.add(waterPlane);
  if (debugWireframe) {
    const waterWire = new THREE.Mesh(createMapPlane(model.world.width, model.world.height), debugWireframe);
    waterWire.name = 'city-map-water-plane:wireframe';
    waterWire.position.y += 0.08;
    waterWire.renderOrder = 0.5;
    terrainGroup.add(waterWire);
  }

  addMesh(
    terrainGroup,
    createPolygonGeometry(model.terrain.visibleLandPolygon || model.terrain.landPolygon, terrainElevation(model.terrain.render, 0.03)),
    materials.terrain,
    'city-map-land',
    debugWireframe,
    1,
  );

  for (const body of model.terrain.waterBodies || []) {
    addMesh(
      terrainGroup,
      createPolygonGeometry(body.polygon, terrainElevation(body.render, 0.08)),
      materials.water,
      `city-map-water-body:${body.id}`,
      debugWireframe,
      2,
    );
  }

  for (const space of model.terrain.openSpaces || []) {
    addMesh(
      terrainGroup,
      createPolygonGeometry(space.polygon, terrainElevation(space.render, 0.11)),
      materialForOpenSpace(materials, space.render?.materialKey || space.type),
      `city-map-open-space:${space.id}`,
      debugWireframe,
      3,
    );
  }

  if (debugState.showRoads) {
    const roadsGroup = new THREE.Group();
    roadsGroup.name = 'city-map-roads';
    scene.add(roadsGroup);
    const roadBatches = new Map<THREE.Material, GeometryBatch>();

    for (const edge of model.roads) {
      if (edge.riverBank) continue;
      pushGeometry(
        roadBatches,
        materials.roadUnderlay,
        createRoadStripGeometry(edge, roadWidth(edge, true), 1.0),
        10,
        'city-map-road-underlay',
      );
    }

    for (const edge of model.roads) {
      pushGeometry(
        roadBatches,
        edge.riverBank ? materials.roadLocal : materialForRoad(materials, edge),
        createRoadStripGeometry(edge, edge.riverBank ? 0.34 : roadWidth(edge), 1.3),
        edge.riverBank ? 11 : 12,
        `city-map-road-${roadKind(edge)}`,
      );
    }

    for (const bridge of model.bridges) {
      const endpoints = bridgeEndpoints(bridge);
      if (!endpoints) continue;
      pushGeometry(
        roadBatches,
        materials.roadUnderlay,
        createSegmentStripGeometry(endpoints.a, endpoints.b, (bridge.render?.width ?? 2.4) + 1.2, 1.6),
        14,
        'city-map-bridge-underlay',
      );
      pushGeometry(
        roadBatches,
        materials.bridge,
        createSegmentStripGeometry(endpoints.a, endpoints.b, bridge.render?.width ?? 2.4, 1.9),
        15,
        'city-map-bridge',
      );
    }

    const orderedRoadBatches = [...roadBatches.values()].sort((a, b) => a.renderOrder - b.renderOrder);
    for (const batch of orderedRoadBatches) {
      addBatchedMesh(roadsGroup, batch.geometries, batch.material, batch.name, debugWireframe, batch.renderOrder);
    }
  }

  if (debugState.showBuildings) {
    const buildingsGroup = new THREE.Group();
    buildingsGroup.name = 'city-map-buildings';
    scene.add(buildingsGroup);
    const buildingBatches = new Map<THREE.Material, GeometryBatch>();

    for (const building of model.buildings) {
      pushGeometry(
        buildingBatches,
        materialForBuilding(materials, building),
        createBuildingGeometry(building),
        30,
        'city-map-buildings',
      );
    }

    for (const batch of buildingBatches.values()) {
      addBatchedMesh(buildingsGroup, batch.geometries, batch.material, `${batch.name}:${batch.material.uuid}`, debugWireframe, batch.renderOrder);
    }
  }

  const grid = new THREE.GridHelper(Math.max(model.world.width, model.world.height), 16, 0x2dfff0, 0x2dfff0);
  grid.position.set(model.world.width / 2, 0.42, model.world.height / 2);
  grid.material = materials.debugGrid;
  grid.name = 'city-map-debug-grid';
  grid.visible = debugState.showTerrainDebug;
  grid.renderOrder = 40;
  scene.add(grid);

  addCityLights(scene);

  return { scene, materials };
}

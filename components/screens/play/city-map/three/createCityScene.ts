import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Bridge, Building, Point, RoadEdge, TerrainRenderMeta } from '@/services/playgame/city-map';
import type { CityMapRenderModel } from '../render-model';
import type { CityMapDebugState } from '../CityMapDebugDock';
import { createBuildingGeometry, createMapPlane, createPolygonGeometry, createPolylineStripGeometry, createRoadStripGeometry, createSegmentStripGeometry, createSmoothPolygonGeometry } from './cityGeometry';
import { addCityLights } from './cityLights';
import { createCityMaterials } from './cityMaterials';

const BRIDGE_WIDTH_SCALE = 0.58;
const BASE_PLANE_OVERSCAN = 96;

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

function roadWidth(edge: RoadEdge) {
  switch (roadKind(edge)) {
    case 'highway':
      return 1.42;
    case 'avenue':
      return 1.05;
    case 'street':
      return 0.72;
    default:
      return 0.38;
  }
}

function roadRenderOrder(edge: RoadEdge) {
  if (edge.riverBank) return 21;
  switch (roadKind(edge)) {
    case 'highway':
      return 13;
    case 'avenue':
      return 12;
    case 'street':
      return 11;
    default:
      return 10;
  }
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

function terrainLandPolygons(model: CityMapRenderModel) {
  const landmasses = Array.isArray(model.terrain.landmasses)
    ? model.terrain.landmasses as Array<{ id?: string; polygon?: Point[]; render?: TerrainRenderMeta }>
    : [];
  if (landmasses.length) {
    return landmasses
      .map((landmass, index) => ({
        id: landmass.id || `landmass-${index + 1}`,
        polygon: landmass.polygon,
        render: landmass.render || model.terrain.render,
      }))
      .filter((landmass) => landmass.polygon?.length);
  }

  return [{
    id: 'land',
    polygon: model.terrain.visibleLandPolygon || model.terrain.landPolygon,
    render: model.terrain.render,
  }];
}

function smoothClosedPoints(points: readonly Point[], iterations = 2) {
  let smoothed = points.slice();
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next: Point[] = [];
    for (let i = 0; i < smoothed.length; i++) {
      const a = smoothed[i];
      const b = smoothed[(i + 1) % smoothed.length];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    smoothed = next;
  }
  return smoothed;
}

function cleanRenderPolygon(points: readonly Point[] | undefined) {
  if (!points || points.length < 3) return [];
  const cleaned: Point[] = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.hypot(previous.x - point.x, previous.y - point.y) > 0.001) cleaned.push(point);
  }
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) <= 0.001) cleaned.pop();
  return cleaned.length >= 3 ? cleaned : [];
}

function createLandOverlayMaterial(model: CityMapRenderModel, color = '#1f4267') {
  const maxTextureSize = 1024;
  const aspect = model.world.width / Math.max(1, model.world.height);
  const canvas = document.createElement('canvas');
  canvas.width = aspect >= 1 ? maxTextureSize : Math.max(1, Math.round(maxTextureSize * aspect));
  canvas.height = aspect >= 1 ? Math.max(1, Math.round(maxTextureSize / aspect)) : maxTextureSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(canvas.width / model.world.width, canvas.height / model.world.height);
  ctx.fillStyle = color;

  for (const landmass of terrainLandPolygons(model)) {
    const polygon = smoothClosedPoints(cleanRenderPolygon(landmass.polygon), 2);
    if (polygon.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (const point of polygon.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function createOverscanMapPlane(width: number, height: number, overscan = BASE_PLANE_OVERSCAN) {
  const geometry = new THREE.PlaneGeometry(width + overscan * 2, height + overscan * 2);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(width / 2, 0, height / 2);
  return geometry;
}

function createLandBorder(model: CityMapRenderModel) {
  const group = new THREE.Group();
  group.name = 'city-map-land-border';
  const material = new THREE.LineBasicMaterial({
    color: 0x79caff,
    transparent: true,
    opacity: 0.28,
    depthTest: false,
    depthWrite: false,
  });

  for (const landmass of terrainLandPolygons(model)) {
    const polygon = smoothClosedPoints(cleanRenderPolygon(landmass.polygon), 2);
    if (polygon.length < 3) continue;
    const points = [...polygon, polygon[0]].map((point) => new THREE.Vector3(point.x, 2.2, point.y));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 4;
    group.add(line);
  }

  return group.children.length ? group : null;
}

function waterBodyPolyline(body: Record<string, unknown>) {
  const segments = Array.isArray(body.segments)
    ? body.segments as Array<{ a?: Point; b?: Point }>
    : [];
  if (segments.length) {
    const points: Point[] = [];
    for (const segment of segments) {
      if (!segment.a || !segment.b) continue;
      if (!points.length) points.push(segment.a);
      points.push(segment.b);
    }
    if (points.length >= 2) return points;
  }

  if (Array.isArray(body.pts)) return body.pts as Point[];
  if (Array.isArray(body.points)) return body.points as Point[];
  return [];
}

function extendPolylineEnds(points: readonly Point[], distance: number) {
  if (points.length < 2 || distance <= 0) return points.slice();
  const extended = points.slice();
  const start = extended[0];
  const next = extended[1];
  const end = extended[extended.length - 1];
  const prev = extended[extended.length - 2];

  const startLen = Math.hypot(start.x - next.x, start.y - next.y) || 1;
  const endLen = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;

  extended[0] = {
    x: start.x + ((start.x - next.x) / startLen) * distance,
    y: start.y + ((start.y - next.y) / startLen) * distance,
  };
  extended[extended.length - 1] = {
    x: end.x + ((end.x - prev.x) / endLen) * distance,
    y: end.y + ((end.y - prev.y) / endLen) * distance,
  };
  return extended;
}

export function createCityScene(model: CityMapRenderModel, debugState: CityMapDebugState) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);

  const materials = createCityMaterials();
  const debugWireframe = debugState.showTerrainDebug ? materials.debugWireframe : undefined;
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'city-map-terrain';
  scene.add(terrainGroup);

  const waterPlane = new THREE.Mesh(createOverscanMapPlane(model.world.width, model.world.height), materials.water);
  waterPlane.name = 'city-map-water-plane';
  waterPlane.renderOrder = 0;
  terrainGroup.add(waterPlane);
  if (debugWireframe) {
    const waterWire = new THREE.Mesh(createOverscanMapPlane(model.world.width, model.world.height), debugWireframe);
    waterWire.name = 'city-map-water-plane:wireframe';
    waterWire.position.y += 0.08;
    waterWire.renderOrder = 0.5;
    terrainGroup.add(waterWire);
  }

  const landOverlayMaterial = createLandOverlayMaterial(model);
  if (landOverlayMaterial) {
    const landPlane = new THREE.Mesh(createMapPlane(model.world.width, model.world.height), landOverlayMaterial);
    landPlane.name = 'city-map-land-overlay';
    landPlane.position.y = terrainElevation(model.terrain.render, 0.03);
    landPlane.renderOrder = 1;
    terrainGroup.add(landPlane);
  }

  const landBorder = createLandBorder(model);
  if (landBorder) terrainGroup.add(landBorder);

  const blockBaseGroup = new THREE.Group();
  blockBaseGroup.name = 'city-map-block-bases';
  scene.add(blockBaseGroup);
  const blockBaseGeometries = model.blocks
    .map((block) => createPolygonGeometry(block.polygon, 1.08))
    .filter((geometry): geometry is THREE.BufferGeometry => !!geometry);
  addBatchedMesh(blockBaseGroup, blockBaseGeometries, materials.blockBase, 'city-map-block-bases', debugWireframe, 6);

  if (debugState.showTerrainDebug) {
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
  }

  if (debugState.showRoads) {
    const roadsGroup = new THREE.Group();
    roadsGroup.name = 'city-map-roads';
    scene.add(roadsGroup);
    const roadBatches = new Map<THREE.Material, GeometryBatch>();

    for (const edge of model.roads) {
      pushGeometry(
        roadBatches,
        edge.riverBank ? materials.roadLocal : materialForRoad(materials, edge),
        createRoadStripGeometry(edge, edge.riverBank ? 0.18 : roadWidth(edge), edge.riverBank ? 1.8 : 1.24),
        roadRenderOrder(edge),
        `city-map-road-${roadKind(edge)}`,
      );
    }

    for (const bridge of model.bridges) {
      const endpoints = bridgeEndpoints(bridge);
      if (!endpoints) continue;
      const bridgeWidth = (bridge.render?.width ?? 2.4) * BRIDGE_WIDTH_SCALE;
      pushGeometry(
        roadBatches,
        materials.bridge,
        createSegmentStripGeometry(endpoints.a, endpoints.b, bridgeWidth, 2.0),
        22,
        'city-map-bridge',
      );
    }

    const orderedRoadBatches = [...roadBatches.values()].sort((a, b) => a.renderOrder - b.renderOrder);
    for (const batch of orderedRoadBatches) {
      addBatchedMesh(roadsGroup, batch.geometries, batch.material, batch.name, debugWireframe, batch.renderOrder);
    }
  }

  if (debugState.showRoadCorridors) {
    const corridorGroup = new THREE.Group();
    corridorGroup.name = 'city-map-road-corridors-debug';
    scene.add(corridorGroup);
    const corridorGeometries = model.roads
      .map((edge) => createPolygonGeometry(edge.corridorPolygon, 1.18))
      .filter((geometry): geometry is THREE.BufferGeometry => !!geometry);
    addBatchedMesh(corridorGroup, corridorGeometries, materials.roadCorridorDebug, 'city-map-road-corridors-debug', undefined, 9);
  }

  const waterFeaturesGroup = new THREE.Group();
  waterFeaturesGroup.name = 'city-map-water-features';
  scene.add(waterFeaturesGroup);
  const waterBatches = new Map<THREE.Material, GeometryBatch>();
  for (const body of model.terrain.waterBodies || []) {
    if (body.kind === 'ocean') continue;
    const polygonGeometry = createSmoothPolygonGeometry(body.polygon, terrainElevation(body.render, 0.08), 2);
    const riverWidth = Math.max(1.4, (Number(body.outerWidth) || 7) + 2);
    const riverPolyline = extendPolylineEnds(waterBodyPolyline(body), riverWidth * 0.65);
    const riverGeometry = polygonGeometry
      ? null
      : createPolylineStripGeometry(riverPolyline, riverWidth, 1.55);
    pushGeometry(
      waterBatches,
      materials.river,
      polygonGeometry || riverGeometry,
      20,
      `city-map-water-body:${body.id}`,
    );
  }
  for (const batch of waterBatches.values()) {
    addBatchedMesh(waterFeaturesGroup, batch.geometries, batch.material, batch.name, debugWireframe, batch.renderOrder);
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

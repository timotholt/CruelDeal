import { strict as assert } from 'node:assert';
import { buildCityV35 } from '../index';
import type { Building, CityMap, RoadEdge } from '../types';

function assertFiniteRange(value: number, min: number, max: number, label: string) {
  assert.ok(Number.isFinite(value), `${label} is finite`);
  assert.ok(value >= min && value <= max, `${label} is between ${min} and ${max}: ${value}`);
}

function buildings(city: CityMap): Building[] {
  return [...(city.buildingPlan.buildings || []), ...(city.buildingPlan.landmarks || [])];
}

function roads(city: CityMap): RoadEdge[] {
  return city.roadGraph.edges || [];
}

const seed = 'city-map-render-metadata-seed';
const a = buildCityV35(seed, { cache: false });
const b = buildCityV35(seed, { cache: false });

assert.deepEqual(
  buildings(a).map((building) => [building.id, building.render]),
  buildings(b).map((building) => [building.id, building.render]),
  'building render metadata is deterministic',
);

assert.deepEqual(
  roads(a).map((road) => [road.id, road.render]),
  roads(b).map((road) => [road.id, road.render]),
  'road render metadata is deterministic',
);

assert.ok(a.terrain.render, 'terrain has render metadata');
assert.equal(a.terrain.render?.materialKey, 'land');
assertFiniteRange(a.terrain.render?.elevation ?? NaN, -1, 1, 'terrain elevation');

for (const body of a.terrain.waterBodies || []) {
  assert.ok(body.render, `water body ${body.id} has render metadata`);
  assert.equal(body.render?.materialKey, 'water');
  assertFiniteRange(body.render?.elevation ?? NaN, -1, 1, `water body ${body.id} elevation`);
}

const cityBuildings = buildings(a);
assert.ok(cityBuildings.length > 0, 'city has buildings');
const lodGroups = new Set<string>();
for (const building of cityBuildings) {
  assert.ok(building.render, `building ${building.id} has render metadata`);
  assertFiniteRange(building.render?.height ?? NaN, 0, 80, `building ${building.id} height`);
  assertFiniteRange(building.render?.baseElevation ?? NaN, -1, 4, `building ${building.id} baseElevation`);
  assertFiniteRange(building.render?.emissiveStrength ?? NaN, 0, 1, `building ${building.id} emissiveStrength`);
  assertFiniteRange(building.render?.windowDensity ?? NaN, 0, 1, `building ${building.id} windowDensity`);
  assertFiniteRange(building.render?.shadowImportance ?? NaN, 0, 1, `building ${building.id} shadowImportance`);
  lodGroups.add(building.render!.lodGroup);
}
assert.ok(lodGroups.has('lowrise') || lodGroups.has('micro'), 'building metadata includes small building LOD');
assert.ok(lodGroups.has('midrise') || lodGroups.has('tower') || cityBuildings.length < 8, 'building metadata includes vertical variety when enough buildings exist');

const cityRoads = roads(a);
assert.ok(cityRoads.length > 0, 'city has roads');
for (const road of cityRoads) {
  assert.ok(road.render, `road ${road.id} has render metadata`);
  assertFiniteRange(road.render?.width ?? NaN, 0.1, 10, `road ${road.id} width`);
  assertFiniteRange(road.render?.elevation ?? NaN, -1, 4, `road ${road.id} elevation`);
  assertFiniteRange(road.render?.glowStrength ?? NaN, 0, 1, `road ${road.id} glowStrength`);
}

for (const bridge of a.bridgePlan.bridges || []) {
  assert.ok(bridge.render, `bridge ${bridge.id} has render metadata`);
  assert.equal(bridge.render?.materialKey, 'bridge');
  assertFiniteRange(bridge.render?.width ?? NaN, 0.1, 10, `bridge ${bridge.id} width`);
}

console.log('city-map render metadata ok');


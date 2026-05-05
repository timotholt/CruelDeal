import { strict as assert } from 'node:assert';
import { pointInPolygon, polygonArea } from '../geometry';
import { buildCityV35 } from '../index';
import { polygonBoolean } from '../polygon-boolean';
import {
  attachPM2001RoadMetadata,
  physicalRoadWidthForClass,
  roadCorridorPolygon,
} from '../pm2001';
import { URBAN_SCALE } from '../urban-units';
import type { Point, RoadEdge } from '../types';

function rect(x1: number, y1: number, x2: number, y2: number): Point[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

{
  assert.equal(physicalRoadWidthForClass('highway'), URBAN_SCALE.roads.highwayCorridor, 'highway width uses urban scale');
  assert.equal(physicalRoadWidthForClass('avenue'), URBAN_SCALE.roads.majorCorridor, 'avenue width uses urban scale');
  assert.equal(physicalRoadWidthForClass('street'), URBAN_SCALE.roads.minorCorridor, 'street width uses urban scale');
  assert.equal(physicalRoadWidthForClass('local'), URBAN_SCALE.roads.localCorridor, 'local width uses urban scale');
  assert.equal(physicalRoadWidthForClass('service'), URBAN_SCALE.roads.serviceCorridor, 'service width uses urban scale');
}

{
  const edge: RoadEdge = {
    id: 'road:test',
    kind: 'street',
    a: { x: 0, y: 0 },
    b: { x: 40, y: 0 },
  };
  attachPM2001RoadMetadata([edge]);
  const corridor = roadCorridorPolygon(edge);
  assert.equal(edge.physicalWidth, URBAN_SCALE.roads.minorCorridor, 'street edge gets physical width metadata');
  assert.ok(corridor.length >= 4, 'road corridor creates polygon');
  assert.ok(Math.abs(polygonArea(corridor) - (40 + URBAN_SCALE.roads.minorCorridor) * URBAN_SCALE.roads.minorCorridor) < 0.1, 'straight corridor area includes square road caps');
}

{
  const district = rect(0, 0, 100, 100);
  const vertical = rect(46, -10, 54, 110);
  const horizontal = rect(-10, 46, 110, 54);
  const roadMask = polygonBoolean.union([vertical, horizontal]);
  const faces = polygonBoolean.difference([district], roadMask);
  assert.ok(roadMask.length >= 1, 'intersecting roads union into a mask');
  assert.ok(faces.length >= 4, 'cross road mask splits district into block faces');
  assert.ok(faces.every((face) => !pointInPolygon({ x: 50, y: 50 }, face)), 'block faces exclude road center');
}

{
  const city = buildCityV35('pm2001-road-face-seed', {
    cache: false,
    roadBlockModel: 'pm2001-road-faces',
  });
  const blocks = city.cells || [];
  const pmBlocks = blocks.filter((block) => String((block as any).source) === 'pm2001-road-face');
  assert.ok(pmBlocks.length > 0, 'pm2001 option produces road-face blocks');
  assert.ok(city.roadGraph.edges.every((edge) => typeof edge.physicalWidth === 'number'), 'every road has physical width metadata');
  assert.ok(city.roadGraph.edges.some((edge) => Array.isArray(edge.corridorPolygon) && edge.corridorPolygon.length >= 3), 'road corridors are attached to road edges');
  assert.ok((city.roadGraph as any).roadCorridors?.length > 0, 'road graph exposes road corridors');

  const badRoadSamples = pmBlocks.flatMap((block) =>
    city.roadGraph.edges.filter((edge) => edge.source !== 'coast-road').flatMap((edge) => {
      const points = edge.centerline || (edge as RoadEdge & { points?: Point[] }).points || [edge.a, edge.b];
      return points
        .filter((point) => pointInPolygon(point, block.polygon))
        .map((point) => ({ blockId: block.id, roadId: edge.id, point }));
    }),
  );
  assert.deepEqual(badRoadSamples, [], 'road-face blocks exclude road centerline samples');

  const buildingsWithBadIds = (city.buildingPlan.buildings || [])
    .filter((building) => !building.blockId || !building.parcelId)
    .map((building) => building.id);
  assert.deepEqual(buildingsWithBadIds, [], 'pm2001 buildings keep blockId and parcelId');
}

console.log('city-map pm2001 road/block tests passed');

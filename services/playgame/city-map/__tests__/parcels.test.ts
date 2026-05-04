import { strict as assert } from 'node:assert';
import { polygonArea } from '../geometry';
import { analyzeBlockFrontage, type BuildingBlockProfile, type RoadHazard } from '../planning';
import { subdivideBlockIntoParcels } from '../parcels';
import { URBAN_SCALE } from '../urban-units';
import type { CityBlock, CityParcel, Point } from '../types';

const rng = () => 0.42;

function hazard(roadId: string, a: Point, b: Point, valueWeight = 5): RoadHazard {
  return {
    roadId,
    roadClass: valueWeight >= 6 ? 'MAJOR_ROAD' : 'MINOR_ROAD',
    valueWeight,
    a,
    b,
    buffer: 1,
    priority: valueWeight,
    width: 2,
    kind: valueWeight >= 6 ? 'avenue' : 'street',
  };
}

const block: CityBlock & Record<string, any> = {
  id: 'block:test',
  districtId: 'district:test',
  buildable: true,
  polygon: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
  ],
  area: 5000,
  centroid: { x: 50, y: 25 },
};

const profile: BuildingBlockProfile = {
  use: 'commercial_office',
  age: 'new',
  frontageDivisionCount: 4,
  frontageAngle: 0,
  frontageRoadIds: ['road:bottom'],
  allFrontageRoadIds: ['road:bottom'],
  frontageRoadClass: 'MAJOR_ROAD',
  frontageLength: 100,
  frontageScore: 600,
};

function parcelize(roadHazards: RoadHazard[]) {
  const frontage = analyzeBlockFrontage(block, roadHazards);
  return subdivideBlockIntoParcels(block, profile, frontage, rng, { roadHazards });
}

function roadIdUnion(parcels: CityParcel[]) {
  return new Set(parcels.flatMap((parcel) => parcel.frontageRoadIds || []));
}

{
  const parcels = parcelize([
    hazard('road:bottom', { x: -20, y: 0 }, { x: 120, y: 0 }, 6),
  ]);
  assert.ok(parcels.some((parcel) => parcel.generationKind === 'frontage-strip'), 'one-front block creates frontage-strip parcels');
  assert.ok(parcels.some((parcel) => parcel.generationKind === 'interior-obb'), 'one-front block creates interior remainder parcels');
  assert.ok(parcels.every((parcel) => parcel.parentBlockArea === block.area), 'parcels keep parent block area metadata');
}

{
  const parcels = parcelize([
    hazard('road:bottom', { x: -20, y: 0 }, { x: 120, y: 0 }, 6),
    hazard('road:left', { x: 0, y: -20 }, { x: 0, y: 70 }, 6),
  ]);
  const corner = parcels.find((parcel) => parcel.generationKind === 'corner-frontage');
  assert.ok(corner, 'corner block creates a corner-frontage parcel');
  assert.deepEqual(new Set(corner?.frontageRoadIds || []), new Set(['road:bottom', 'road:left']), 'corner parcel keeps both road IDs');
}

{
  const parcels = parcelize([
    hazard('road:bottom', { x: -20, y: 0 }, { x: 120, y: 0 }, 6),
    hazard('road:left', { x: 0, y: -20 }, { x: 0, y: 70 }, 6),
    hazard('road:right', { x: 100, y: -20 }, { x: 100, y: 70 }, 6),
  ]);
  assert.deepEqual(roadIdUnion(parcels), new Set(['road:bottom', 'road:left', 'road:right']), '3-front blocks preserve every frontage road ID');
}

{
  const parcels = parcelize([
    hazard('road:bottom', { x: -20, y: 0 }, { x: 120, y: 0 }, 6),
    hazard('road:left', { x: 0, y: -20 }, { x: 0, y: 70 }, 6),
    hazard('road:right', { x: 100, y: -20 }, { x: 100, y: 70 }, 6),
    hazard('road:top', { x: -20, y: 50 }, { x: 120, y: 50 }, 6),
  ]);
  assert.deepEqual(roadIdUnion(parcels), new Set(['road:bottom', 'road:left', 'road:right', 'road:top']), '4-front blocks preserve every frontage road ID');
}

{
  const a = parcelize([
    hazard('road:bottom', { x: -20, y: 0 }, { x: 120, y: 0 }, 6),
    hazard('road:left', { x: 0, y: -20 }, { x: 0, y: 70 }, 6),
  ]);
  const b = parcelize([
    hazard('road:bottom', { x: -20, y: 0 }, { x: 120, y: 0 }, 6),
    hazard('road:left', { x: 0, y: -20 }, { x: 0, y: 70 }, 6),
  ]);
  assert.deepEqual(
    a.map((parcel) => [parcel.id, parcel.generationKind, Math.round(polygonArea(parcel.polygon))]),
    b.map((parcel) => [parcel.id, parcel.generationKind, Math.round(polygonArea(parcel.polygon))]),
    'parcelization is deterministic for the same inputs',
  );
}

{
  const parcels = parcelize([
    hazard('road:bottom', { x: -20, y: 0 }, { x: 120, y: 0 }, 6),
    hazard('road:left', { x: 0, y: -20 }, { x: 0, y: 70 }, 6),
    hazard('road:right', { x: 100, y: -20 }, { x: 100, y: 70 }, 6),
    hazard('road:top', { x: -20, y: 50 }, { x: 120, y: 50 }, 6),
  ]);
  const badSmallParcels = parcels.filter((parcel) =>
    (parcel.area || 0) < URBAN_SCALE.parcels.minBuildableArea &&
    !['patio', 'service', 'merge-recovery'].includes(String(parcel.generationKind)),
  );
  assert.deepEqual(badSmallParcels.map((parcel) => [parcel.id, parcel.generationKind, parcel.area]), [], 'tiny parcels are recovery/open-space/service only');
}

console.log('city-map parcelizer tests passed');

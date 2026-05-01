import { buildCityV35, summarizeCityV35 } from '../index';
import type { Building, CityMap, CitySlot, Venue } from '../types';

const pass = (label: string) => console.log(`PASS: ${label}`);
const fail = (label: string, extra?: unknown): never => {
  console.error(`FAIL: ${label}`);
  if (extra !== undefined) console.error(extra);
  process.exitCode = 1;
  throw new Error(label);
};

const expectEq = <T>(actual: T, expected: T, label: string) =>
  JSON.stringify(actual) === JSON.stringify(expected) ? pass(label) : fail(label, { actual, expected });
const expectTrue = (cond: boolean, label: string, extra?: unknown) => cond ? pass(label) : fail(label, extra);

type Snapped = {
  id: string;
  snapEdgeId?: string | null;
  snapCandidates?: Array<{ edgeId?: string | null }>;
};

const seeds = ['city-map-unit-seed', 'city-map-unit-seed-alt'];

const activeSlots = (city: CityMap): CitySlot[] =>
  city.districts.flatMap((district) => district.slots || [])
    .filter((slot) => slot.playableBy !== null && slot.playableBy !== undefined);

const slotSnapshot = (city: CityMap) =>
  activeSlots(city).map((slot) => ({
    id: slot.id,
    venueId: slot.venueId,
  }));

const venueSnapshot = (city: CityMap) =>
  city.venues.map((venue) => venue.id);

const assertVenueIndex = (city: CityMap, label: string) => {
  const missingFromIndex = city.venues.filter((venue) => city.venueById[venue.id] !== venue);
  expectEq(missingFromIndex.map((venue) => venue.id), [], `${label}: every venue id resolves in venueById`);
};

const assertActiveSlots = (city: CityMap, label: string) => {
  const slots = activeSlots(city);
  expectTrue(slots.length > 0, `${label}: generated active slots`, { slots: slots.length });

  const unbackedSlots = slots.filter((slot) => !slot.venueId || !city.venueById[slot.venueId]);
  expectEq(
    unbackedSlots.map((slot) => ({ id: slot.id, venueId: slot.venueId ?? null })),
    [],
    `${label}: every active slot has a valid venueId after venue enrichment`,
  );

  const outOfBounds = slots.filter((slot) =>
    slot.x < 0 || slot.x > city.width || slot.y < 0 || slot.y > city.height,
  );
  expectEq(
    outOfBounds.map((slot) => ({ id: slot.id, x: slot.x, y: slot.y, width: city.width, height: city.height })),
    [],
    `${label}: no active slot is outside board bounds`,
  );
};

const assertNoDanglingSnapEdges = (city: CityMap, label: string) => {
  const edgeIds = new Set((city.roadGraph?.edges || []).map((edge) => edge.id));
  expectTrue(edgeIds.size > 0, `${label}: generated road edges`, { edges: edgeIds.size });

  const danglingSnapEdgeIds = (items: Snapped[]) => items
    .filter((item) => item.snapEdgeId && !edgeIds.has(item.snapEdgeId))
    .map((item) => ({ id: item.id, snapEdgeId: item.snapEdgeId }));
  const danglingCandidateEdgeIds = (items: Snapped[]) => items
    .flatMap((item) => (item.snapCandidates || [])
      .filter((candidate) => candidate.edgeId && !edgeIds.has(candidate.edgeId))
      .map((candidate) => ({ id: item.id, edgeId: candidate.edgeId })));

  const slots = activeSlots(city) as Snapped[];
  const buildings = (city.buildingPlan?.buildings || []) as Array<Building & Snapped>;
  const venues = (city.venues || []) as Array<Venue & Snapped>;

  expectEq(danglingSnapEdgeIds(slots), [], `${label}: slot snapEdgeId values resolve to road edges`);
  expectEq(danglingCandidateEdgeIds(slots), [], `${label}: slot snapCandidates edgeIds resolve to road edges`);
  expectEq(danglingSnapEdgeIds(buildings), [], `${label}: building snapEdgeId values resolve to road edges`);
  expectEq(danglingCandidateEdgeIds(buildings), [], `${label}: building snapCandidates edgeIds resolve to road edges`);
  expectEq(danglingSnapEdgeIds(venues), [], `${label}: venue snapEdgeId values resolve to road edges`);
  expectEq(danglingCandidateEdgeIds(venues), [], `${label}: venue snapCandidates edgeIds resolve to road edges`);
};

const assertRenderableBridges = (city: CityMap, label: string) => {
  const bridges = city.bridgePlan?.bridges || [];
  expectTrue(bridges.length > 0, `${label}: generated bridge plan`, { bridges: bridges.length });
  const invisible = bridges
    .filter((bridge) => !bridge.path || !bridge.center || typeof bridge.deckWidth !== 'number')
    .map((bridge) => ({ id: bridge.id, path: bridge.path, center: bridge.center, deckWidth: bridge.deckWidth }));
  expectEq(invisible, [], `${label}: every bridge has render geometry`);
};

{
  const seed = seeds[0];
  const a = buildCityV35(seed, { cache: false });
  const b = buildCityV35(seed, { cache: false });

  expectTrue(a !== b, 'cache:false returns distinct city objects for determinism smoke test');
  expectEq(summarizeCityV35(a), summarizeCityV35(b), 'same seed returns same summary');
  expectEq(slotSnapshot(a), slotSnapshot(b), 'same seed returns same slot ids and venue ids');
  expectEq(venueSnapshot(a), venueSnapshot(b), 'same seed returns same venue ids');
}

for (const seed of seeds) {
  const city = buildCityV35(seed, { cache: false });
  const label = `seed ${seed}`;
  assertVenueIndex(city, label);
  assertActiveSlots(city, label);
  assertNoDanglingSnapEdges(city, label);
  assertRenderableBridges(city, label);
}

console.log('\nAll city v35 map tests passed.');

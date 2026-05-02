import { strict as assert } from 'node:assert';
import type { CitySlot, DistrictLandmark } from '@/services/playgame/city-map';
import { nearestHoverLandmark, nearestHoverSlot, placeVenueTooltip } from '../useCityMapHover';

const slots: CitySlot[] = [
  { id: 'a', districtId: 'd', slotIndex: 0, x: 10, y: 10, venueId: 'va' },
  { id: 'b', districtId: 'd', slotIndex: 1, x: 40, y: 10, venueId: 'vb' },
];

assert.equal(nearestHoverSlot({ x: 12, y: 11 }, slots)?.id, 'a');
assert.equal(nearestHoverSlot({ x: 30, y: 10 }, slots, 18)?.id, 'b');
assert.equal(nearestHoverSlot({ x: 200, y: 200 }, slots), null);

const landmarks: DistrictLandmark[] = [
  {
    id: 'lm-a',
    districtId: 'd',
    source: 'building',
    sourceId: 'b-a',
    type: 'market',
    typeLabel: 'Market',
    iconKey: 'market',
    name: 'Night Market',
    accentColor: '#7ce0ff',
    timing: 'on-reveal',
    effectPlaceholder: 'Placeholder On Reveal effect.',
    centroid: { x: 80, y: 80 },
  },
  {
    id: 'lm-b',
    districtId: 'd',
    source: 'openSpace',
    sourceId: 'p-b',
    type: 'plaza',
    typeLabel: 'Plaza',
    iconKey: 'plaza',
    name: 'Static Plaza',
    accentColor: '#ffd05d',
    timing: 'ongoing',
    effectPlaceholder: 'Placeholder Ongoing effect.',
    centroid: { x: 120, y: 80 },
  },
];

assert.equal(nearestHoverLandmark({ x: 82, y: 81 }, landmarks)?.id, 'lm-a');
assert.equal(nearestHoverLandmark({ x: 104, y: 80 }, landmarks, 18)?.id, 'lm-b');
assert.equal(nearestHoverLandmark({ x: 10, y: 10 }, landmarks), null);

const board = { width: 320, height: 180 };
const top = placeVenueTooltip({ x: 12, y: 8 }, board);
assert.equal(top.placement, 'below');
assert.ok(top.x >= 8);
assert.ok(top.y >= 8);
assert.ok(top.x + top.width <= board.width - 8);
assert.ok(top.y + top.height <= board.height - 8);
assert.equal(top.connectorStart.y, top.y + top.height);

const bottom = placeVenueTooltip({ x: 300, y: 174 }, board);
assert.equal(bottom.placement, 'above');
assert.ok(bottom.x + bottom.width <= board.width - 8);
assert.ok(bottom.y + bottom.height < 174);
assert.equal(bottom.connectorEnd.x, 300);
assert.equal(bottom.connectorEnd.y, 174);

const small = placeVenueTooltip({ x: 16, y: 16 }, { width: 120, height: 72 });
assert.ok(small.x >= 8);
assert.ok(small.y >= 8);
assert.ok(small.x + small.width <= 112);
assert.ok(small.y + small.height <= 64);
assert.equal(small.connectorStart.y, small.y + small.height);

console.log('hover-tooltip helpers ok');

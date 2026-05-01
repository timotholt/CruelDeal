import { strict as assert } from 'node:assert';
import type { CitySlot } from '@/services/playgame/city-map';
import { nearestHoverSlot, placeVenueTooltip } from '../useCityMapHover';

const slots: CitySlot[] = [
  { id: 'a', districtId: 'd', slotIndex: 0, x: 10, y: 10, venueId: 'va' },
  { id: 'b', districtId: 'd', slotIndex: 1, x: 40, y: 10, venueId: 'vb' },
];

assert.equal(nearestHoverSlot({ x: 12, y: 11 }, slots)?.id, 'a');
assert.equal(nearestHoverSlot({ x: 30, y: 10 }, slots, 18)?.id, 'b');
assert.equal(nearestHoverSlot({ x: 200, y: 200 }, slots), null);

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

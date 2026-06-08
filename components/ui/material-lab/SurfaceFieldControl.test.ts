import assert from 'node:assert/strict';
import { surfaceSliderStopIndex } from './SurfaceFieldControl';

const stops = [64, 128, 256, 512, 1024, 2048, 4096];

assert.equal(surfaceSliderStopIndex(stops, 64), 0);
assert.equal(surfaceSliderStopIndex(stops, 256), 2);
assert.equal(surfaceSliderStopIndex(stops, 300), 2);
assert.equal(surfaceSliderStopIndex(stops, 900), 4);
assert.equal(surfaceSliderStopIndex(stops, 4096), 6);
assert.equal(surfaceSliderStopIndex([], 256), 0);

console.log('Surface field control tests passed');

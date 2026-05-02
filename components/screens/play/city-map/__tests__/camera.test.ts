import { strict as assert } from 'node:assert';
import {
  cameraToViewport,
  clampCamera,
  createInitialCityMapCamera,
  panCameraByScreenDelta,
  screenToWorld,
  zoomCameraAt,
} from '../camera';

const world = { width: 360, height: 448 };
const rect = {
  left: 0,
  top: 0,
  width: 360,
  height: 448,
  right: 360,
  bottom: 448,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

const camera = createInitialCityMapCamera(world);
assert.deepEqual(camera.center, { x: 180, y: 224 });
assert.equal(camera.zoom, 1);

const fullViewport = cameraToViewport(camera, world, world.width / world.height);
assert.equal(fullViewport.x, 0);
assert.equal(fullViewport.y, 0);
assert.equal(fullViewport.width, 360);
assert.equal(fullViewport.height, 448);

assert.deepEqual(screenToWorld({ x: 180, y: 224 }, rect, fullViewport), { x: 180, y: 224 });
assert.deepEqual(screenToWorld({ x: 0, y: 0 }, rect, fullViewport), { x: 0, y: 0 });
assert.deepEqual(screenToWorld({ x: 360, y: 448 }, rect, fullViewport), { x: 360, y: 448 });

const zoomed = zoomCameraAt(camera, { x: 90, y: 112 }, { x: 0.25, y: 0.25 }, 2, world, world.width / world.height);
const zoomedViewport = cameraToViewport(zoomed, world, world.width / world.height);
assert.equal(zoomed.zoom, 2);
assert.equal(screenToWorld({ x: 90, y: 112 }, rect, zoomedViewport).x, 90);
assert.equal(screenToWorld({ x: 90, y: 112 }, rect, zoomedViewport).y, 112);

const panned = panCameraByScreenDelta(zoomed, { x: 36, y: 44.8 }, rect, zoomedViewport, world, world.width / world.height);
assert.ok(panned.center.x < zoomed.center.x);
assert.ok(panned.center.y < zoomed.center.y);

const clamped = clampCamera({
  ...camera,
  zoom: 3,
  center: { x: -100, y: 999 },
}, world, world.width / world.height);
const clampedViewport = cameraToViewport(clamped, world, world.width / world.height);
assert.ok(clampedViewport.x >= -0.000001);
assert.ok(clampedViewport.y + clampedViewport.height <= world.height + 0.000001);

console.log('city-map camera helpers ok');

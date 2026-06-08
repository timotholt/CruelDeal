import assert from 'node:assert/strict';
import type { RegisteredDomAuditTarget } from './mainMaterialDomRegistry';
import {
  boundedEmissionInspectorPosition,
  createEmptyDomClassKeys,
  queueMainMaterialDomAuditRefresh,
  refreshMainMaterialDomAudit,
  toggleDomClassKey,
} from './mainMaterialEmissionController';

(globalThis as unknown as { Node: { TEXT_NODE: number } }).Node = { TEXT_NODE: 3 };

const emptyKeys = createEmptyDomClassKeys();
assert.equal(emptyKeys.size, 0);

const hidden = toggleDomClassKey(emptyKeys, '0:class:cd-button', 'cd-button');
assert.equal(hidden.keys.has('0:class:cd-button'), true);
assert.equal(hidden.status, 'Hid class cd-button in inspector');
const restored = toggleDomClassKey(hidden.keys, '0:class:cd-button', 'cd-button');
assert.equal(restored.keys.has('0:class:cd-button'), false);
assert.equal(restored.status, 'Restored class cd-button');

assert.deepEqual(
  boundedEmissionInspectorPosition({
    pointer: { x: 500, y: 220 },
    offset: { x: 40, y: 20 },
    viewport: { width: 900, height: 600 },
    open: true,
  }),
  { x: 460, y: 200 },
);
assert.deepEqual(
  boundedEmissionInspectorPosition({
    pointer: { x: 20, y: 10 },
    offset: { x: 40, y: 20 },
    viewport: { width: 400, height: 80 },
    open: false,
  }),
  { x: 8, y: 8 },
);

const callbacks: Array<() => void> = [];
const reports: boolean[] = [];
let canceledFrame = 0;
let nextFrame = 0;
const cancel = queueMainMaterialDomAuditRefresh({
  targetId: 'feed:card:card_type_01:node:cta',
  hiddenClasses: emptyKeys,
  maxAttempts: 3,
  selectedTargetId: () => 'feed:card:card_type_01:node:cta',
  refresh: (_targetId, _hiddenClasses, reportMissing) => {
    reports.push(reportMissing);
    return false;
  },
  requestFrame: (callback) => {
    callbacks.push(callback);
    nextFrame += 1;
    return nextFrame;
  },
  cancelFrame: (frame) => {
    canceledFrame = frame;
  },
});
callbacks.shift()?.();
callbacks.shift()?.();
callbacks.shift()?.();
assert.deepEqual(reports, [false, false, true]);
cancel();
assert.equal(canceledFrame, 3);

let staleRefreshes = 0;
const staleCallbacks: Array<() => void> = [];
queueMainMaterialDomAuditRefresh({
  targetId: 'target-a',
  hiddenClasses: emptyKeys,
  selectedTargetId: () => 'target-b',
  refresh: () => {
    staleRefreshes += 1;
    return true;
  },
  requestFrame: (callback) => {
    staleCallbacks.push(callback);
    return staleCallbacks.length;
  },
  cancelFrame: () => {},
});
staleCallbacks.shift()?.();
assert.equal(staleRefreshes, 0);

const fakeElement = {
  tagName: 'BUTTON',
  classList: ['cd-button'],
  attributes: [{ name: 'data-material-role', value: 'button' }],
  childNodes: [{ nodeType: 3, textContent: 'Launch' }],
  children: [],
  getAttribute: (name: string) => (name === 'style' ? '--surface-fill: #fff;' : null),
} as unknown as HTMLElement;

let snapshotTag = '';
let status = '';
let cleared = false;
const exactMatch: RegisteredDomAuditTarget = {
  exact: true,
  entry: {
    targetId: 'feed:card:card_type_01:node:cta',
    instanceId: 'material_00001',
    element: fakeElement,
  },
};
assert.equal(refreshMainMaterialDomAudit({
  targetId: 'feed:card:card_type_01:node:cta',
  hiddenClasses: emptyKeys,
  findTarget: () => exactMatch,
  collectClassCssRules: () => [],
  setSnapshot: (snapshot) => {
    snapshotTag = snapshot?.tag || '';
  },
  setStatus: (next) => {
    status = next;
  },
  clearMissingStatus: () => {
    cleared = true;
  },
}), true);
assert.equal(snapshotTag, 'button');
assert.equal(status, '');
assert.equal(cleared, true);

assert.equal(refreshMainMaterialDomAudit({
  targetId: 'missing-target',
  hiddenClasses: emptyKeys,
  findTarget: () => null,
  collectClassCssRules: () => [],
  setSnapshot: (snapshot) => {
    snapshotTag = snapshot?.tag || '';
  },
  setStatus: (next) => {
    status = next;
  },
  clearMissingStatus: () => {},
}), false);
assert.equal(snapshotTag, '');
assert.equal(status, 'No live DOM node for missing-target');

console.log('Main material emission controller tests passed');

import assert from 'node:assert/strict';
import type { MaterialEmissionPlan } from '../../ui/material-lab';
import {
  mainMaterialCompatibilityExportSnapshot,
} from './mainMaterialCompatibilityExport';

const emptySnapshot = mainMaterialCompatibilityExportSnapshot(null);
assert.equal(emptySnapshot.source, null);
assert.equal(emptySnapshot.result, null);
assert.equal(emptySnapshot.plan, null);
assert.equal(emptySnapshot.domSnapshot, null);
assert.equal(emptySnapshot.html, '');
assert.equal(emptySnapshot.css, '');
assert.deepEqual(emptySnapshot.metrics, {
  nodeCount: 0,
  classCount: 0,
  attrCount: 0,
  styleCount: 0,
  cssVariableCount: 0,
});

const plan: MaterialEmissionPlan = {
  mode: 'export',
  host: { tag: 'button', classNames: ['cd-button'], children: [{ text: 'Launch' }] },
  layers: [{
    id: 'edge',
    label: 'Edge',
    active: true,
    reason: 'edge enabled',
    emission: {
      classNames: ['cd-surface-edge'],
      attrs: { 'data-emission': true },
      style: { '--edge-opacity': 0.8 },
    },
  }],
};

const snapshot = mainMaterialCompatibilityExportSnapshot({
  kind: 'feed-button',
  plan,
  html: '<button>Launch</button>',
  css: '.cd-button { color: white; }',
  metrics: {
    nodeCount: 2,
    classCount: 2,
    attrCount: 1,
    styleCount: 1,
    cssVariableCount: 1,
  },
});

assert.equal(snapshot.source, 'fallback-plan');
assert.equal(snapshot.plan, plan);
assert.equal(snapshot.html, '<button>Launch</button>');
assert.equal(snapshot.css, '.cd-button { color: white; }');
assert.equal(snapshot.domSnapshot?.tag, 'button');
assert.equal(snapshot.domSnapshot?.children.length, 2);
assert.deepEqual(snapshot.metrics, {
  nodeCount: 2,
  classCount: 2,
  attrCount: 1,
  styleCount: 1,
  cssVariableCount: 1,
});

console.log('Main material compatibility export tests passed');

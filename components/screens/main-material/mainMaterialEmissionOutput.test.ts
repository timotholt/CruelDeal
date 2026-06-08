import assert from 'node:assert/strict';
import type { MaterialEmissionPlan } from '../../ui/material-lab';
import type { DomAuditNode } from './mainMaterialDomAudit';
import {
  activeEmissionPayload,
  cssDeclarationText,
  emissionInspectorTabStatus,
  mainMaterialEmissionExportSnapshot,
  refreshedEmissionPayloadStatus,
  tabLabel,
} from './mainMaterialEmissionOutput';

assert.equal(tabLabel('frame-css'), 'Frame CSS');
assert.equal(cssDeclarationText('--surface-fill', '#fff'), '--surface-fill: #fff;');
assert.equal(emissionInspectorTabStatus('export-css'), 'Showing CTA pilot export CSS plan');
assert.equal(refreshedEmissionPayloadStatus('export-dom', true), 'Refreshed Export DOM');
assert.equal(refreshedEmissionPayloadStatus('export-dom', false), 'No CTA export plan for this target');

const emptySnapshot = mainMaterialEmissionExportSnapshot(null);
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

const snapshot = mainMaterialEmissionExportSnapshot({
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

const editorDomSnapshot: DomAuditNode = {
  path: '0',
  tag: 'div',
  text: 'Editor',
  classes: [],
  attrs: [],
  styles: [],
  children: [],
};

assert.equal(
  activeEmissionPayload({
    tab: 'editor-dom',
    editorDomSnapshot,
    exportHtml: snapshot.html,
    exportCss: snapshot.css,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  '<div>Editor</div>',
);
assert.equal(
  activeEmissionPayload({
    tab: 'export-dom',
    editorDomSnapshot,
    exportHtml: snapshot.html,
    exportCss: snapshot.css,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  snapshot.html,
);
assert.equal(
  activeEmissionPayload({
    tab: 'export-css',
    editorDomSnapshot,
    exportHtml: snapshot.html,
    exportCss: snapshot.css,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  snapshot.css,
);
assert.equal(
  activeEmissionPayload({
    tab: 'frame-css',
    editorDomSnapshot,
    exportHtml: snapshot.html,
    exportCss: snapshot.css,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  '--feed-node-gap: 4px;',
);

console.log('Main material emission output tests passed');

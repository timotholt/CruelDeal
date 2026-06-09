import assert from 'node:assert/strict';
import {
  createMainMaterialDomExportGroup,
  domAuditTargetIds,
} from './mainMaterialDomExportGroup';
import type { DomAuditNode } from './mainMaterialDomAudit';

const node: DomAuditNode = {
  path: '0',
  tag: 'section',
  text: '',
  classes: [{
    key: '0:class:main-material-card',
    name: 'class',
    value: 'main-material-card',
    kind: 'known',
    reason: 'skin',
    source: 'skin',
    cssRules: ['.main-material-card { display: grid; }'],
  }],
  attrs: [{
    key: '0:attr:data-material-target-id',
    name: 'data-material-target-id',
    value: 'feed:card:card_type_01',
    kind: 'known',
    reason: 'selection',
    source: 'selected',
  }],
  styles: [],
  children: [
    {
      path: '0.0',
      tag: 'button',
      text: 'Accept',
      classes: [],
      attrs: [{
        key: '0.0:attr:data-material-target-id',
        name: 'data-material-target-id',
        value: 'feed:card:card_type_01:node:cta',
        kind: 'known',
        reason: 'selection',
        source: 'selected',
      }],
      styles: [{ key: '0.0:style:--surface-fill', name: '--surface-fill', value: '#fff', kind: 'known', reason: 'base', source: 'base' }],
      children: [],
    },
  ],
};

assert.deepEqual(domAuditTargetIds(null), []);
assert.deepEqual(domAuditTargetIds(node), [
  'feed:card:card_type_01',
  'feed:card:card_type_01:node:cta',
]);

const group = createMainMaterialDomExportGroup(node);
assert.ok(group);
assert.equal(group.root, node);
assert.deepEqual(group.targetIds, [
  'feed:card:card_type_01',
  'feed:card:card_type_01:node:cta',
]);
assert.match(group.html, /data-material-target-id="feed:card:card_type_01"/);
assert.match(group.css, /\.main-material-card/);
assert.match(group.css, /--surface-fill/);
assert.equal(group.metrics.nodeCount, 2);

console.log('Main material DOM export group tests passed');

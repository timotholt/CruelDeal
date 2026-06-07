import assert from 'node:assert/strict';
import { configureLogging } from '../../utils/logger';
import type { UiNodePayload } from '../ui/material-lab';
import {
  createUiNodePreviewJsonReadout,
  uiNodePreviewOutputModeByTab,
} from './uiNodePreviewJsonReadout';

configureLogging({ level: 'silent', policy: 'continue' });

assert.equal(uiNodePreviewOutputModeByTab.template, 'ui-node');
assert.equal(uiNodePreviewOutputModeByTab.cms, undefined);

const node: UiNodePayload = {
  id: 'test-node',
  type: 'button',
  text: 'Run',
};

const parsed = JSON.parse(createUiNodePreviewJsonReadout('template', node)) as {
  id?: unknown;
  type?: unknown;
};
assert.equal(parsed.id, 'test-node');
assert.equal(parsed.type, 'button');

assert.equal(createUiNodePreviewJsonReadout('template', { id: 'bad', type: 'script' }), '{}\n');
assert.equal(createUiNodePreviewJsonReadout('cms', { 'mission.title': 'Solace' }), '{\n  "mission.title": "Solace"\n}\n');

console.log('UiNode preview JSON readout tests passed');

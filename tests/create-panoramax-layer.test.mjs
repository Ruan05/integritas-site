import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanoramaxLayer } from '../lib/create-panoramax-layer.mjs';

test('the dashboard street layer contains only keyless Panoramax and starts dormant', () => {
  const layer = createPanoramaxLayer();
  assert.deepEqual(layer.providerIds, ['panoramax']);
  const ui = layer.getUIState();
  assert.equal(ui.enabled, false);
  assert.equal(ui.providers.length, 1);
  assert.equal(ui.providers[0].id, 'panoramax');
  assert.equal(ui.providers[0].on, false);
  assert.equal(ui.providers[0].requiresKeyId, null);
});

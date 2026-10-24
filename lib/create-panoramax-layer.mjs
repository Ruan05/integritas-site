import { createStreetLevelLayer } from '../vendor/gods-eye-view/src/layers/streetLevel/index.js';
import { createPanoramaxProvider } from '../vendor/gods-eye-view/src/layers/streetLevel/providers/panoramax/index.js';
import * as sprites from '../vendor/gods-eye-view/src/data/spriteOrder.js';
import * as picking from '../vendor/gods-eye-view/src/data/pickRegistry.js';
import * as input from '../vendor/gods-eye-view/src/data/inputOwnership.js';
import * as scenePick from '../vendor/gods-eye-view/src/data/scenePick.js';
import * as render from '../vendor/gods-eye-view/src/renderGovernor.js';

/** The public, keyless provider is the only source exposed by this dashboard. */
export function createPanoramaxLayer() {
  return createStreetLevelLayer({
    providers: [createPanoramaxProvider()],
    services: { sprites, picking, input, scenePick, render },
  });
}

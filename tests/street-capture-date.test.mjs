import test from 'node:test';
import assert from 'node:assert/strict';
import {streetCaptureDate} from '../lib/street-capture-date.mjs';
test('Panoramax capture dates accept numeric and ISO provider values',()=>{
  assert.equal(streetCaptureDate(1743664219236),'2025-04-03 UTC');
  assert.equal(streetCaptureDate('2025-04-03T09:10:19+02:00'),'2025-04-03 UTC');
  for(const bad of [null,undefined,'','invalid'])assert.equal(streetCaptureDate(bad),'date unavailable');
});

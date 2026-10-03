import test from "node:test";
import assert from "node:assert/strict";
import { reportNeedsHold } from "../lib/report-disposition.mjs";

test("holds terminal incomplete decisions even after report status was finalized", () => {
  assert.equal(reportNeedsHold("Decision status: INCOMPLETE", "Terminal outcome: incomplete. This is a draft work product."), true);
});

test("holds explicit direct-verification dispositions", () => {
  assert.equal(reportNeedsHold("", "Terminal outcome: DIRECT VERIFICATION REQUIRED"), true);
});

test("allows a completed analyst disposition", () => {
  assert.equal(reportNeedsHold("Decision status: completed", "Terminal outcome: completed."), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { reportNeedsHold } from "../lib/report-disposition.mjs";

test("holds terminal incomplete decisions even after report status was finalized", () => {
  assert.equal(reportNeedsHold("Decision status: INCOMPLETE", "Terminal outcome: incomplete. This is a draft work product."), true);
});

test("keeps a completed report with open direct-verification gates reviewable", () => {
  assert.equal(reportNeedsHold("", "Decision status: HOLD. Direct verification required. Terminal outcome: completed."), false);
});

test("allows a completed analyst disposition", () => {
  assert.equal(reportNeedsHold("Decision status: completed", "Terminal outcome: completed."), false);
});

test("allows a completed HOLD decision with open human verification gates", () => {
  assert.equal(reportNeedsHold("Decision status: HOLD — DO NOT PROCEED", "Terminal outcome: completed."), false);
});

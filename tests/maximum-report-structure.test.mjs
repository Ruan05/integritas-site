import test from "node:test";
import assert from "node:assert/strict";
import { hasVerifiedMaximumDepthStructure, MAXIMUM_DEPTH_REPORT_HEADINGS } from "../lib/maximum-report-structure.mjs";

const model = { quality: { report_structure: "maximum_depth_edd_28_v1_verified" } };
const sectionBody = "Case-specific evidence and limitations are recorded for analyst review. ".repeat(5);
const report = MAXIMUM_DEPTH_REPORT_HEADINGS.map((heading, index) => `# ${index + 1}. ${heading}\n\n${sectionBody}`).join("\n\n");

test("report gate accepts only an attested, exact, ordered 28-section maximum-depth report", () => {
  assert.equal(hasVerifiedMaximumDepthStructure(model, report), true);
  assert.equal(hasVerifiedMaximumDepthStructure({ quality: { report_structure: "missing_or_invalid" } }, report), false);
  assert.equal(hasVerifiedMaximumDepthStructure(model, report.replace("# 14. ", "# 13. ")), false);
  assert.equal(hasVerifiedMaximumDepthStructure(model, report.replace("# 28. ", "# 29. ")), false);
  assert.equal(hasVerifiedMaximumDepthStructure(model, report.replace("Corporate registry, legal status and identity resolution", "Company details")), false);
  assert.equal(hasVerifiedMaximumDepthStructure(model, report.replace(sectionBody, "Too short")), false);
  assert.equal(hasVerifiedMaximumDepthStructure(model, `${report}\n\n# 29. Extra section\n\nAdditional content.`), false);
  assert.equal(hasVerifiedMaximumDepthStructure(model, report.slice(0, 1200)), false);
});

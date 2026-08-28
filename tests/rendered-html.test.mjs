import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function source(file) {
  return readFile(path.join(root, file), "utf8");
}

test("targets the Integritas custom domain in public metadata", async () => {
  const [layout, robots, sitemap] = await Promise.all([
    source("app/layout.tsx"),
    source("app/robots.ts"),
    source("app/sitemap.ts"),
  ]);

  for (const file of [layout, robots, sitemap]) {
    assert.match(file, /https:\/\/integritass\.com/);
    assert.doesNotMatch(file, /space-z\.ai/);
  }
  assert.match(layout, /alternates:\s*\{ canonical: "\/" \}/);
  assert.match(layout, /"@type": "ProfessionalService"/);
});

test("protects the contact and privacy contract", async () => {
  const [page, contact, visit, privacy, analytics, worker] = await Promise.all([
    source("app/page.tsx"),
    source("app/api/contact/route.ts"),
    source("app/api/visit/route.ts"),
    source("app/privacy/page.tsx"),
    source("components/VisitorAnalytics.tsx"),
    source("worker/index.ts"),
  ]);

  assert.equal((page.match(/\(\+27 79\) 462 0451/g) ?? []).length, 3);
  assert.equal((page.match(/\(\+27 61\) 502 6507/g) ?? []).length, 4);
  assert.match(contact, /privacyAccepted !== true/);
  assert.match(contact, /mode: "mailto"/);
  assert.match(contact, /RESEND_API_KEY/);
  assert.match(visit, /cf-ipcountry/);
  assert.doesNotMatch(visit, /cf-connecting-ip|x-forwarded-for/);
  assert.match(privacy, /does not intentionally record your full IP address/);
  assert.match(analytics, /No advertising trackers, precise location or fingerprinting/);
  assert.match(worker, /if \(!env\.IMAGES\)/);
  assert.match(worker, /sourcePath\.startsWith\("\/\/"\)/);
});

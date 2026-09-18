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
  const [layout, robots, sitemap, proxy] = await Promise.all([
    source("app/layout.tsx"),
    source("app/robots.ts"),
    source("app/sitemap.ts"),
    source("proxy.ts"),
  ]);

  for (const file of [layout, robots, sitemap]) {
    assert.match(file, /https:\/\/integritass\.com/);
    assert.doesNotMatch(file, /space-z\.ai/);
  }
  assert.match(layout, /alternates:\s*\{ canonical: "\/" \}/);
  assert.match(layout, /"@type": "ProfessionalService"/);
  assert.match(proxy, /www\.\$\{CANONICAL_HOST\}/);
  assert.match(proxy, /NextResponse\.redirect\(destination, 308\)/);
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
  assert.match(privacy, /automatically removed after 90 days/);
  assert.match(visit, /insertResult\.meta\?\.changes/);
  assert.match(analytics, /No advertising trackers, precise location or fingerprinting/);
  assert.match(worker, /if \(!env\.IMAGES\)/);
  assert.match(worker, /sourcePath\.startsWith\("\/\/"\)/);
});

test("keeps the live CRM wired to the bounded OpenClaw investigation flow", async () => {
  const [crmPage, workspace, browser] = await Promise.all([
    source("app/crm/page.tsx"),
    source("components/IntegritasAdminWorkspace.tsx"),
    source("lib/integritas-browser.ts"),
  ]);

  assert.match(crmPage, /IntegritasAdminWorkspace/);
  assert.match(crmPage, /robots:\s*\{ index: false, follow: false \}/);
  assert.match(workspace, /Upload documents to investigate/);
  assert.match(workspace, /Upload selected evidence/);
  assert.match(workspace, /Start Deep Investigation/);
  assert.match(workspace, /role="progressbar"/);
  assert.match(workspace, /job\.progress/);
  assert.match(workspace, /Oracle\/OpenClaw ready/);
  assert.match(workspace, /Maximum appropriate depth/);
  assert.match(browser, /MAX_CASE_DOCUMENTS = 20/);
  assert.match(browser, /start_case_investigation/);
  assert.match(browser, /cancel_case_investigation/);
  assert.match(browser, /retry_case_investigation/);
  assert.match(browser, /worker_version, \[0, 3, 4\]/);
});

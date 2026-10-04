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

test("keeps the live CRM behind one password and exposes the simple investigation workflow", async () => {
  const [crmPage, gate, loginRoute, auth, backend, workspace, browser] = await Promise.all([
    source("app/crm/page.tsx"),
    source("components/CrmPasswordGate.tsx"),
    source("app/api/crm/login/route.ts"),
    source("lib/crm-auth.ts"),
    source("app/api/crm/backend/route.ts"),
    source("components/IntegritasAdminWorkspace.tsx"),
    source("lib/integritas-browser.ts"),
  ]);

  assert.match(crmPage, /isValidCrmSession/);
  assert.match(crmPage, /CrmPasswordGate/);
  assert.match(crmPage, /IntegritasAdminWorkspace/);
  assert.match(crmPage, /robots:\s*\{ index: false, follow: false \}/);
  assert.match(gate, /Open workspace/);
  assert.match(gate, /\/api\/crm\/login/);
  assert.doesNotMatch(gate, /signInWithOtp|setSession|updateUser|secure sign-in link/i);
  assert.match(loginRoute, /CRM_SESSION_SECRET/);
  assert.match(auth, /CRM_PASSWORD_SHA256/);
  assert.match(auth, /SHA-256/);
  assert.match(auth, /HMAC/);
  assert.match(backend, /INTEGRITAS_CRM_BACKEND_TOKEN/);
  assert.match(backend, /x-integritas-crm-token/);
  assert.match(workspace, /Upload documents to investigate/);
  assert.match(workspace, /Upload and start investigation/);
  assert.match(workspace, /action: "start_case_investigation"/);
  assert.doesNotMatch(workspace, /isInvestigationRuntimeReady|runtime_status|Investigation service unavailable/);
  assert.match(workspace, /Oracle report requires review/);
  assert.match(workspace, /The comprehensive report is saved in the CRM from Oracle's verified report snapshot/);
  assert.match(workspace, /Number\(report\?\.based_on_revision\) === Number\(snapshot\?\.case\?\.revision\)/);
  assert.match(workspace, /Historical report from an earlier investigation or case revision/);
  assert.match(workspace, /Investigation progress/);
  assert.match(workspace, /Download report/);
  assert.match(workspace, /Previous investigations/);
  assert.match(workspace, /depth: "maximum"/);
  assert.match(workspace, /role="progressbar"/);
  assert.doesNotMatch(workspace, /signInWithOtp|Authorized analyst sign-in|Send secure sign-in link/);
  assert.match(browser, /MAX_CASE_DOCUMENTS = 20/);
  assert.match(browser, /worker_version, \[0, 3, 6\]/);
});

test("serves the sealed Oracle PDF artifact through the CRM instead of rebuilding it", async () => {
  const route = await source("app/api/crm/report/route.ts");
  assert.match(route, /action: "get_report_pdf"/);
  assert.match(route, /verifyOracleArtifactBytes/);
  assert.match(route, /oracle-sealed-artifact/);
  assert.match(route, /Number\(report\.based_on_revision\) !== currentRevision/);
  assert.doesNotMatch(route, /createReportPdf/);
});

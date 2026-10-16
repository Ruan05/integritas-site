import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("shows an older malformed response as readable prose with the original available", async () => {
  const {AssistantMessageContent} = await vite.ssrLoadModule("/components/CaseAgentChat.tsx");
  const content = 'The filing is unverified.\n{"reply":"The filing is unverified.","memory":';
  const html = renderToStaticMarkup(React.createElement(AssistantMessageContent, {content}));
  assert.match(html, /^<p[^>]*>The filing is unverified\.<\/p><details/);
  assert.match(html, /View original/);
  assert.match(html, /&quot;memory&quot;/);
});

test("renders the homepage hero as a seamless transparent lockup with controlled spacing", async () => {
  const [css, sourceCss, page, asset] = await Promise.all([
    readCssTree(path.join(root, "dist")),
    readFile(path.join(root, "app/globals.css"), "utf8"),
    readFile(path.join(root, "app/page.tsx"), "utf8"),
    readFile(path.join(root, "public/integritas-hero-lockup-eb2a6af5.webp")),
  ]);

  assert.match(page, /src="\/integritas-hero-lockup-eb2a6af5\.webp"/);
  assert.doesNotMatch(page, /src="\/integritas-hero-lockup\.webp"/);
  assert.match(page, /hero-content-stack/);
  assert.match(page, /hero-supporting-copy/);
  assert.match(page, /hero-actions/);
  assert.match(page, /pharmaceutical and healthcare due/);
  assert.match(page, /href="#contact"/);
  assert.match(page, /href="#about"/);
  assert.doesNotMatch(page, /hero-logo-cinematic|hero-logo-glint|gold-particle|hero-spotlight|hero-ambient-glow/);

  assert.match(sourceCss, /\.hero-content-stack\s*\{/);
  assert.match(sourceCss, /\.hero-supporting-copy\s*\{/);
  assert.match(sourceCss, /\.hero-actions\s*\{/);
  assert.match(sourceCss, /gap:\s*clamp\(/);
  assert.match(sourceCss, /mix-blend-mode:\s*normal/);
  assert.match(sourceCss, /mask-image:\s*none/);
  assert.doesNotMatch(sourceCss, /\.hero-logo-cinematic|\.hero-logo-glint|\.hero-spotlight|\.hero-ambient-glow|@keyframes haloBreath|@keyframes quietGlint/);

  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
  assert.ok(asset.includes(Buffer.from("ALPH")), "hero WebP must carry transparency instead of an opaque black matte");
  assert.ok(asset.includes(Buffer.from("VP8X")), "hero WebP must use the extended container required for alpha");
  assert.match(css, /hero-content-stack/);
  assert.match(css, /flip-card-inner/);
  assert.match(css, /backface-visibility:\s*hidden/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("does not mark the PDF milestone blocked when an incomplete run committed a PDF", async () => {
  const { milestoneStatus } = await vite.ssrLoadModule("/components/IntegritasAdminWorkspace.tsx");
  const job = {
    id: "job-1",
    stage: "incomplete",
    progress: 100,
    current_attempt: 21,
  };
  const snapshot = {
    checkpoints: [{
      case_job_id: "job-1",
      attempt: 21,
      stage: "incomplete",
      progress: 100,
      updated_at: "2026-09-25T14:45:55.104Z",
      safe_metadata: {
        render_status: "ready",
        pdf_sha256: "5d72ba3a5b89fb9fd6aea62f0da2bdbe0f4eb1efd5ed083ad48bbfcecefa6706",
      },
    }],
  };

  assert.equal(milestoneStatus(7, job, snapshot), "complete");
  assert.equal(milestoneStatus(0, job, snapshot), "complete");
});

test("does not reuse a previous attempt checkpoint for the current PDF milestone", async () => {
  const { milestoneStatus } = await vite.ssrLoadModule("/components/IntegritasAdminWorkspace.tsx");
  const job = { id: "job-1", stage: "incomplete", progress: 100, current_attempt: 21 };
  const snapshot = {
    checkpoints: [{
      case_job_id: "job-1",
      attempt: 20,
      stage: "incomplete",
      progress: 100,
      safe_metadata: {
        render_status: "ready",
        pdf_sha256: "5d72ba3a5b89fb9fd6aea62f0da2bdbe0f4eb1efd5ed083ad48bbfcecefa6706",
      },
    }],
  };

  assert.equal(milestoneStatus(7, job, snapshot), "blocked");
});

test("maps sharded document review and sectioned report writing to CRM milestones", async () => {
  const { milestoneStatus } = await vite.ssrLoadModule("/components/IntegritasAdminWorkspace.tsx");
  const job = { id: "job-1", stage: "drafting_report", current_attempt: 7 };
  const snapshot = { checkpoints: [{
    case_job_id: "job-1", attempt: 7, stage: "drafting_report",
    safe_metadata: { phase: "large_sectioned_report" },
  }] };
  assert.equal(milestoneStatus(5, job, snapshot), "active");
  assert.equal(milestoneStatus(6, job, snapshot), "waiting");
  const reviewing = { ...job, stage: "extracting", checkpoint_metadata: { phase: "large_document_shards" } };
  assert.equal(milestoneStatus(0, reviewing, null), "active");
  assert.equal(milestoneStatus(1, reviewing, null), "waiting");
});

test("removes duplicated executive markdown from the CRM PDF renderer", async () => {
  const { createReportPdf } = await vite.ssrLoadModule("/lib/report-pdf.ts");
  const executive = [
    "# MASTER SUMMARY — READ THIS FIRST",
    "",
    "Executive Decision Summary",
    "",
    "**Decision status:** INCOMPLETE",
    "",
    "The submitted evidence remains subject to unresolved gates.",
    "",
    "## DIRECT NEXT STEPS — WHAT TO DO NOW",
    "",
    "1. Obtain authoritative confirmation.",
  ].join("\n");
  const content = `${executive}\n\n# DOCUMENT, FORENSIC & ENTITY REVIEW\n\nDocument findings.`;
  const pdf = Buffer.from(createReportPdf("Case", executive, content, "2026-09-25T00:00:00.000Z"));
  const text = pdf.toString("utf8");

  assert.doesNotMatch(text, /# MASTER SUMMARY/);
  assert.doesNotMatch(text, /\*\*Decision status:\*\*/);
  assert.match(text, /DIRECT NEXT STEPS - WHAT TO DO NOW/);
  assert.match(text, /DOCUMENT, FORENSIC & ENTITY REVIEW/);
});

test("renders all report table rows, long prose, and closure checks across pages", async () => {
  const { createReportPdf } = await vite.ssrLoadModule("/lib/report-pdf.ts");
  const rows = Array.from({ length: 35 }, (_, i) => `| Evidence ${i + 1} | unique-marker-${i + 1} |`).join("\n");
  const prose = `${"The evidence remains subject to direct verification. ".repeat(260)}final-long-paragraph-marker`;
  const checks = Array.from({ length: 25 }, (_, i) => ({ status: "open", description: `closure-check-${i + 1}` }));
  const pdf = Buffer.from(createReportPdf("Case", "Summary", `# MASTER SUMMARY — READ THIS FIRST\n\n${prose}\n\n| Item | Note |\n| --- | --- |\n${rows}`, "2026-09-25T00:00:00.000Z", { checks }));
  const text = pdf.toString("utf8");
  assert.match(text, /final-long-paragraph-marker/);
  assert.match(text, /unique-marker-35/);
  assert.match(text, /closure-check-25/);
  assert.match(text, /\/Count [3-9][0-9]* >>/);
});

test("relationship register preserves actual endpoints and every persisted edge", async () => {
  const { createReportPdf } = await vite.ssrLoadModule("/lib/report-pdf.ts");
  const entities = [
    { id: "entity-a", display_name: "Actual From Entity" },
    { id: "entity-b", display_name: "Actual To Entity" },
  ];
  const relationships = Array.from({ length: 8 }, (_, i) => ({
    from_entity_id: "entity-a",
    to_entity_id: "entity-b",
    source_id: "source-a",
    relationship_type: "asserted role",
    evidence_status: "alleged",
    claim: `relationship-marker-${i + 1}`,
  }));
  const pdf = Buffer.from(createReportPdf("Case", "Summary", "# MASTER SUMMARY — READ THIS FIRST\n\nDraft.", "2026-09-25T00:00:00.000Z", {
    entities, relationships, sources: [{ id: "source-a", source_key: "doc.actual" }],
  }));
  const text = pdf.toString("utf8");
  assert.match(text, /Actual From Entity -> Actual To Entity/);
  assert.match(text, /Source: doc.actual/);
  assert.match(text, /relationship-marker-8/);
  assert.doesNotMatch(text, /Evidence relationship map/);
});

test("accepts Oracle PDF bytes only when their stored size and SHA-256 match", async () => {
  const { verifyOracleArtifactBytes } = await vite.ssrLoadModule("/lib/oracle-report-artifact.ts");
  const bytes = new TextEncoder().encode("%PDF-1.7\nsealed Oracle report\n%%EOF");
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  assert.equal(await verifyOracleArtifactBytes(bytes, sha256, bytes.byteLength), true);
  assert.equal(await verifyOracleArtifactBytes(bytes, sha256, bytes.byteLength + 1), false);
  assert.equal(await verifyOracleArtifactBytes(bytes, "0".repeat(64), bytes.byteLength), false);
  assert.equal(await verifyOracleArtifactBytes(bytes, "invalid", bytes.byteLength), false);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("redirects www requests to the canonical apex host", async () => {
  const { proxy } = await vite.ssrLoadModule("/proxy.ts");
  const response = proxy(
    new Request("https://www.integritass.com/privacy?source=www"),
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://integritass.com/privacy?source=www",
  );

  const canonicalResponse = proxy(
    new Request("https://integritass.com/privacy"),
  );
  assert.equal(canonicalResponse.status, 200);
  assert.equal(canonicalResponse.headers.get("location"), null);
});

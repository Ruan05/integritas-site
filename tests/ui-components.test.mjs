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

test("emits the cinematic, card and reduced-motion safeguards", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /hero-logo-cinematic/);
  assert.match(css, /cinematicFigure/);
  assert.match(css, /cinematicSettle/);
  assert.match(css, /hero-cascade-5/);
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

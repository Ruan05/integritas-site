import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, server: { middlewareMode: true } });
after(async () => vite.close());

function request(method, params = {}, authenticated = true) {
  return new Request("https://integritass.com/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(authenticated ? { "oai-authenticated-user-email": "owner@example.com" } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

function fakeProvider(configured = true) {
  const result = {
    ok: true,
    finalResult: "bounded conclusion",
    evidence: ["test evidence"],
    filesChanged: [],
    testsRun: [],
    model: "bulk",
    provider: "opencode-go",
    sessionId: "123e4567-e89b-42d3-a456-426614174000",
    durationMs: 8,
    uncertainties: [],
    recommendedNextAction: "Let Sol verify.",
  };
  return {
    isConfigured: () => configured,
    listModels: async () => [{ id: "bulk", name: "Bulk", family: "alpha", transport: "chat_completions", reasoning: false, toolCall: true, contextTokens: 128000, outputTokens: 8192, inputCost: 0.1, outputCost: 0.2 }],
    delegate: async () => result,
    review: async () => result,
    verify: async () => result,
  };
}

test("rejects MCP calls without the trusted Sites identity boundary", async () => {
  const { handleMcpRequest } = await vite.ssrLoadModule("/lib/opencode/mcp-server.ts");

  const response = await handleMcpRequest(request("tools/list", {}, false), { provider: fakeProvider() });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
});

test("initializes as a tool-only MCP server and exposes the six bounded tools", async () => {
  const { handleMcpRequest } = await vite.ssrLoadModule("/lib/opencode/mcp-server.ts");
  const initialized = await handleMcpRequest(request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "contract-test", version: "1" },
  }), { provider: fakeProvider() });
  assert.equal(initialized.status, 200);

  const response = await handleMcpRequest(request("tools/list"), { provider: fakeProvider() });
  const payload = await response.json();
  const names = payload.result.tools.map((tool) => tool.name);

  assert.deepEqual(names, [
    "opencode_health",
    "opencode_models",
    "opencode_delegate",
    "opencode_parallel",
    "opencode_review",
    "opencode_verify",
  ]);
  for (const tool of payload.result.tools) {
    assert.equal(typeof tool.description, "string");
    assert.equal(typeof tool.annotations.openWorldHint, "boolean");
  }
});

test("health reports the credential gate without exposing secret material", async () => {
  const { handleMcpRequest } = await vite.ssrLoadModule("/lib/opencode/mcp-server.ts");

  const response = await handleMcpRequest(request("tools/call", {
    name: "opencode_health",
    arguments: {},
  }), { provider: fakeProvider(false) });
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(payload.result.structuredContent.status, "configuration_required");
  assert.equal(payload.result.structuredContent.provider, "opencode-go");
  assert.doesNotMatch(serialized, /server-only|api[_ -]?key|authorization/i);
});

test("delegate returns concise structured worker results", async () => {
  const { handleMcpRequest } = await vite.ssrLoadModule("/lib/opencode/mcp-server.ts");

  const response = await handleMcpRequest(request("tools/call", {
    name: "opencode_delegate",
    arguments: { task: "Inspect this bounded module", model: "bulk" },
  }), { provider: fakeProvider() });
  const payload = await response.json();

  assert.equal(payload.result.structuredContent.finalResult, "bounded conclusion");
  assert.equal(payload.result.structuredContent.provider, "opencode-go");
  assert.equal(payload.result.structuredContent.sessionId, "123e4567-e89b-42d3-a456-426614174000");
  assert.ok(JSON.stringify(payload).length < 5_000);
});

test("sanitizes unexpected provider failures at the MCP boundary", async () => {
  const { handleMcpRequest } = await vite.ssrLoadModule("/lib/opencode/mcp-server.ts");
  const provider = fakeProvider();
  provider.listModels = async () => {
    throw new Error("authorization=private-provider-detail");
  };

  const response = await handleMcpRequest(request("tools/call", {
    name: "opencode_models",
    arguments: {},
  }), { provider });
  const serialized = JSON.stringify(await response.json());

  assert.doesNotMatch(serialized, /private-provider-detail|authorization/i);
  assert.match(serialized, /temporarily unavailable/i);
});

test("falls back once to a different live model after a retryable worker failure", async () => {
  const { handleMcpRequest } = await vite.ssrLoadModule("/lib/opencode/mcp-server.ts");
  const provider = fakeProvider();
  const attempted = [];
  provider.listModels = async () => [
    { id: "bulk", name: "Bulk", family: "alpha", transport: "chat_completions", reasoning: false, toolCall: true, contextTokens: 128000, outputTokens: 8192, inputCost: 0.1, outputCost: 0.2 },
    { id: "backup", name: "Backup", family: "beta", transport: "chat_completions", reasoning: true, toolCall: true, contextTokens: 256000, outputTokens: 16384, inputCost: 0.5, outputCost: 1 },
  ];
  provider.delegate = async (input) => {
    attempted.push(input.model);
    if (input.model === "bulk") {
      return {
        ok: false, finalResult: "", evidence: [], filesChanged: [], testsRun: [], model: "bulk", provider: "opencode-go",
        sessionId: "123e4567-e89b-42d3-a456-426614174000", durationMs: 5, uncertainties: [],
        recommendedNextAction: "Retry", error: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true },
      };
    }
    return { ...(await fakeProvider().delegate(input)), model: input.model };
  };

  const response = await handleMcpRequest(request("tools/call", {
    name: "opencode_delegate",
    arguments: { task: "Analyze this bounded module" },
  }), { provider });
  const payload = await response.json();

  assert.deepEqual(attempted, ["bulk", "backup"]);
  assert.equal(payload.result.structuredContent.ok, true);
  assert.equal(payload.result.structuredContent.model, "backup");
});

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, server: { middlewareMode: true } });
after(async () => vite.close());

const liveModels = {
  object: "list",
  data: [
    { id: "cheap-code", object: "model", created: 1, owned_by: "opencode" },
    { id: "strong-code", object: "model", created: 1, owned_by: "opencode" },
  ],
};

const catalog = {
  "opencode-go": {
    id: "opencode-go",
    npm: "@ai-sdk/openai-compatible",
    api: "https://opencode.ai/zen/go/v1",
    models: {
      "cheap-code": {
        id: "cheap-code",
        name: "Cheap Code",
        family: "cheap",
        reasoning: false,
        tool_call: true,
        limit: { context: 128000, output: 8192 },
        cost: { input: 0.1, output: 0.2 },
      },
      "strong-code": {
        id: "strong-code",
        name: "Strong Code",
        family: "strong",
        reasoning: true,
        tool_call: true,
        limit: { context: 1000000, output: 65536 },
        cost: { input: 1, output: 4 },
      },
      stale: { id: "stale", name: "Stale", family: "stale" },
    },
  },
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("discovers only live Go models and derives their current transport", async () => {
  const { OpenCodeProvider } = await vite.ssrLoadModule("/lib/opencode/provider.ts");
  const fetch = async (url) =>
    String(url).includes("models.opencode.ai") ? jsonResponse(catalog) : jsonResponse(liveModels);
  const provider = new OpenCodeProvider({ apiKey: "server-only", fetch });

  const models = await provider.listModels();

  assert.deepEqual(models.map((model) => model.id), ["cheap-code", "strong-code"]);
  assert.equal(models[0].transport, "chat_completions");
  assert.equal(models[1].reasoning, true);
  assert.equal(models.some((model) => model.id === "stale"), false);
});

test("keeps live model discovery working when optional catalog enrichment fails", async () => {
  const { OpenCodeProvider } = await vite.ssrLoadModule("/lib/opencode/provider.ts");
  const fetch = async (url) => {
    if (String(url).includes("models.opencode.ai")) throw new TypeError("catalog unavailable");
    return jsonResponse(liveModels);
  };
  const provider = new OpenCodeProvider({ apiKey: "server-only", fetch });

  const models = await provider.listModels();

  assert.deepEqual(models.map((model) => model.id), ["cheap-code", "strong-code"]);
  assert.equal(models[0].transport, "chat_completions");
});

test("identifies the bridge, preserves sessions, and returns only normalized conclusions", async () => {
  const { OpenCodeProvider } = await vite.ssrLoadModule("/lib/opencode/provider.ts");
  const requests = [];
  const fetch = async (url, init = {}) => {
    if (String(url).endsWith("/models")) return jsonResponse(liveModels);
    if (String(url).includes("models.opencode.ai")) return jsonResponse(catalog);
    requests.push({ url: String(url), init });
    return jsonResponse({
      id: "completion-1",
      object: "chat.completion",
      created: 1,
      model: "strong-code",
      choices: [{
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          reasoning_content: "private chain of thought",
          content: '<think>also private</think>{"finalResult":"Use a queue.","evidence":["worker pool bounds concurrency"],"filesChanged":["src/queue.ts"],"testsRun":["queue.test.ts"],"uncertainties":[],"recommendedNextAction":"Implement the queue."}',
        },
      }],
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
    });
  };
  const provider = new OpenCodeProvider({ apiKey: "server-only", fetch, randomUUID: () => "123e4567-e89b-42d3-a456-426614174000", now: (() => { let n = 10; return () => ++n; })() });

  const first = await provider.delegate({ task: "Design a bounded worker queue", model: "strong-code", timeoutMs: 20_000 });
  const second = await provider.delegate({ task: "Critique it", model: "strong-code", timeoutMs: 20_000, sessionId: first.sessionId });

  assert.equal(first.ok, true);
  assert.equal(first.finalResult, "Use a queue.");
  assert.equal(first.sessionId, "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(requests[0].url, "https://opencode.ai/zen/go/v1/chat/completions");
  assert.equal(requests[0].init.headers["x-opencode-session"], first.sessionId);
  assert.match(requests[0].init.headers["user-agent"], /^integritas-opencode-bridge\//);
  assert.equal(requests[0].init.headers.authorization, "Bearer server-only");
  assert.doesNotMatch(JSON.stringify(first), /private|think/i);
});

test("retries rate limits conservatively and sanitizes exhausted provider errors", async () => {
  const { OpenCodeProvider } = await vite.ssrLoadModule("/lib/opencode/provider.ts");
  let posts = 0;
  const sleeps = [];
  const fetch = async (url) => {
    if (String(url).endsWith("/models")) return jsonResponse(liveModels);
    if (String(url).includes("models.opencode.ai")) return jsonResponse(catalog);
    posts += 1;
    return jsonResponse({ error: { message: "raw secret provider diagnostic" } }, 429);
  };
  const provider = new OpenCodeProvider({ apiKey: "server-only", fetch, sleep: async (ms) => sleeps.push(ms) });

  const result = await provider.delegate({ task: "Analyze", model: "cheap-code", timeoutMs: 20_000 });

  assert.equal(posts, 3);
  assert.deepEqual(sleeps, [500, 1500]);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "RATE_LIMITED");
  assert.equal(result.error.retryable, true);
  assert.doesNotMatch(JSON.stringify(result), /raw secret provider diagnostic/);
});

test("does not retry authentication failures or expose their body", async () => {
  const { OpenCodeProvider } = await vite.ssrLoadModule("/lib/opencode/provider.ts");
  let posts = 0;
  const fetch = async (url) => {
    if (String(url).endsWith("/models")) return jsonResponse(liveModels);
    if (String(url).includes("models.opencode.ai")) return jsonResponse(catalog);
    posts += 1;
    return new Response("credential=do-not-return", { status: 401 });
  };
  const provider = new OpenCodeProvider({ apiKey: "server-only", fetch });

  const result = await provider.delegate({ task: "Analyze", model: "cheap-code", timeoutMs: 20_000 });

  assert.equal(posts, 1);
  assert.equal(result.error.code, "AUTHENTICATION_FAILED");
  assert.doesNotMatch(JSON.stringify(result), /do-not-return/);
});

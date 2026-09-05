import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  server: { middlewareMode: true },
});

after(async () => vite.close());

test("rejects delegate inputs that would consume unbounded context", async () => {
  const { MAX_TASK_CHARS, validateDelegateInput } = await vite.ssrLoadModule(
    "/lib/opencode/validation.ts",
  );

  assert.equal(validateDelegateInput({ task: "review this function" }).task, "review this function");
  assert.throws(
    () => validateDelegateInput({ task: "x".repeat(MAX_TASK_CHARS + 1) }),
    /task is too large/i,
  );
  assert.throws(
    () => validateDelegateInput({ task: "ok", timeoutMs: 4_999 }),
    /timeout/i,
  );
  assert.throws(
    () => validateDelegateInput({ task: "ok", sessionId: "not a uuid" }),
    /session/i,
  );
});

test("bounds parallel task count and combined context", async () => {
  const { validateParallelInput } = await vite.ssrLoadModule(
    "/lib/opencode/validation.ts",
  );

  const accepted = validateParallelInput({
    tasks: ["inspect auth", "inspect storage"],
    maxConcurrency: 2,
  });
  assert.equal(accepted.tasks.length, 2);

  assert.throws(
    () => validateParallelInput({ tasks: Array.from({ length: 9 }, () => "task") }),
    /at most 8/i,
  );
  assert.throws(
    () => validateParallelInput({ tasks: ["x".repeat(60_000), "y".repeat(60_000), "z".repeat(40_001)] }),
    /combined task size/i,
  );
  assert.throws(
    () => validateParallelInput({ tasks: ["task"], maxConcurrency: 5 }),
    /concurrency/i,
  );
});

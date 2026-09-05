import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, server: { middlewareMode: true } });
after(async () => vite.close());

const models = [
  { id: "bulk", name: "Bulk", family: "alpha", transport: "chat_completions", reasoning: false, toolCall: true, contextTokens: 128000, outputTokens: 8192, inputCost: 0.1, outputCost: 0.2 },
  { id: "balanced", name: "Balanced", family: "beta", transport: "chat_completions", reasoning: true, toolCall: true, contextTokens: 256000, outputTokens: 32768, inputCost: 0.5, outputCost: 1 },
  { id: "strong", name: "Strong", family: "gamma", transport: "chat_completions", reasoning: true, toolCall: true, contextTokens: 1000000, outputTokens: 65536, inputCost: 2, outputCost: 5 },
];

test("routes exploration cheaply and hard implementation to a strong reasoning model", async () => {
  const { selectWorkerModel } = await vite.ssrLoadModule("/lib/opencode/routing.ts");

  assert.equal(selectWorkerModel(models, "explore").id, "bulk");
  assert.equal(selectWorkerModel(models, "implement").id, "strong");
  assert.equal(selectWorkerModel(models, "verify").reasoning, true);
});

test("honors an explicit live model and selects a different critic family", async () => {
  const { selectCriticModel, selectWorkerModel } = await vite.ssrLoadModule("/lib/opencode/routing.ts");

  assert.equal(selectWorkerModel(models, "implement", "balanced").id, "balanced");
  assert.equal(selectCriticModel(models, "strong").family === "gamma", false);
  assert.throws(() => selectWorkerModel(models, "explore", "retired"), /live model/i);
});

test("parallel execution preserves order and never exceeds the cap", async () => {
  const { runParallel } = await vite.ssrLoadModule("/lib/opencode/parallel.ts");
  let active = 0;
  let observedMaximum = 0;
  const worker = async (task, index) => {
    active += 1;
    observedMaximum = Math.max(observedMaximum, active);
    await new Promise((resolve) => setTimeout(resolve, 8 - index));
    active -= 1;
    return `${index}:${task}`;
  };

  const results = await runParallel(["a", "b", "c", "d", "e"], 2, worker);

  assert.deepEqual(results, ["0:a", "1:b", "2:c", "3:d", "4:e"]);
  assert.equal(observedMaximum, 2);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "zod/v4";
import type { DelegateInput, ProviderModel, WorkerResult } from "./contracts";
import { runParallel } from "./parallel";
import { selectCriticModel, selectWorkerModel } from "./routing";
import { validateDelegateInput, validateParallelInput } from "./validation";

type McpProvider = {
  isConfigured(): boolean;
  listModels(): Promise<ProviderModel[]>;
  delegate(input: DelegateInput): Promise<WorkerResult>;
  review(content: string, model: string, timeoutMs?: number): Promise<WorkerResult>;
  verify(task: string, result: string, model: string, timeoutMs?: number): Promise<WorkerResult>;
};

type McpDependencies = { provider: McpProvider };

const workerResultShape = {
  ok: z.boolean(),
  finalResult: z.string(),
  evidence: z.array(z.string()),
  filesChanged: z.array(z.string()),
  testsRun: z.array(z.string()),
  model: z.string(),
  provider: z.literal("opencode-go"),
  sessionId: z.string(),
  durationMs: z.number(),
  uncertainties: z.array(z.string()),
  recommendedNextAction: z.string(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).optional(),
};

function isAuthorized(request: Request) {
  return Boolean(request.headers.get("oai-authenticated-user-email"));
}

function toolResult(result: WorkerResult) {
  return {
    structuredContent: result,
    content: [{
      type: "text" as const,
      text: result.ok
        ? `OpenCode completed the bounded task with ${result.model}. Sol should verify the structured result.`
        : `OpenCode did not complete the task (${result.error?.code ?? "PROVIDER_ERROR"}).`,
    }],
    isError: !result.ok,
  };
}

function inferPurpose(task: string): "explore" | "implement" {
  return /implement|build|fix|debug|refactor|write code|patch|migration|architecture/i.test(task)
    ? "implement"
    : "explore";
}

async function listModelsSafely(provider: McpProvider) {
  try {
    return await provider.listModels();
  } catch {
    throw new Error("OpenCode is temporarily unavailable.");
  }
}

async function delegateWithFallback(
  provider: McpProvider,
  input: DelegateInput,
  models: ProviderModel[],
  selected: ProviderModel,
  allowFallback: boolean,
) {
  const first = await provider.delegate({ ...input, model: selected.id });
  if (!allowFallback || first.ok || first.error?.retryable !== true || models.length < 2) {
    return first;
  }
  const fallback = selectCriticModel(models, selected.id);
  if (fallback.id === selected.id) return first;
  return provider.delegate({
    ...input,
    model: fallback.id,
    sessionId: first.sessionId,
  });
}

export function createOpenCodeMcpServer(provider: McpProvider) {
  const server = new McpServer(
    { name: "integritas-opencode-bridge", version: "1.0.0" },
    {
      instructions:
        "Use these tools only for substantial coding and technical workloads. Keep small tasks local. For large work, decompose independent branches, use opencode_parallel, then verify and synthesize in Sol. Never import raw worker transcripts.",
    },
  );

  server.registerTool(
    "opencode_health",
    {
      title: "Check OpenCode worker",
      description: "Use this when you need to confirm that the private OpenCode Go worker is configured and reachable before delegating work.",
      inputSchema: {},
      outputSchema: {
        status: z.enum(["ready", "configuration_required", "provider_unavailable"]),
        provider: z.literal("opencode-go"),
        liveModelCount: z.number().int().nonnegative(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async () => {
      if (!provider.isConfigured()) {
        const structuredContent = { status: "configuration_required" as const, provider: "opencode-go" as const, liveModelCount: 0 };
        return { structuredContent, content: [{ type: "text", text: "The OpenCode worker needs its server-side credential." }] };
      }
      try {
        const models = await provider.listModels();
        const structuredContent = { status: "ready" as const, provider: "opencode-go" as const, liveModelCount: models.length };
        return { structuredContent, content: [{ type: "text", text: `OpenCode is reachable with ${models.length} live models.` }] };
      } catch {
        const structuredContent = { status: "provider_unavailable" as const, provider: "opencode-go" as const, liveModelCount: 0 };
        return { structuredContent, content: [{ type: "text", text: "OpenCode is temporarily unavailable." }], isError: true };
      }
    },
  );

  server.registerTool(
    "opencode_models",
    {
      title: "List OpenCode Go models",
      description: "Use this when choosing a current OpenCode Go worker model by capability and cost. Availability is queried live.",
      inputSchema: {},
      outputSchema: { models: z.array(z.object({
        id: z.string(), name: z.string(), family: z.string(), transport: z.string(), reasoning: z.boolean(),
        toolCall: z.boolean(), contextTokens: z.number().nullable(), outputTokens: z.number().nullable(),
        inputCost: z.number().nullable(), outputCost: z.number().nullable(),
      })) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async () => {
      const models = await listModelsSafely(provider);
      return { structuredContent: { models }, content: [{ type: "text", text: `Found ${models.length} live OpenCode Go models.` }] };
    },
  );

  server.registerTool(
    "opencode_delegate",
    {
      title: "Delegate technical work",
      description: "Use this for one bounded, substantial coding or technical-analysis task when external worker effort saves Sol context. Sol remains responsible for verification.",
      inputSchema: {
        task: z.string(), model: z.string().optional(), sessionId: z.string().optional(), timeoutMs: z.number().optional(),
      },
      outputSchema: workerResultShape,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (raw) => {
      const input = validateDelegateInput(raw);
      const models = await listModelsSafely(provider);
      const selected = selectWorkerModel(models, inferPurpose(input.task), input.model);
      return toolResult(await delegateWithFallback(provider, input, models, selected, !input.model));
    },
  );

  server.registerTool(
    "opencode_parallel",
    {
      title: "Delegate parallel technical work",
      description: "Use this for two to eight independent coding or technical-analysis branches. Results stay ordered and concurrency is capped at four.",
      inputSchema: {
        tasks: z.array(z.string()), model: z.string().optional(), maxConcurrency: z.number().optional(), timeoutMs: z.number().optional(),
      },
      outputSchema: { results: z.array(z.object(workerResultShape)), model: z.string(), concurrency: z.number().int() },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (raw) => {
      const input = validateParallelInput(raw);
      const models = await listModelsSafely(provider);
      const selected = selectWorkerModel(models, "explore", input.model);
      const results = await runParallel(input.tasks, input.maxConcurrency, (task) =>
        delegateWithFallback(
          provider,
          { task, model: input.model, timeoutMs: input.timeoutMs },
          models,
          selected,
          !input.model,
        ),
      );
      const structuredContent = { results, model: selected.id, concurrency: input.maxConcurrency };
      return { structuredContent, content: [{ type: "text", text: `Completed ${results.filter((item) => item.ok).length} of ${results.length} bounded branches. Sol should reconcile the structured results.` }] };
    },
  );

  server.registerTool(
    "opencode_review",
    {
      title: "Review a technical result",
      description: "Use this for an independent critique of code, a plan, or a worker result. A different model family is selected when possible.",
      inputSchema: { content: z.string(), model: z.string().optional(), timeoutMs: z.number().optional() },
      outputSchema: workerResultShape,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ content, model, timeoutMs }) => {
      const input = validateDelegateInput({ task: content, model, timeoutMs });
      const models = await listModelsSafely(provider);
      const selected = input.model
        ? selectWorkerModel(models, "review", input.model)
        : selectCriticModel(models);
      return toolResult(await provider.review(input.task, selected.id, input.timeoutMs));
    },
  );

  server.registerTool(
    "opencode_verify",
    {
      title: "Verify task against result",
      description: "Use this when a separate OpenCode worker should compare a technical result with its original task and identify concrete discrepancies for Sol.",
      inputSchema: { task: z.string(), result: z.string(), model: z.string().optional(), timeoutMs: z.number().optional() },
      outputSchema: workerResultShape,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ task, result, model, timeoutMs }) => {
      const validatedTask = validateDelegateInput({ task, model, timeoutMs });
      const validatedResult = validateDelegateInput({ task: result, timeoutMs });
      const models = await listModelsSafely(provider);
      const selected = validatedTask.model
        ? selectWorkerModel(models, "verify", validatedTask.model)
        : selectCriticModel(models);
      return toolResult(await provider.verify(validatedTask.task, validatedResult.task, selected.id, validatedTask.timeoutMs));
    },
  );

  return server;
}

export async function handleMcpRequest(request: Request, dependencies: McpDependencies) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createOpenCodeMcpServer(dependencies.provider);
  await server.connect(transport);
  return transport.handleRequest(request, {
    authInfo: {
      token: "sites-authenticated",
      clientId: request.headers.get("oai-authenticated-user-email") ?? "unknown",
      scopes: ["opencode:delegate"],
    },
  });
}

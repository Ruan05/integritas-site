import type {
  DelegateInput,
  ProviderModel,
  ProviderTransport,
  WorkerResult,
} from "./contracts";

const GO_BASE_URL = "https://opencode.ai/zen/go/v1";
const CATALOG_URL = "https://models.opencode.ai/api.json";
const CLIENT_IDENTITY = "integritas-opencode-bridge/1.0 (+https://integritass.com)";
const MAX_RESULT_CHARS = 12_000;

type FetchLike = typeof fetch;

type ProviderOptions = {
  apiKey?: string;
  fetch?: FetchLike;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  randomUUID?: () => string;
};

type CatalogModel = {
  id?: string;
  name?: string;
  family?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number };
};

function transportForPackage(packageName: string | undefined): ProviderTransport {
  if (packageName?.includes("anthropic")) return "messages";
  if (packageName === "@ai-sdk/openai") return "responses";
  return "chat_completions";
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 40)
    : [];
}

function removeReasoning(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim()
    .slice(0, MAX_RESULT_CHARS);
}

function extractText(payload: Record<string, unknown>, transport: ProviderTransport): string {
  if (transport === "responses") {
    if (typeof payload.output_text === "string") return payload.output_text;
    const output = Array.isArray(payload.output) ? payload.output : [];
    return output
      .flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const content = Array.isArray((item as { content?: unknown }).content)
          ? (item as { content: unknown[] }).content
          : [];
        return content.flatMap((part) =>
          part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
            ? [(part as { text: string }).text]
            : [],
        );
      })
      .join("\n");
  }

  if (transport === "messages") {
    const content = Array.isArray(payload.content) ? payload.content : [];
    return content
      .flatMap((part) =>
        part && typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
          ? [(part as { text: string }).text]
          : [],
      )
      .join("\n");
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const message = choices[0] && typeof choices[0] === "object"
    ? (choices[0] as { message?: unknown }).message
    : undefined;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) =>
      part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
        ? [(part as { text: string }).text]
        : [],
    )
    .join("\n");
}

function parseConclusion(text: string) {
  const cleaned = removeReasoning(text);
  try {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      return {
        finalResult: removeReasoning(String(parsed.finalResult ?? "")),
        evidence: safeArray(parsed.evidence),
        filesChanged: safeArray(parsed.filesChanged),
        testsRun: safeArray(parsed.testsRun),
        uncertainties: safeArray(parsed.uncertainties),
        recommendedNextAction: removeReasoning(String(parsed.recommendedNextAction ?? "")),
      };
    }
  } catch {
    // A useful plain-text conclusion is safer than returning a raw provider object.
  }
  return {
    finalResult: cleaned,
    evidence: [],
    filesChanged: [],
    testsRun: [],
    uncertainties: cleaned ? ["The worker returned plain text rather than the requested JSON shape."] : [],
    recommendedNextAction: "Have Sol verify the conclusion before acting.",
  };
}

function errorDetails(status?: number, timedOut = false) {
  if (timedOut) return { code: "TIMEOUT", message: "The OpenCode worker timed out.", retryable: true };
  if (status === 401 || status === 403) {
    return { code: "AUTHENTICATION_FAILED", message: "OpenCode rejected the server credential or account access.", retryable: false };
  }
  if (status === 429) return { code: "RATE_LIMITED", message: "OpenCode is currently rate limited.", retryable: true };
  if (status && status >= 500) return { code: "PROVIDER_UNAVAILABLE", message: "OpenCode is temporarily unavailable.", retryable: true };
  return { code: "PROVIDER_ERROR", message: "OpenCode could not complete the request.", retryable: false };
}

export class OpenCodeProvider {
  private readonly apiKey?: string;
  private readonly fetcher: FetchLike;
  private readonly clock: () => number;
  private readonly sleeper: (milliseconds: number) => Promise<void>;
  private readonly uuid: () => string;

  constructor(options: ProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? fetch;
    this.clock = options.now ?? Date.now;
    this.sleeper = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.uuid = options.randomUUID ?? (() => crypto.randomUUID());
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async listModels(): Promise<ProviderModel[]> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": CLIENT_IDENTITY,
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const [liveResponse, catalogResponse] = await Promise.all([
      this.fetcher(`${GO_BASE_URL}/models`, { headers }),
      this.fetcher(CATALOG_URL, { headers: { accept: "application/json", "user-agent": CLIENT_IDENTITY } })
        .catch(() => null),
    ]);
    if (!liveResponse.ok) throw new Error(errorDetails(liveResponse.status).code);
    const live = (await liveResponse.json()) as { data?: Array<{ id?: string }> };
    const catalog = catalogResponse?.ok
      ? (await catalogResponse.json()) as Record<string, { npm?: string; models?: Record<string, CatalogModel> }>
      : {};
    const goCatalog = catalog["opencode-go"];
    const transport = transportForPackage(goCatalog?.npm);

    return (live.data ?? []).flatMap((entry) => {
      if (!entry.id) return [];
      const metadata = goCatalog?.models?.[entry.id];
      return [{
        id: entry.id,
        name: metadata?.name ?? entry.id,
        family: metadata?.family ?? entry.id.split("-")[0] ?? entry.id,
        transport,
        reasoning: metadata?.reasoning === true,
        toolCall: metadata?.tool_call === true,
        contextTokens: metadata?.limit?.context ?? null,
        outputTokens: metadata?.limit?.output ?? null,
        inputCost: metadata?.cost?.input ?? null,
        outputCost: metadata?.cost?.output ?? null,
      } satisfies ProviderModel];
    });
  }

  async delegate(input: DelegateInput): Promise<WorkerResult> {
    const startedAt = this.clock();
    const sessionId = input.sessionId ?? this.uuid();
    if (!this.apiKey) {
      return this.failure(input.model ?? "", sessionId, startedAt, {
        code: "CONFIGURATION_REQUIRED",
        message: "The OpenCode server credential has not been configured.",
        retryable: false,
      });
    }

    let models: ProviderModel[];
    try {
      models = await this.listModels();
    } catch {
      return this.failure(input.model ?? "", sessionId, startedAt, errorDetails(503));
    }
    const model = input.model ? models.find((candidate) => candidate.id === input.model) : models[0];
    if (!model) {
      return this.failure(input.model ?? "", sessionId, startedAt, {
        code: "MODEL_NOT_AVAILABLE",
        message: "The requested model is not in the live OpenCode Go model list.",
        retryable: false,
      });
    }

    const prompt = [
      "Act as a bounded coding worker. Return conclusions and verifiable evidence, never private chain-of-thought.",
      "Return one JSON object with: finalResult, evidence, filesChanged, testsRun, uncertainties, recommendedNextAction.",
      "Be concise. Do not claim files changed or tests run unless the task context proves it.",
      "TASK:",
      input.task,
    ].join("\n");

    const endpoint = model.transport === "responses" ? "responses" : model.transport === "messages" ? "messages" : "chat/completions";
    const body = model.transport === "responses"
      ? { model: model.id, input: prompt, max_output_tokens: 4_096 }
      : model.transport === "messages"
        ? { model: model.id, max_tokens: 4_096, messages: [{ role: "user", content: prompt }] }
        : { model: model.id, max_tokens: 4_096, messages: [{ role: "user", content: prompt }] };

    const headers = {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": CLIENT_IDENTITY,
      "x-opencode-session": sessionId,
    };

    let lastStatus: number | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetcher(`${GO_BASE_URL}/${endpoint}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(input.timeoutMs),
        });
        lastStatus = response.status;
        if (response.ok) {
          const payload = (await response.json()) as Record<string, unknown>;
          const conclusion = parseConclusion(extractText(payload, model.transport));
          return {
            ok: true,
            ...conclusion,
            model: model.id,
            provider: "opencode-go",
            sessionId,
            durationMs: Math.max(0, this.clock() - startedAt),
          };
        }
        if ((response.status !== 429 && response.status < 500) || attempt === 2) break;
      } catch (error) {
        const timedOut = error instanceof DOMException && error.name === "TimeoutError";
        if (timedOut) return this.failure(model.id, sessionId, startedAt, errorDetails(undefined, true));
        if (attempt === 2) return this.failure(model.id, sessionId, startedAt, errorDetails(503));
      }
      await this.sleeper(attempt === 0 ? 500 : 1_500);
    }

    return this.failure(model.id, sessionId, startedAt, errorDetails(lastStatus));
  }

  async review(content: string, model: string, timeoutMs = 60_000) {
    return this.delegate({ task: `Review this technical result for correctness, missing evidence, and risky assumptions:\n\n${content}`, model, timeoutMs });
  }

  async verify(task: string, result: string, model: string, timeoutMs = 60_000) {
    return this.delegate({ task: `Verify whether the result satisfies the task. Identify concrete discrepancies only.\n\nTASK:\n${task}\n\nRESULT:\n${result}`, model, timeoutMs });
  }

  private failure(
    model: string,
    sessionId: string,
    startedAt: number,
    error: { code: string; message: string; retryable: boolean },
  ): WorkerResult {
    return {
      ok: false,
      finalResult: "",
      evidence: [],
      filesChanged: [],
      testsRun: [],
      model,
      provider: "opencode-go",
      sessionId,
      durationMs: Math.max(0, this.clock() - startedAt),
      uncertainties: [],
      recommendedNextAction: error.retryable ? "Retry later or let Sol complete the task directly." : "Review the bridge configuration or choose another live model.",
      error,
    };
  }
}

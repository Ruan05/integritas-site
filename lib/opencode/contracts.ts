export type ProviderTransport = "chat_completions" | "responses" | "messages";

export type ProviderModel = {
  id: string;
  name: string;
  family: string;
  transport: ProviderTransport;
  reasoning: boolean;
  toolCall: boolean;
  contextTokens: number | null;
  outputTokens: number | null;
  inputCost: number | null;
  outputCost: number | null;
};

export type DelegateInput = {
  task: string;
  model?: string;
  sessionId?: string;
  timeoutMs: number;
};

export type WorkerResult = {
  ok: boolean;
  finalResult: string;
  evidence: string[];
  filesChanged: string[];
  testsRun: string[];
  model: string;
  provider: "opencode-go";
  sessionId: string;
  durationMs: number;
  uncertainties: string[];
  recommendedNextAction: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

import type { ProviderModel } from "./contracts";

export type WorkerPurpose = "explore" | "analyze" | "implement" | "review" | "verify";

function cost(model: ProviderModel) {
  return (model.inputCost ?? 1_000) + (model.outputCost ?? 1_000);
}

function capability(model: ProviderModel) {
  return (model.reasoning ? 1_000_000_000 : 0) +
    (model.contextTokens ?? 0) +
    (model.outputTokens ?? 0) +
    (model.toolCall ? 1_000_000 : 0);
}

export function selectWorkerModel(
  models: ProviderModel[],
  purpose: WorkerPurpose,
  requestedModel?: string,
): ProviderModel {
  if (models.length === 0) throw new Error("No live OpenCode Go models are available.");
  if (requestedModel) {
    const requested = models.find((model) => model.id === requestedModel);
    if (!requested) throw new Error("The requested model is not in the live model list.");
    return requested;
  }

  const candidates = [...models];
  if (purpose === "explore" || purpose === "analyze") {
    candidates.sort((left, right) => cost(left) - cost(right) || capability(right) - capability(left));
    return candidates[0];
  }

  const reasoning = candidates.filter((model) => model.reasoning);
  const capable = reasoning.length > 0 ? reasoning : candidates;
  capable.sort((left, right) => capability(right) - capability(left) || cost(left) - cost(right));
  return capable[0];
}

export function selectCriticModel(models: ProviderModel[], primaryModelId?: string) {
  const primary = models.find((model) => model.id === primaryModelId);
  const differentFamily = primary
    ? models.filter((model) => model.family !== primary.family)
    : models;
  return selectWorkerModel(differentFamily.length > 0 ? differentFamily : models, "review");
}

import { z } from "zod";
import type { DelegateInput } from "./contracts";

export const MAX_TASK_CHARS = 60_000;
export const MAX_PARALLEL_TASKS = 8;
export const MAX_COMBINED_TASK_CHARS = 160_000;
export const MAX_CONCURRENCY = 4;
export const MIN_TIMEOUT_MS = 5_000;
export const MAX_TIMEOUT_MS = 120_000;

const sessionIdSchema = z.string().uuid("Session ID must be a UUID.");

const delegateSchema = z.object({
  task: z
    .string()
    .trim()
    .min(1, "Task is required.")
    .max(MAX_TASK_CHARS, "Task is too large."),
  model: z.string().trim().min(1).max(120).optional(),
  sessionId: sessionIdSchema.optional(),
  timeoutMs: z
    .number()
    .int()
    .min(MIN_TIMEOUT_MS, "Timeout must be at least 5000ms.")
    .max(MAX_TIMEOUT_MS, "Timeout must not exceed 120000ms.")
    .default(60_000),
});

const parallelSchema = z
  .object({
    tasks: z
      .array(z.string().trim().min(1, "Each task is required.").max(MAX_TASK_CHARS, "Task is too large."))
      .min(1)
      .max(MAX_PARALLEL_TASKS, "Use at most 8 tasks."),
    maxConcurrency: z
      .number()
      .int()
      .min(1)
      .max(MAX_CONCURRENCY, "Concurrency must not exceed 4.")
      .default(3),
    model: z.string().trim().min(1).max(120).optional(),
    timeoutMs: z
      .number()
      .int()
      .min(MIN_TIMEOUT_MS)
      .max(MAX_TIMEOUT_MS)
      .default(60_000),
  })
  .superRefine((value, context) => {
    const total = value.tasks.reduce((sum, task) => sum + task.length, 0);
    if (total > MAX_COMBINED_TASK_CHARS) {
      context.addIssue({
        code: "custom",
        message: "Combined task size must not exceed 160000 characters.",
        path: ["tasks"],
      });
    }
  });

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new Error(result.error.issues[0]?.message ?? "Invalid input.");
}

export function validateDelegateInput(input: unknown): DelegateInput {
  return parseOrThrow(delegateSchema, input);
}

export function validateParallelInput(input: unknown) {
  return parseOrThrow(parallelSchema, input);
}

# OpenCode Go Delegation Bridge Design

## Goal

Add a private, persistent MCP service to the existing Integritas Sites deployment so ChatGPT Work can delegate bounded coding-agent workloads to the user's OpenCode Go subscription, receive concise structured results, and keep Sol responsible for routing, verification, and final synthesis.

## Scope

The first production slice is tool-only. It does not add a public page, change the Integritas admin UI, or attempt to turn OpenCode Go into a general-chat proxy. It exposes six MCP tools: `opencode_health`, `opencode_models`, `opencode_delegate`, `opencode_parallel`, `opencode_review`, and `opencode_verify`.

This slice supports repository analysis and code generation when Sol supplies a bounded task and the relevant repository context. It does not provide OpenCode with an independent persistent filesystem or Git checkout. Direct repository mutation by a remote worker is a later capability requiring a sandboxed runner and repository authorization.

## Architecture

The existing Integritas Site remains the only deployed service. A `/mcp` Streamable HTTP endpoint registers focused tools. Each tool authorizes the ChatGPT-authenticated caller, validates and bounds its input, invokes a modular OpenCode provider client, and returns a normalized result. The provider key exists only as the encrypted Sites runtime secret `OPENCODE_GO_API_KEY`.

The provider client discovers the live Go model list from `https://opencode.ai/zen/go/v1/models` and enriches it with the public OpenCode model catalog when available. Transport is selected from provider metadata rather than model names. The current Go provider is OpenAI-compatible and uses `/chat/completions`; the adapter also isolates response parsing so future Responses or Messages transports can be supported without changing MCP tools.

## Authentication and secrets

Sites' ChatGPT sign-in boundary is the primary client authentication mechanism. `/mcp` fails closed unless the trusted Sites dispatch supplies an authenticated user header. No wildcard CORS policy is added. The OpenCode key is read only from server runtime state and is never included in source, logs, errors, or tool results.

The bridge returns only safe request metadata: status, duration, provider, model, session ID, and normalized outcome. It does not log prompts, task bodies, provider authorization headers, raw provider responses, or generated content.

Because the credential cannot safely move through chat or connector output, entering `OPENCODE_GO_API_KEY` in the Sites secret field is the single expected external security gate.

## Provider behavior

- Base URL: `https://opencode.ai/zen/go/v1`.
- Client identity: a narrow Integritas bridge user agent, never a broad browser identity.
- Session: every call sends `x-opencode-session`; absent IDs are generated with Web Crypto UUIDs and returned to the trusted caller.
- Models: queried live and never permanently hardcoded.
- Limits: one task is at most 60,000 characters; one parallel request contains at most eight tasks and 160,000 total characters; concurrency is capped at four; timeouts are bounded from 5 to 120 seconds.
- Retries: at most two conservative retries for 429 and retryable 5xx/network failures. Authentication and validation failures are never retried.
- Errors: 401/403, 429, timeout, 5xx, invalid model, and malformed provider output become stable sanitized error codes.
- Output: final result, evidence/citations when explicitly returned, proposed files changed, tests proposed or run, provider, model, session ID, duration, uncertainties, and recommended next action.
- Reasoning privacy: reasoning-specific fields and `<think>` blocks are discarded; prompts explicitly request conclusions and evidence only.

## Routing policy

Sol handles small requests directly. For medium requests, Sol sends one bounded task and verifies the result. For large requests, Sol decomposes independent branches, calls `opencode_parallel`, optionally calls `opencode_review` or `opencode_verify` with a different model family, resolves conflicts, and returns the final answer. Very large work is staged; raw worker transcripts are never re-imported.

Default model selection is dynamic. Low-cost catalog models are preferred for exploration and repetitive analysis; stronger reasoning-capable models are preferred for difficult implementation; critique tries to use a different family. User-specified models are accepted only when present in the live Go model list.

## Testing and verification

Implementation follows red-green-refactor. Unit tests cover validation, session generation and reuse, model routing, provider request headers, output normalization, reasoning removal, error sanitization, retry policy, and concurrency limits. MCP contract tests cover initialization, tool listing, unauthorized rejection, and representative tool calls.

Deployment is not success. After publishing, verification must prove the protected endpoint is reachable, unauthorized calls fail, the secret is absent from outputs, live models are retrieved, one real technical delegation succeeds, the returned session ID can be reused as an upstream cache/session identifier, parallel limits hold, and ChatGPT can complete one end-to-end round trip. Without the credential, the final state is explicitly `EXTERNAL SECURITY GATE`, not configured or complete.

## Rollback

Rollback is a Sites deployment of the previously published version. The provider module and MCP route are isolated from the Integritas UI and data model, so removing them does not require a database migration.

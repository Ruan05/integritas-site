# OpenCode Go Delegation Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Integritas Site expose a private MCP bridge that lets Sol delegate bounded coding work to OpenCode Go with concise, safe results.

**Architecture:** A tool-only `/mcp` endpoint calls a modular OpenCode provider adapter. Sites supplies persistent hosting, ChatGPT authentication, and encrypted runtime secrets; provider requests are bounded, session-aware, dynamically routed, and normalized before reaching Sol.

**Tech Stack:** TypeScript, Next/Vinext, Cloudflare Workers, Model Context Protocol TypeScript SDK, Zod, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-opencode-go-bridge-design.md`

## Global Constraints

- Keep `OPENCODE_GO_API_KEY` server-side and never print, log, return, commit, or place it in client code.
- Use `https://opencode.ai/zen/go/v1`, a specific client identity, and `x-opencode-session` on every provider request.
- Query live model availability; do not hardcode a permanent model list.
- Return concise normalized results and never hidden chain-of-thought or raw worker transcripts.
- Maximum eight parallel tasks, concurrency four, 120-second timeout, and two conservative retries.
- Do not change the public Integritas UI, CRM, case workflow, or database schema.

---

### Task 1: Provider contracts and validation

**Files:**
- Create: `lib/opencode/contracts.ts`
- Create: `lib/opencode/validation.ts`
- Test: `tests/opencode-contracts.test.mjs`

**Interfaces:**
- Produces: `DelegateInput`, `WorkerResult`, `ProviderModel`, `validateDelegateInput`, `validateParallelInput`, and stable size constants.

- [ ] Write tests that import the wished-for validation API and assert accepted inputs plus rejections for oversized tasks, excessive task counts, excessive combined size, invalid timeouts, and malformed session IDs.
- [ ] Run `node --test tests/opencode-contracts.test.mjs` and confirm it fails because the modules do not exist.
- [ ] Implement the minimal contracts and Zod validation required by the tests.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: OpenCode provider adapter

**Files:**
- Create: `lib/opencode/provider.ts`
- Test: `tests/opencode-provider.test.mjs`

**Interfaces:**
- Consumes: validated inputs and `WorkerResult` from Task 1.
- Produces: `OpenCodeProvider`, `listModels`, `delegate`, `review`, and `verify` with injected `fetch`, clock, and sleeper dependencies for deterministic tests.

- [ ] Write failing tests for live model discovery, catalog intersection, specific client identification, bearer authentication, random/reused `x-opencode-session`, transport selection, normalized outputs, `<think>` removal, sanitized 401/403/429/timeout/5xx errors, and bounded retry behavior.
- [ ] Run `node --test tests/opencode-provider.test.mjs` and verify the expected missing-implementation failure.
- [ ] Implement the smallest provider adapter that satisfies the tests, using Web Crypto for session IDs and `AbortSignal.timeout` for request deadlines.
- [ ] Re-run the focused test and refactor only while it remains green.

### Task 3: Dynamic routing and bounded parallel work

**Files:**
- Create: `lib/opencode/routing.ts`
- Create: `lib/opencode/parallel.ts`
- Test: `tests/opencode-routing.test.mjs`

**Interfaces:**
- Consumes: live `ProviderModel[]` and the provider `delegate` function.
- Produces: `selectWorkerModel`, `selectCriticModel`, and `runParallel`.

- [ ] Write failing tests proving inexpensive capable models are preferred for exploration, hard tasks prefer stronger reasoning models, critique changes family when possible, explicit live models are honored, and concurrency never exceeds four.
- [ ] Run the focused test and confirm the failure is caused by missing behavior.
- [ ] Implement deterministic scoring and a small promise worker pool.
- [ ] Re-run the focused test and keep the implementation minimal.

### Task 4: MCP tool-only server

**Files:**
- Create: `lib/opencode/mcp-server.ts`
- Create: `app/mcp/route.ts`
- Modify: `.openai/hosting.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/opencode-mcp.test.mjs`

**Interfaces:**
- Consumes: provider, routing, parallel execution, and trusted ChatGPT identity headers.
- Produces: `/mcp` Streamable HTTP with `opencode_health`, `opencode_models`, `opencode_delegate`, `opencode_parallel`, `opencode_review`, and `opencode_verify`.

- [ ] Write failing MCP contract tests for initialization, tool metadata, concise output schemas, unauthenticated rejection, missing-key health status, and representative calls through injected provider doubles.
- [ ] Run the focused test and verify it fails for the missing endpoint/server.
- [ ] Add the official MCP SDK dependency and implement a stateless tool-only endpoint.
- [ ] Add the Sites MCP capability declaration without changing existing bindings.
- [ ] Re-run the focused test and refactor only while green.

### Task 5: Full local quality gate

**Files:**
- Modify only files implicated by failures.

**Interfaces:**
- Produces: a buildable, lint-clean, regression-tested Site archive candidate.

- [ ] Run all OpenCode tests and the existing test suite.
- [ ] Run `npm run lint` and repair only bridge-related failures.
- [ ] Run `npm run build` and verify `/mcp` is present in the route manifest.
- [ ] Scan tracked source and build output for credential-like values and forbidden task-content logging.
- [ ] Commit the exact validated source.

### Task 6: Publish and verify the security gate

**Files:**
- No source changes unless deployment reveals a tested defect.

**Interfaces:**
- Produces: one saved and deployed Integritas Sites version with an MCP connection descriptor.

- [ ] Push the validated commit to the existing Sites source repository.
- [ ] Package the exact commit and deploy one new version to the existing audience.
- [ ] Confirm `get_site(include_mcp_connection=true)` returns the MCP URL and OAuth resource.
- [ ] Verify unauthenticated requests are rejected and tool metadata exposes no secret.
- [ ] If `OPENCODE_GO_API_KEY` is missing, stop at the single secure Sites secret-entry gate and do not claim live success.

### Task 7: Live end-to-end verification after credential entry

**Files:**
- No source changes unless a live defect is reproduced by a failing test first.

**Interfaces:**
- Produces: verified live model list, delegated result, session reuse, bounded parallel result, and ChatGPT round trip.

- [ ] Call `opencode_health` and `opencode_models` through the published MCP connection.
- [ ] Delegate one bounded technical task and verify the structured result omits reasoning fields.
- [ ] Reuse its session ID in a follow-up and verify acceptance.
- [ ] Run a parallel task set and confirm observed concurrency stays within four.
- [ ] Run a moderately large decomposed task and confirm only compressed branch results return to Sol.
- [ ] Report `FULL SUCCESS` only after the complete Me → Sol → OpenCode → Sol round trip succeeds.

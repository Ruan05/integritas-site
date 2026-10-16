# DD Agent Context and Full-Run Launch Plan

> **Execution contract:** Follow this plan with test-first changes. Run each task in order, keep the progress ledger current, and verify the exact live source and deployment before reporting completion.

**Goal:** Make Integritas DD chat support ordinary tool-using Q&A, linked case-history follow-ups, and full-DD runs from typed requests, URLs, or documents; repair the live entityless-analysis failure without relaxing evidence gates.

**Architecture:** Keep the existing Supabase case-chat broker and Oracle/OpenClaw worker. Add pure, bounded context-selection helpers for the Edge Function and the browser intake path. Preserve case filtering, existing intake sealing, receipts, access, Oracle routing, and report validation. Fix entity normalization in the deployed runner repository through its approved production branch.

**Tech:** Next.js/React + TypeScript, Supabase Edge Functions (Deno), Node test runner/Vitest as used by the repos, OpenClaw analysis runner, GitHub PR/CI, Sites versioned deployment, controlled Oracle release.

## Global constraints

- Follow the design at `docs/superpowers/specs/2026-10-16-dd-agent-context-and-launch-design.md`.
- Never include another case’s messages, documents, reports, entities, sources, or jobs.
- Preserve authentication, RLS/service-role access checks, provider receipts, current file/brief limits, active-run confirmation, and evidence admission gates.
- Keep `openclaw-oracle` as the active production DD route; do not enable Ruan.
- Do not retry ambiguous billed provider calls. Do not widen or reset investigation budgets.
- Keep prompts, uploaded content, source URLs, web excerpts, and saved memory untrusted. Never expose service credentials or worker tokens.
- TDD each production behavior: add a focused test, run it and observe failure, implement, run it and observe pass.
- Run final fresh full tests and review before pushing, publishing, merging, or deploying.

## Tasks

### Task 1 — Enable typed DD briefs and existing-case revisions

**Files:** `lib/intake-browser.ts`, `tests/intake-brief.test.mjs`, `components/IntegritasAdminWorkspace.tsx`, `components/CaseAgentChat.tsx`, the admin API contract/handler, and one versioned SQL migration in `Ruan05/integritas`.

1. Add failing tests for converting an empty file selection plus a nonblank typed brief/URL into a text/plain file, and for rejecting a blank brief with no files.
2. Run `node --test tests/intake-brief.test.mjs`; confirm the expected failures.
3. Implement a pure brief-file helper; retain the 3,000-character cap and supported text/plain path.
4. Add an explicit “Run full DD” action beside “Send message” for an existing case. In new-case mode or when uploads are selected, make the primary action seal a full DD revision.
5. Route generated brief files through the existing intake path for new cases or cases with no verified documents. Preserve confirmation when replacing an active run and include prior case conversation from `chat_context`.
6. For an existing case with verified evidence and no newly selected files, add a question-only revision path that reuses verified evidence through `integritas_private.accept_intake_context` with a null batch. Do not add a synthetic document or consume another slot in the 20-document cap.
7. Add a private idempotency table and service-role-only SQL wrapper. The wrapper must check the authenticated CRM actor's case access, validate the client key and sealed brief bounds, call the existing intake function transactionally, return the stored result for an exact retry, and reject reuse of a key with a different request. A fresh key with materially updated question or context can create a new revision; identical current material remains subject to the existing intake dedupe.
8. Add an admin API action that independently checks case access, validates the bounded request, calls only the wrapper RPC, audits a first request, and maps active-run/revision conflicts to safe 409 responses. Keep the existing authenticated caller identity and service role private.
9. Re-run focused tests, `npm run build`, and UI/intake tests; review the SQL grants and function search path before applying the migration.

**Review focus:** no silent auto-classification of ordinary messages; typed links enter the sealed evidence workflow only when the user chooses full DD; existing case evidence stays immutable; no duplicate document at the cap; same-key retries do not create another revision; no stale draft or attachment loss on failed intake.

### Task 2 — Supply useful, bounded case history to chat

**Files:** new `lib/case-chat-context.mjs`, `supabase/functions/integritas-case-chat/index.ts`, new `tests/case-chat-context.test.mjs`.

1. Add failing tests for question-relevant excerpts, deterministic bounds, source URL sanitization, and cross-case rejection by the case-ID selection/filter contract.
2. Run `node --test tests/case-chat-context.test.mjs`; confirm failure.
3. Implement the pure excerpt/bounds/URL helpers. Select query-relevant document passages while preserving document identifiers and explicit truncation metadata.
4. Expand the case-scoped broker payload with entities, relationships, source-linked findings, source register, bounded prior reports, multiple jobs/checkpoints, and relevant documents. Keep all queries filtered by the authorized case ID.
5. Attach the enriched data inside the existing `case` context so the deployed Oracle bridge passes it through without an uncoordinated server release.
6. Correct the worker policy to accurately describe Oracle/OpenClaw live search/fetch and the current Oracle full-DD route; do not reference Ruan as the intended live route.
7. Run focused helper tests, Edge Function type/lint checks where configured, and the site test/build suite.

**Review focus:** query size and output size stay bounded; source keys, URLs, excerpts, retrieval/verification state, revisions and job IDs remain intact; current chat tools still cannot mutate case evidence, routes, or access.

### Task 3 — Recover safely from empty model entity output

**Files in `Ruan05/integritas` on `integritas-command-center-foundation`:** `infra/openclaw/large-investigation-agent-runner-v2.mjs`, new pure helper `infra/openclaw/case-analysis-entity-recovery.mjs`, new focused Node regression tests.

1. Add failing tests for: model findings plus empty entities merges only explicit deterministic entities; findings without a valid entity link remain unlinked; deterministic extraction with no entities preserves the hard failure; model-authored findings/relationships/contradictions are not rewritten.
2. Run the focused test; confirm failures.
3. Implement a pure helper that returns the original analysis unchanged when model entities exist, safely merges deterministic explicit entities only when the model entity array is empty, and never adds model-derived assertions or invented links.
4. Call the helper after model analysis admission and before the existing entity gate. Preserve audit and report-admission gates.
5. Run focused tests, runner lint/tests, and all CI required checks on a PR into `integritas-command-center-foundation`.

**Review focus:** no provider call or spend expansion; deterministic labels remain proposed/unverified; no new unsupported relationships; truly entityless evidence still fails closed.

### Task 4 — End-to-end verify, review, and release

**Files:** docs and deployment artifacts only as required by the existing release workflow.

1. Run a fresh full Sites test/build suite and all runner tests/CI; inspect full diffs and source commit IDs.
2. Complete the required independent code review; fix every important finding test-first and rerun affected/full checks.
3. Confirm the active worker is still `oracle-case-chat`, Oracle is `openclaw-oracle`, and Ruan remains disabled.
4. Check the prior failed run’s cost receipts and existing job/attempt state before any retry; honor the previously authorized per-job and overall budget ceilings.
5. Push the exact Sites source commit, save the built archive for that exact SHA, and deploy the new Sites version preserving public access.
6. Merge the runner PR only after green CI, then use the existing controlled deploy workflow for the exact approved branch HEAD. Do not manually restart or bypass the release guard.
7. Smoke-check the live typed-chat, web-context broker payload, and production DD worker/readiness status. Rerun the previously failed invoice case only if its remaining authorized budget permits; do not claim a report until the report row is actually committed.
8. Update the progress ledger with commit/version/deploy IDs, checks, smoke-test result, any budget stop, and review disposition.

**Review focus:** live deployment uses the exact tested commit; production route and secrets remain unchanged; no failed run is represented as a completed report.

**Execution status (2026-10-16):** PR #30 and the timestamp-alignment follow-up PR #31 are merged; PR #31 CI passed all four jobs, including the disposable PostgreSQL behavior/rollback suite. The applied migration remains `20261016194952_integritas_question_only_revision`; the correction renamed repository files and updated references only. The live admin API/case-chat are v43/v10, and the live Site is still public at v82. The tested Site source is `0133cdd580da2960c2bd059a271490b3c2129bf6`, but it has not been pushed or published. The public v82 page loaded in a read-only browser smoke check. The second manual review pass across the Site context/broker path, backend question-only RPC and throttling, entity-recovery persistence, and SQL behavior tests found no actionable issue. OpenCode review/delegate returned empty findings/evidence and GitHub has no submitted reviews on PRs #30/#31, so there is no external reviewer sign-off; the plan's manual fallback review is recorded here. **Remaining blockers at that checkpoint:** Oracle release, dependent Site publication, production chat/follow-up and attachment smoke checks, and spend reconciliation.

**Continuation update (2026-10-16):** both Oracle and Ruan Desktop Commander devices are online; the controlled Oracle release path is available and still guarded by exact approved-branch-head, ancestry, lock, and pinned-key checks. Oracle root storage was recovered from 100% to 89% use by clearing DNF caches and 504 inactive temporary plugin-build directories with no open handles. No logs, evidence, reports, release history, or OpenClaw state were removed. Current production branch head is `ba08d503abc86d49bd85d0541385088949e929a2`, the PR #31 merge; deployed admin API v43's 11 source files match the current branch exactly. A reviewed compatibility fix now nests bounded conversation context inside `case`, which the Oracle bridge actually forwards. The focused suite, lint, production build, and 55-test Site suite pass. Still outstanding: commit/push exact Site source, deploy case-chat v11, invoke guarded Oracle release, publish Site, then run free and bounded live smoke checks. No paid DD job or full-DD retry has run. Eight chat receipts total about $0.0081, but that is not a full-DD spend ledger; the `$1/job` and `$5 total` limits still prohibit a paid retry until existing DD cost is reconciled.

## Scope checks

- No schema migration or cross-case data access.
- No Site access-policy change.
- No new DD provider or spend path. The question-only RPC must reuse the sealed intake dispatcher and current Oracle route.
- The only schema change allowed is the private idempotency table and its service-role-only, actor-authorized question revision RPC, as specified above.
- No external email/messages; no actions beyond the authorized GitHub, Sites, Supabase, and Oracle release workflow.

## Review Focus

Reviewers should focus on case isolation, public source provenance, bounds and truncation, the UI distinction between chat and full DD, no-upload intake integrity, preserving all prior model findings, and keeping the deployed branch/provider on the approved production route.

# Execution ledger — DD Agent Context and Full-Run Launch

- [x] Research the live Sites source, Supabase broker, active Oracle worker, production route, current failed run, and DD runner branch.
- [x] Write and self-review the design specification and test-first plan.
- [x] Task 1: typed full-DD brief and explicit chat/Run full DD UI.
- [x] Task 2: bounded case history, report/source graph, question-relevant document excerpts.
- [x] Task 3: fail-safe deterministic entity recovery in the production runner.
- [ ] Task 4: full checks, independent review, controlled Oracle release, Supabase chat-broker deployment, Site publication, live smoke check, budget-gated retry, and persistence proof.

## Research facts

- Live case chat worker: `oracle-case-chat` / OpenClaw; live public search and page fetch are configured.
- Live full-DD provider: `openclaw-oracle`; Ruan is not production-ready and remains disabled.
- Broker currently returns a 3,000-character first excerpt per document, 16,000 aggregate characters, 20 findings, one report, one job, and only the current run’s checkpoints. It omits the entity/relationship/source graph.
- Chat bridge can page earlier conversation and passes the whole `case` object to OpenClaw, allowing enrichment inside `case.investigation_context` without replacing the active bridge.
- Prior live DD failed with 14 findings and no normalized entities; the existing deterministic extractor is deliberately limited to labelled/structured parties and does not establish verification.
- PR #30 merged as `015b5a4c97aec5d59d86d252ec36952869d17039`; all CI jobs passed on tested head `96a8d83ee1e9b73d13cf0b07d8d3951c34b39478`.
- Applied migration `20261016194952_integritas_question_only_revision`; catalog checks confirmed the RPC and private receipt table, service-role-only execution, and no receipt-table read access for service roles, anon, or authenticated users.
- Deployed `integritas-admin-api` v43 and `integritas-case-chat` v10 with the reviewed source bundles; `integritas-control` v30 and `integritas-intake-dispatch` v2 remain active with their existing `verify_jwt=false` settings.
- Site lint, build, and 54 tests passed at the pre-compatibility-fix checkpoint. Backend unit tests (11), migration contract checks, and the PostgreSQL behavior/rollback job passed.
- No paid DD job has been launched during this review.

## Task 4 execution record — 2026-10-16

- Backend PR #30 is merged as `015b5a4c97aec5d59d86d252ec36952869d17039`; its recorded checks passed on tested head `96a8d83ee1e9b73d13cf0b07d8d3951c34b39478`.
- Follow-up PR #31 aligned the migration and rollback filenames with the live timestamp. It changed only filenames and test/CI references; the SQL was unchanged. All four CI jobs passed on head `7b77138ba88219a16c77c25f32a3855a3d5a9ab4`; PR #31 merged as `ba08d503abc86d49bd85d0541385088949e929a2`.
- Production migration history still contains exactly `20261016194952_integritas_question_only_revision`; the repository timestamp now matches it. No migration was reapplied after the filename correction.
- The Site source at commit `0133cdd580da2960c2bd059a271490b3c2129bf6` passed lint, build, and 54 tests; its archive hash is `3f7d04f523e54e7400ce5f7bcf54e0ef588bb631a996e264b94d5bf0d55db9be`. The live Site remains active, public, and at version 82. A read-only load of the public page succeeded. The new source has not been pushed or published, and no chat prompt was submitted against production.
- A separate manual review of the final Site changes and timestamp-sync patch found no material code issues. The case-chat reads remain filtered by the authorized case ID, and checkpoint reads are bounded to job IDs already filtered by that case.
- A second manual review pass across the Site broker/context code, backend question-only RPC/rate-limit path, entity-recovery persistence, and SQL behavior tests found no actionable issue. OpenCode review/delegate returned empty findings/evidence and GitHub has no submitted reviews on PRs #30 or #31, so there is no external reviewer sign-off; the plan's manual fallback review is recorded here.
- Desktop Commander was subsequently verified online for both Oracle and Ruan. Oracle's controlled-release guard is available in the production branch; it has not yet been invoked. The earlier “no callable Oracle/OCI tool” statement is superseded.
- Oracle root storage was at 100% with 242 MB free. DNF cache cleanup plus removal of 504 inactive `/tmp/openclaw-plugin-build-*` directories with no open file handles raised free space to 3.5 GB (89% used). Audit logs, report/evidence data, release history, and OpenClaw state were preserved. Recurrence monitoring/retention is still to be set.
- The deployed `integritas-admin-api` v43 bundle exactly matches all 11 files on `integritas-command-center-foundation`; the branch head is `ba08d503abc86d49bd85d0541385088949e929a2`, matching PR #31's merge. PR #31 reports all four CI jobs passing.
- A source inspection found that the Oracle bridge forwards `case` but drops the broker's top-level `conversation_context`. The Site source was corrected to include the bounded conversation in `case.conversation_context`, and the policy now names that contract explicitly. Focused tests pass; lint, production build, and the full suite pass with 55/55 tests. `git diff --check` passes.
- The compatibility correction is not yet committed or pushed. Supabase `integritas-case-chat` remains v10; it must be deployed from the reviewed source as v11. The Site remains public v82; matching Site source is not yet pushed or published.
- **Verification remaining:** no production chat/follow-up, upload, or paired-report prompt has been submitted. No paid DD run was launched. Ruan remains not production-ready and disabled.
- **Spend gate:** eight completed chat replies have explicit receipts totaling 8,053,562 nanodollars (about $0.0081). This does not reconcile full-DD provider spending. The prior DD job remains failed at attempt 32; do not retry it until its spend and remaining `$1/job` / `$5 total` allowance are established.

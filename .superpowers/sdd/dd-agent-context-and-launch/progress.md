# Execution ledger — DD Agent Context and Full-Run Launch

- [x] Research the live Sites source, Supabase broker, active Oracle worker, production route, current failed run, and DD runner branch.
- [x] Write and self-review the design specification and test-first plan.
- [x] Task 1: typed full-DD brief and explicit chat/Run full DD UI.
- [x] Task 2: bounded case history, report/source graph, question-relevant document excerpts.
- [x] Task 3: fail-safe deterministic entity recovery in the production runner.
- [ ] Task 4: full checks, independent review, Sites deployment, controlled Oracle release, live smoke check, budget-gated retry.

## Research facts

- Live case chat worker: `oracle-case-chat` / OpenClaw; live public search and page fetch are configured.
- Live full-DD provider: `openclaw-oracle`; Ruan is not production-ready and remains disabled.
- Broker currently returns a 3,000-character first excerpt per document, 16,000 aggregate characters, 20 findings, one report, one job, and only the current run’s checkpoints. It omits the entity/relationship/source graph.
- Chat bridge can page earlier conversation and passes the whole `case` object to OpenClaw, allowing enrichment inside `case.investigation_context` without replacing the active bridge.
- Prior live DD failed with 14 findings and no normalized entities; the existing deterministic extractor is deliberately limited to labelled/structured parties and does not establish verification.
- PR #30 merged as `015b5a4c97aec5d59d86d252ec36952869d17039`; all CI jobs passed on tested head `96a8d83ee1e9b73d13cf0b07d8d3951c34b39478`.
- Applied migration `20261016194952_integritas_question_only_revision`; catalog checks confirmed the RPC and private receipt table, service-role-only execution, and no receipt-table read access for service roles, anon, or authenticated users.
- Deployed `integritas-admin-api` v43 and `integritas-case-chat` v10 with the reviewed source bundles. Sites source push, version publication, live smoke checks, and cost-gated retry review are pending.
- Site lint, build, and 54 tests passed. Backend unit tests (11), migration contract checks, and the PostgreSQL behavior/rollback job passed.
- No paid DD job has been launched during this review.

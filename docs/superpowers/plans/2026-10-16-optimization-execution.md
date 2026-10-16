# Integritas optimization execution

Approved by user: “Continue using your best judgment to optimize this as per your new design.”

Design: Integritas-Optimization-Autonomous-Plan-2026-10-16.md. Execute W0–W11 in dependency order. Preserve public Site, private evidence, email disabled, $1/job across attempts and $5 aggregate. Unknown spend retains reservations; no paid retries until reconciled. Ruan production admission remains disabled until commissioning passes.

## Baseline

- Public Site v83, source e93b72a4be630369cbc63d588cd89b1bd5ef4a65.
- Backend deployed release 994bd7929b7009619a1a0e37a7a681921ded8c39.
- Live documents size constraint permits 5 MiB; private bucket permits 50 MiB. Existing capacity migrations changed bucket only.
- Oracle chat worker deployed SHA-256 3ef834ca92ce7431417d7f8cf281472451ef7e8eb71ca6b5ef685210841882d9; worker is absent from backend tracked tree. Reconcile before deployment.
- Oracle older checkout has uncommitted report/email work: preserve without deployment.
- Site preexisting plan/progress edits preserved.
- Direct GitHub clone unavailable; use connected GitHub operations against exact parent SHA.

## Execution

- W0: source reconciliation in progress; isolated PostgreSQL container requested for behavior tests (no network, bounded memory/CPU, synthetic data only).
- W1 metadata boundary: PR #33 merged as 10b76f7a839b8fa9fc77ba9c493d5839b2c0f8e0 after independent review and all five CI jobs passed (run38970392867). SQL migration applied as 20261016213829_integritas_document_metadata_capacity; live validated limit52428800 and private bucket verified. Full upload-to-report acceptance remains pending.
- W2 parser: recovered exact live worker into backend source control, added seven Python tests, deployed through original-hash precondition, graceful SIGTERM drain and versioned atomic symlink installation with backup. Source matches merged commit; deployed SHA256 d5a033ba5fe45df1adcfaa51b7e497d14768ca97470fb295bc1cecd219fd3383. Service active; broker heartbeat ready. No paid inference smoke test.
- W4 partial: Ruan policy per-job ceiling reduced5e9->1e9 nanodollars with original-hash check and0600 backup; production_admission remains false. New policy SHA256 afda8b53d230592477e69dbda3b84c0ccf1fe6f8fe4bdd7b496746fb9ac33ea0. Model ledger has no requests; native chat7 settled requests total1690962 nanodollars. Oracle one job ledger25 settled35915531nanos plus6 unresolved reservations833290240nanos. Broker records Oracle chat27475238nanos (estimates/run identifiers do not establish verified provider settlement). Cross-host aggregate cap and reconciliation still pending.
- W9 partial: shared visible polling, pending5s, idlechat30s, idlesnapshot45s; one in-flight poll, queued refresh awaits authoritative read, local activation immediately updates cadence, no repeated unchanged terminal list fetch. Seven scheduler tests pass; independent re-review found no Critical/Important issues. Planned idle cadence implies substantial request reduction, not yet a measured production claim.
- W3 and remaining W4–W11: pending, retain design acceptance gates. Reports, general/attachment research and server commissioning are not complete.

## Verification and rulings

- TDD skill main instructions read. Its referenced writing-good-tests.md resource is unavailable through the skill provider; use real behavioral tests and observe expected failure before changes.
- Do not count a static source assertion as a database behavior test.
- Do not equate OpenClaw run identifiers or estimates with upstream provider billing receipts.
- Progress is tracked by proven gates rather than percentage.
- Supplementary TypeScript check exposed existing errors in report-job array inference, AcceptedAttempt narrowing, missing Cloudflare runtime declarations and OpenCode Zod-default inference. Polling-specific type error corrected; build/lint/tests remain the current publication gates. Do not describe full typecheck as passing.
- Isolated PostgreSQL test container and its newly pulled image were removed specifically after CI success. Oracle root89%,3.5GiB free; measured swap-in/out0 during2 current sampling intervals, so high swap occupancy alone is not proof of active memory thrashing.

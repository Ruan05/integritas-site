# DD Agent Context and Full-Run Launch

**Date:** 2026-10-16  
**Status:** Approved for implementation by the user’s request to correct the live DD agent end to end.

## Problem

The case chat can already answer ordinary questions with the Oracle/OpenClaw agent and its web-search and page-fetch tools. Its broker currently sends only a small subset of case records, one report, a small findings list, and the first characters of recent files. The chat UI also treats “full DD” as an upload-only action. As a result, typed requests and links can only get a chat reply, and follow-up answers do not consistently see the evidence graph and prior research that belongs to the same case.

Separately, the live full-DD runner accepts a successful model analysis with findings but an empty entity list. The subsequent entity gate then fails the entire run, even when the deterministic extractor can safely recover explicitly labelled parties from the submitted evidence.

## Product behavior

1. **Send message** answers a case question in the persistent case thread. The Oracle chat agent can search and fetch public pages when current verification is needed, cites URLs beside claims, and uses the case’s retained conversation, memory, evidence, findings, sources, reports, and run status.
2. **Run full DD** seals a new case revision. It accepts uploaded files, a typed brief, a URL, or a combination. For a new case or a case with no verified evidence, a typed-only brief becomes a text evidence item. For an existing case with verified evidence, a typed-only revision reuses that evidence and stores the updated question and conversation context in a sealed context revision; it never creates a synthetic document. The user’s prompt and the same case’s prior conversation are carried through the existing intake controls. Existing access, the 20-document limit, active-run confirmation, evidence provenance, and provider routing remain enforced.
3. Chat evidence remains case-scoped and untrusted. Prior user messages, model replies, document text, and memory are context, not instructions, policy, or independent evidence. New external claims require captured public-source links and must be distinguished from assertions and inference.
4. Context sent to the chat worker is bounded, ordered, and relevance-aware. It includes the case’s entity and relationship graph; findings linked to source records; public source URLs, excerpts, retrieval and verification metadata; recent reports with summaries and bounded excerpts; multiple runs and checkpoints; and document excerpts selected for the current question. Truncation is explicit. The worker remains read-only for source evidence and case controls.
5. When model analysis returns valid findings but no entities, the runner first uses the existing narrow deterministic extractor. If it yields evidence-backed labelled entities, merge those proposed identities while preserving all model findings and leaving unlinked findings unlinked. If no deterministic anchors exist, retain the existing fail-closed entity gate. Do not invent identity, change evidence status, or make a failed extraction look verified.

## Design details

### Chat and intake

- Keep the existing ordinary-message route and 6,000-character limit.
- Add a distinct full-DD action in the case chat. When no file is selected and the case has no verified evidence, build a `text/plain` brief from the current prompt and pass it through the current intake path.
- When no file is selected and the existing case has verified evidence, use a service-role-only, actor-authorized, case-scoped SQL wrapper around `integritas_private.accept_intake_context` with `p_batch = null`. Persist an idempotency key and payload fingerprint in the same transaction so a lost response replays the same sealed revision. A fresh key with materially updated question or context can create a new revision; the existing intake material dedupe still suppresses an identical request for the current revision.
- Keep the 3,000-character DD brief limit, the 6,000-character conversation-context limit, the 20-document limit, the current per-file limit, and active-run replacement confirmation. Question-only revisions reuse existing verified documents without consuming another document slot.
- For a new case, the same full-DD action creates a case from the brief and uses existing scope and route defaults.
- Do not route DD jobs to Ruan. The live production route remains Oracle/OpenClaw while Ruan is not production-ready.

### Broker context

- Maintain all current authentication, owner checks, case access, worker leases, reply receipts, memory validation, and read-only guarantees.
- Use only rows filtered by the accessed case ID. Never join context across cases.
- Keep database reads and serialized worker context bounded. Preserve source IDs/keys and case revision/job IDs so the model can qualify temporal context.
- Add source URL hygiene: permit only HTTP(S) public URLs, remove credentials and fragment, and redact sensitive query parameters before worker exposure.
- Correct the worker policy text so it reflects the active Oracle chat tools and deployment route.

### DD analysis admission

- Add an isolated repair helper and regression tests. For an empty-model-entity result, use only the existing deterministic entities produced from explicit labelled party fields and other currently trusted structured extraction.
- Require nonempty deterministic entity keys before merging. Preserve model-authored relationships, findings, contradictions, unresolved checks, and limitations. Keep findings unlinked unless their existing validated `entity_key` is already present in the merged entity set.
- If no deterministic entity is found, fail at the current hard gate. Do not spend an extra provider call or add a new bypass around report admission.

## Security and evidence constraints

- All work remains scoped to an authorized case. No cross-case context, access changes, route changes, or evidence-gate changes. One private idempotency table and one service-role-only revision RPC are permitted to make question-only revisions replay-safe.
- Do not send credentials in prompts or source URLs. Treat uploaded files and prior chat as untrusted context.
- Every public research claim still requires a direct captured URL and clear source attribution. A saved source is not automatically a verified claim.
- Preserve existing provider receipts and avoid retried billed requests.
- Preserve Oracle as the production DD provider until Ruan’s admission and restore checks pass.

## Acceptance criteria

- A typed brief or URL can start and seal a full-DD revision without a separate upload; on a case with verified evidence, the revision reuses that evidence and does not add another document.
- A question-only revision on an existing case is actor-authorized, case-scoped, replay-safe, and uses only verified evidence already attached to that case.
- The active-case UI offers ordinary chat and a clearly separate full-DD action.
- The chat context includes bounded case history, prior reports, sources, findings, graph data, run/checkpoint status, and question-relevant document excerpts, with case IDs and provenance retained.
- Prior web research is available to a follow-up answer with its source URL and excerpt.
- The worker is accurately instructed about live web tools and Oracle routing.
- A valid model analysis with no entities can continue only when deterministic extraction yields explicit evidence-backed entities; otherwise the existing gate still stops it.
- Existing authentication, case access, intake controls, cost receipts, report gates, source checks, and provider routing stay intact.
- Site build/test suite and runner-side regression/CI checks pass before production publication and runner release.

## Out of scope

- Cross-case personal memory or automatically merging separate investigations.
- Persistent browser cookies or external account access.
- Enabling the Ruan DD route, relaxing spend limits, broad schema changes, or changing case permissions.
- Treating conversational context, scraped pages, or model output as independently verified evidence.

# Private dashboard UX contract

Visual intent and token ownership: [DESIGN.md](DESIGN.md).

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Authentication/session | Existing password gate and CRM proxy | lib/crm-auth.ts | No auth bypass | Existing source and route regressions; live acceptance pending |
| Dialog | Radix shared Dialog | components/ui/dialog.tsx | Folder, record, confirmation | Fixture browser focus/open/close PASS; full live keyboard audit pending |
| Select/Listbox | Radix shared authored Select, imported as AuthoredSelect | components/ui/select.tsx | Case and directory filters | Fixture case/style popup selection PASS |
| Tabs | Radix shared Tabs | components/ui/tabs.tsx | Directory tabs | Browser keyboard proof pending |
| Table | Semantic table with explicit pagination | PremiumDashboard.tsx | Evidence and register | Model tests pass; browser proof pending |
| Form | Application-owned validation and sealed intake | CaseAgentChat and intake client | No paid fallback or fake upload | Existing intake tests and new transaction fixture |
| Scrollbar | Global document baseline | app/globals.css | Standards plus engine fallback | Static audit and browser proof |
| Toast / feedback | Persistent inline status and error | Dashboard request owners | Explicit Retry; no premature success | Failure-state browser proof pending |
| CRUD | Service-authorized versioned writes | Dashboard Edge and SQL boundaries | Conflict rejects overwrite | Disposable SQL authorization/rollback/concurrency PASS |
| Date | Read-only locale formatter | Dashboard date formatter | en-ZA and SAST | Source inspection |
| Reports | Existing release validator | Existing report API and worker | External/internal authorized editions | Live new-client pair acceptance pending |

## Navigation and state

`view` and case UUID can be restored in the URL; search text and private filter inputs remain in memory so private terms do not enter browser history or shared URLs. Back and refresh retain the chosen surface. Route titles name the surface, not private case subjects. Entry at `/crm` opens the command center after the existing password gate. Public Go to Dashboard points there.

Create/select a client from the DD composer. Busy state prevents duplicate activation; the server's idempotency key is the durable creation boundary. Intake reserves, finalizes and seals bytes before the existing dispatcher owns execution. A browser closure does not cancel a job. On success the client register receives the persisted case; worker and report progress remain available in that folder.

## Mutations and recovery

Gate acceptance, notes and issue resolution wait for server confirmation. Writes include case revision and expected record version. A conflict explains that the record changed and requires a reload; it cannot silently overwrite a newer revision. Gate acceptance records the reviewer and supporting case evidence. Reopening removes current acceptance while immutable audit history remains. A new evidence revision requires renewed acceptance.

Request documents creates an internal request only. Email remains disabled by the owner. No source, UI or tool request may widen model, spend, privacy, access or admission policies.

Failures preserve input and usable prior data. A failed register fetch must not imply an empty database. Unauthorized sessions follow existing re-authentication; the UI never interprets a hidden button as authorization. Uncertain outcomes are reconciled through idempotency/status before a new mutation.

## Accessibility and responsive behaviour

WCAG 2.2 AA is the target. Native buttons/links, named controls, visible focus, standard Radix keyboard semantics, picker alternatives to drag/drop, focus containment/dismissal, error text and explicit progress states are required. Reduced motion and the no-WebGL location register remain usable. Forms scroll naturally; tables own their overflow. Icon actions keep accessible names. Mobile navigation must retain logout and all primary actions.

## Verification ownership

Static audit, type/build checks, meaningful model/database/API regressions and real browser workflows are separate proof. The completion gate includes actual live new-client folder creation, persisted dashboard population, durable DD execution and both authorized validated downloads. Physical device, reboot, Mac-independent and extended operational proofs remain separately named. A fixture does not satisfy live acceptance.

# Case conversations and contextual memory

The CRM proxy authenticates the existing password session and forwards only
`chat_history` and `chat_send` to `integritas-case-chat`. Browser clients never
receive worker or service credentials. The broker verifies case ownership on
every operation. Tables and RPCs are private to service_role and use RLS.

The Ruan user service claims a durable turn with a 180-second fenced lease.
One turn per conversation runs at a time. Client keys deduplicate network retries;
provider requests have immutable IDs and a durable nanodollar ledger. Ambiguous
model requests are not automatically repeated. Completion atomically commits
the reply, proposed case memory and message status. Original messages survive
compaction and are paginated in the CRM.

Recall loads recent turns, reads up to 480 older archived messages, selects
relevant older matches, and injects the rolling case summary and proposed
lessons. This bounded recall plus source-linked consolidation runs each turn,
following the curated-memory pattern rather than training a model. More distant
history remains in the database and visible through pagination. It does not
import earlier ChatGPT conversations automatically.

The model must preserve uncertainty and cite real message IDs for lessons.
Lessons and summaries remain case-local contextual hypotheses, not evidence,
policy, permissions or verified company facts. No model-written skill executes;
no self-modifying code or cross-case factual promotion is enabled. New goals or
corrections can inform replies immediately. Changing the investigation requires
an explicit new document submission; chat does not alter an active run/report.

The separate reply service uses the existing approved model route and private
provider credential without changing DD commissioning or publication identities.
Its initial total budget is US$0.25, with no automatic reset or increase. Exhaustion
stops replies visibly. Systemd restarts the service on failure. Boot/logout
persistence additionally requires the hosting provider to enable user lingering.

Verification: real two-turn recall and service restart test, provider cost/generation
receipts, durable memory version, invalid-lease rejection, duplicate-send handling,
access grants/RLS and memory-source unit tests. Commissioning cases are synthetic
and archived after testing.

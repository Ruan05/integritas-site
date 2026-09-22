# CRM direct upload release

This source is the canonical `/crm` implementation for the Integritas public
ChatGPT Sites project. Uploads use an authenticated reserve/finalize flow,
private signed Storage uploads, and TUS resumable uploads above 6 MiB.

The browser never receives a service-role or backend credential. The backend
creates an immutable reservation path, verifies the stored object bytes and
SHA-256 during finalization, and leaves extraction pending for Oracle/OpenClaw.

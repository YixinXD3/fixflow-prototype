# Decision 0006 — course layout and synthetic service data

Date: 2026-11-10. User authorized fictional demonstration data and reorganization of YixinXD3/fixflow-prototype using the course repository structure. The course repository is read-only for this task.

Keep the existing Python/SQLite implementation, relocate all application code under apps/fixflow, retain the original static UI under public, place infrastructure under infra, and organize explanations/evidence under docs. Use git moves and preserve personal repository history. Import supplied guides and agent-skill sources unchanged with provenance. Do not copy research transcripts or pretend to have completed participant tests.

The eight synthetic scenarios are generated through domain operations, not direct state fabrication. They cover important workflow states while preserving blockers, audit history and assignment ownership. Initialization is repeat-safe, never resets existing repairs and uses random local credentials. The UI labels the dataset as fictional.

Alternatives considered: keep loose application files at the root (fails requested organization); replace the old UI wholesale (unnecessary risk to existing features); provision a cloud database/host immediately (account, storage and billing choices remain unresolved). This change proves the local full-stack flow and preserves the existing Pages demonstration without claiming a new public API deployment.

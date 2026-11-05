# Server-backed MVP scope

This increment makes the existing three-role repair workflow persistent and server-authorized. It carries forward the customer, manager, handover, help, parts and approval concepts in the existing repository. It does not create new interview findings or establish that the software reduces repair time or improves customer trust. Earlier research and coursework remain owned by the course repository.

| Existing need or workflow | Implemented increment | Acceptance evidence | Remaining uncertainty |
| --- | --- | --- | --- |
| Share a customer request across roles | Linked request/job SQL records; role-filtered API | API tests and actual three-role browser path | Real users and deployed multi-device use |
| Retain repair context after reassignment | Append-only handovers and assignment history | Reassignment/backup tests; browser handover save | Independent technician comprehension |
| Keep advice attached to repair | Private participant help conversation, accept/reply/resolve and optional nonblocking advice | Service tests for participants and acceptance rules | Full browser help journey and user usefulness |
| Follow up missing parts | Manager ownership, next action, ETA, manual procurement and revision snapshots | Parts/history/blocker tests | Manager usability and real operational adoption |
| Make extra cost decisions explicit | Versioned proposal, distinct customer choices and preserved responses | Revision, clarification, duplicate and zero-cost tests | Customer comprehension and actual consent process |
| Keep completion separate from approval | Guarded technician-ready and owning-customer confirmation | API and actual browser end-to-end checks | Real collection/repair verification workflow |
| Avoid losing records on browser close | SQLite database, sessions, protected photo storage and backup command | Read-back, separate service instance and backup/restore tests | Cloud persistence and off-site operations |
| Protect role information | Server identity, customer ownership and projection of public fields | Role/foreign-record/photo tests; customer browser observation | Independent security review; multi-shop isolation is out of scope |

Current exclusions: payments, external supplier orders, SMS/email delivery, live AI analytics, automatic importing of browser demo sessions, multi-shop tenancy, email-based account recovery and horizontally scaled deployment. Client updates require reload; this is shared persistent storage, not a real-time push system. Initial staff account distribution and off-site backup operation remain human responsibilities.

The static prototype remains available through its existing Pages hosting. New server-backed UI files are under `web/` and the backend serves them at its own root URL; the original UI files and module authorship remain preserved. Selected later handover validation and journey-cancellation fixes were brought from the latest course ZIP without overwriting the deployment repository's customer-specific improvements.

# FixFlow server API

The server derives the actor from an HttpOnly session cookie. A JSON role or user ID cannot impersonate another person. Money is stored as integer AUD cents and returned as decimal amounts. Times are UTC ISO strings; the website displays Australia/Brisbane time. Lists return arrays and missing optional values return null.

All write requests use `Content-Type: application/json` and the exact site `Origin`. Authenticated writes also send `X-CSRF-Token`, obtained from login or `/api/auth/me`. Cookies expire after 12 hours. Password changes invalidate all that user's sessions. Customer registration always creates a customer regardless of extra request fields; only managers can create staff.

## Account and discovery endpoints

| Method | Path | Access and body |
| --- | --- | --- |
| GET | `/api/health` | Public; checks database access; no records or credentials returned |
| POST | `/api/auth/register` | Public; `name`, `email`, `password` (12–128 characters); customer role only |
| POST | `/api/auth/login` | Public; `email`, `password`; returns user and CSRF token and sets cookie |
| GET | `/api/auth/me` | Signed in; returns user and CSRF token |
| POST | `/api/auth/logout` | Signed in; `{}`; invalidates this session |
| POST | `/api/auth/password` | Signed in; `currentPassword`, `newPassword`; invalidates all own sessions |
| GET | `/api/technicians` | Signed in; safe technician ID/name/role directory |
| GET | `/api/users` | Manager; account directory, never password hashes |
| POST | `/api/users` | Manager; `name`, `email`, `role`, `password` |

## Repair endpoints

Every existing-repair mutation requires `expectedVersion`, the integer version from the latest detail response. A successful mutation increments the job version and writes an audit event in the same database transaction. A stale version returns 409 without partial writes. Clients must reload, review preserved input against the changed record, and resubmit deliberately. A failed/ambiguous network response is not confirmation of saving: reload the record before retrying.

| Method | Path | Access and body besides expectedVersion |
| --- | --- | --- |
| GET | `/api/repairs` | Manager: all; customer: own; technician: currently assigned |
| POST | `/api/repairs` | Customer; `device`, `type`, `category`, `description`, optional `note`, `preferredTechnicianId` |
| GET | `/api/repairs/{id}` | Same visibility; customer response omits internal handovers, help, parts, assignment history and logs |
| GET | `/api/repairs/{id}/blockers` | Authorized staff; all independent blocking reasons |
| POST | `/api/repairs/{id}/assignment` | Manager; `technicianId`; retains assignment history |
| POST | `/api/repairs/{id}/start` | Assigned technician; only To Do, with no blockers |
| POST | `/api/repairs/{id}/resume` | Assigned technician; only Waiting, with no blockers |
| POST | `/api/repairs/{id}/ready-for-confirmation` | Assigned technician; only In Progress, with no blockers |
| POST | `/api/repairs/{id}/confirm-completion` | Owning customer; only Awaiting Customer Confirmation; confirmation is not payment |
| POST | `/api/repairs/{id}/handovers` | Assigned technician; `tests`, `finding`, `next` (each 1–1000 characters) |
| POST | `/api/repairs/{id}/public-updates` | Manager or assigned technician; `reason`, `nextAction`, `progress` (0–99), optional boolean `actionRequired` |
| POST | `/api/repairs/{id}/messages` | Owning customer or authorized staff; `body` (1–2000 characters) |
| POST | `/api/repairs/{id}/attachments` | Owning customer or authorized staff; `filename`, base64 `content`, staff `visibility` (`public`/`internal`); customers always public; up to ten images per repair, 5 MB each |
| GET | `/api/attachments/{id}` | Same repair permission; customers cannot retrieve internal images even by guessing the ID |

Attachments are stored in the database so a consistent database backup includes photos. Supported signatures: PNG, JPEG and WebP; content is never executed as HTML/SVG. This signature/size check is not a malware scanner or full image decoder. Only the web client and assets are public; source, tests, backups and database files are not served.

## Help, parts and proposals

All mutations below also require the parent job's `expectedVersion`. Private help discussion is available only to requester and recipient; the manager gets status information in repair details. Accepting help does not transfer repair ownership.

| Method | Path | Access and body |
| --- | --- | --- |
| GET | `/api/help-requests` | Technician; sent and received requests with parent job versions |
| POST | `/api/repairs/{id}/help-requests` | Assigned technician; `helperId`, `problem` (1–500), boolean `blocking` (default true); no self-help; max four unresolved requests per recipient |
| GET | `/api/help-requests/{id}` | Participant; includes conversation and parent version |
| POST | `/api/help-requests/{id}/accept` | Recipient; only Open |
| POST | `/api/help-requests/{id}/comments` | Participant; `body` (1–1000); recipient must first accept |
| POST | `/api/help-requests/{id}/resolve` | Requester; Open or Accepted; leaves repair Waiting |
| POST | `/api/help-requests/{id}/appreciation` | Requester; once; does not rewrite discussion |
| POST | `/api/repairs/{id}/parts-requests` | Assigned technician; `description`, integer `quantity` (1–1000), boolean `blocking` (default true) |
| PATCH | `/api/parts-requests/{id}` | Manager; `status`, `nextAction`, optional `ownerId`, `expectedArrival` (YYYY-MM-DD), `procurement` |
| POST | `/api/repairs/{id}/approval-requests` | Manager; `reason`, `description`, `additionalCost`, optional `revisedTotal`, `alternative`; revision creates a new ID |
| POST | `/api/approval-requests/{id}/response` | Owning customer; `decision` approved/declined/clarification; clarification requires `note`; once per current pending proposal |
| POST | `/api/approval-requests/{id}/withdraw` | Manager; `reason`; preserves original customer response |

Procurement supports `stockCheck` (unchecked/available/unavailable), `stockNote`, `supplierName`, `email`, HTTPS `website`, `subject`, `body`, `orderReference`. Ordered requires an external reference. Saving does not contact the supplier or order parts. Each change retains the previous snapshot. Receipt does not resume or complete a repair.

Proposal states: pending, approved, declined, clarification, withdrawn, superseded. Previous response rows are retained when a proposal is superseded or withdrawn. An approved proposal must be explicitly withdrawn with a reason before replacement. Pending, declined and clarification remain blockers. Approval does not resume or complete the job.

## Errors and limits

Errors return `{"error":"human-readable explanation"}`. Typical codes: 400 invalid input, 401 expired/missing session, 403 role/CSRF/origin violation, 404 unavailable record, 409 stale version or state conflict, 413 body too large, 415 wrong content type, 429 account attempt limit, 503 database unavailable. Unknown IDs and records belonging to another customer both return 404. Account endpoints allow up to 30 attempts per source address per 15 minutes; behind a reverse proxy this conservatively groups requests by proxy address unless an operator adds trusted proxy configuration. No public account recovery, email verification, multi-store tenancy or automated notification delivery is implemented.

# Backend verification record

Date: 5 November 2026, Australia/Brisbane. Base: `YixinXD3/fixflow-prototype`, commit `931e5e7`. Developer verification used fictional data and local databases. No participant testing, real repair outcome, peer signature or cloud deployment is claimed.

## Executed results

| Check | Actual result | Scope |
| --- | --- | --- |
| `python -m unittest discover -s backend/tests -v` | 15 tests passed, zero failed | Relational transaction rules, actual HTTP server, production WSGI adapter, roles, sessions, CSRF/origin, stale versions, concurrent writes, independent blockers, revisions, repeat creation, backup/restore including attachments |
| `node --check web/app.js` and Python compilation | Passed | Syntax of the new client and backend modules |
| Original pure JavaScript rule suites | 74 checks passed | Existing prototype contracts plus latest course handover/history/navigation fixes; not tests of the new browser UI |
| Actual production Waitress service, local port 8014 | Passed | Login, Secure cookie flag, authenticated database read, logout via real HTTP requests; local HTTP transport is not cloud HTTPS validation |
| Browser customer request | Passed | Signed in as Alex, submitted fictional Browser validation phone, received persisted job `FF-EADB8DDC0522` |
| Browser manager assignment | Passed | Signed out, signed in as manager, opened the same server repair and assigned Jordan |
| Browser technician handover and ready action | Passed | Signed in as Jordan, started repair, saved three handover fields, marked Awaiting Customer Confirmation |
| Browser final confirmation and refresh | Passed | Signed in as Alex, confirmed Completed, reloaded and read back version 6 and confirmation; no internal handover appeared in the customer page |
| Browser logs during exercised path | No error/warning entries at inspection point | Bounded observation, not proof of every UI path |

The new service tests use separate customer/staff identities and independent database connections. Concurrency test submits two updates with the same version and requires one success and one 409, with only one assignment history row. Backup test restores a separate database and checks retained handover, assigned technician and attachment bytes. The application read-back test reinstantiates the service against the saved database and verifies completion/messages remain.

Local testing initially encountered restricted temporary-directory/socket access; rerunning with an authorized local workspace temporary directory and network access passed. Isolated Edge launch for automated Playwright failed in this environment, so the actual browser walkthrough used Codex's in-app browser. The complete historical Playwright suite was not run successfully. These environment errors are not converted into test passes.

Docker CLI is installed, but the Docker Desktop Linux engine was unavailable. The Docker image was not built locally. The production Python/Waitress entrypoint itself was exercised after installing the pinned dependency into a workspace-local directory, without changing the system Python installation.

## Pending acceptance

- All new forms in actual browsers: full help conversation, parts/procurement, proposal revisions, uploads, account creation/password changes, and stale-version draft review. Domain/API coverage exists, but is not equivalent to browser coverage.
- Narrow mobile viewport and keyboard-only walkthrough of the new server-backed workspace.
- Cross-device cloud use, TLS, persistent-volume permissions, service redeployment/restart, off-site backup scheduling and restore rehearsal on the selected host.
- Docker image build and deployment platform validation.
- Human code review and student understanding of implementation/contribution boundaries.

The user deferred platform selection and requested no work on participant testing, Teams recordings, personal reflection or Git-history packaging in this increment. The final poster was not changed. Local demonstration databases, generated passwords and dependencies are not included in the source package or Git upload.

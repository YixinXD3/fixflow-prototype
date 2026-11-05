# FixFlow persistent repair workspace

FixFlow now includes a relational database, authenticated API and server-backed customer, manager and technician workspace. The original static classroom prototype is retained at the repository root; the Python server and Docker image serve the new `web/` client. The current GitHub Pages URL remains the earlier static demo until a backend host is selected.

## Run the complete application locally

Use Python 3.12 or newer, from this directory:

```sh
python -m backend.server --demo
```

Open http://127.0.0.1:8000. On the first startup, save the generated local password printed in the terminal. Manager: `manager@example.test`; fictional staff: `jordan@example.test`, `taylor@example.test`, `marcus@example.test`; fictional customers: `alex@example.test`, `sam@example.test`. All local demo accounts initially share the generated password. Existing data and passwords are not reset on later starts. Without `--demo`, only the manager is created. Customers can register; the manager creates staff in Team accounts. Do not reuse local demo credentials online.

The database is `.data/fixflow.sqlite3` by default. Set `FIXFLOW_DB` to another path if needed. Existing browser-session prototype data is not imported. There is no real payment, automatic supplier ordering, SMS or AI report service.

## Verification

```sh
python -m unittest discover -s backend/tests -v
node --check web/app.js
```

Backend tests use isolated temporary databases. They exercise actual SQL transactions, role access, proposal history, independent blockers, optimistic concurrency, sessions/CSRF/origin, HTTP routes and backup/restore. The original prototype rule tests remain under `tests/`; its historical browser tests require Playwright and a compatible isolated browser.

## Read next

- [Local setup, production deployment and backups](docs/backend-deployment.md)
- [API contract](docs/backend-api.md)
- [Implemented relational data and role rules](docs/backend-data.md)
- [Actual verification and remaining acceptance work](docs/backend-verification.md)
- [MVP implementation scope and evidence boundary](docs/backend-scope.md)
- [Earlier static prototype documentation](docs/static-prototype-readme.md)

Deployment is prepared but not provisioned. The user requested code delivery and upload first, with the hosting platform decided later. The optional Render blueprint uses paid resources and must be reviewed before provisioning. A persistent writable volume is required; GitHub Pages cannot execute this backend.

AI assistance: Codex implemented this backend increment and developer verification. It does not establish participant findings, team review signatures, measured business outcomes or independent code contributions by each student. Students must review and understand the implementation and keep coursework contribution claims accurate.

# FixFlow application

## Layout

- `backend/`: SQL schema, business rules, HTTP service, synthetic fixture builder, backup command and backend tests.
- `web/`: authenticated customer, manager and technician client calling the service's `/api` endpoints.
- `public/`: retained standalone static prototype and its assets. Backend assets are served from `public/assets/`.
- `tests/`: retained prototype checks; browser checks require their optional existing Playwright setup.
- `run.py`: launch from any directory; `requirements.txt`: pinned production server dependency.

## Local service

Python 3.12+. From the repository root run `python3 apps/fixflow/run.py --demo`, or from this directory run `python3 -m backend.server --demo`. Open http://127.0.0.1:8000. `--port 8020` selects another local port. SQLite is `.data/fixflow.sqlite3` relative to this application by default. `FIXFLOW_DB` can point to a dedicated fresh database.

A fresh `--demo` run creates six fictional users and eight synthetic repairs. Save the random password printed once. Demo emails: manager, jordan, taylor, marcus, alex and sam at `example.test`. If the database already exists, startup preserves it and does not recreate the scenario set. Without `--demo`, first startup creates only the manager. Production refuses `--demo`.

Do not place credentials or runtime databases in Git or submission ZIPs. [Scenario walkthrough](../../docs/design/synthetic-service-flow.md) explains which account owns each scenario. Fixture timestamps reflect generation time, not invented historical research dates.

## Checks

From `apps/fixflow/`:

```sh
python3 -m unittest discover -s backend/tests -v
node --check web/app.js
node --test tests/customer-actions.test.cjs tests/manager-integration.test.cjs tests/manager-followup.test.cjs tests/manager-supplier.test.cjs tests/tianshu-workflow.test.cjs tests/handover.test.cjs tests/journey.test.cjs tests/yixin-cross-role.test.cjs
python3 check_submission.py
```

These do not install or launch the historical browser suite. They check backend/API behavior and the retained prototype's pure rules. Browser coverage and limitations are recorded in [verification](../../docs/discovery/experiments/iteration-3/submission-verification.md).

## Static prototype

From the repository root: `python3 -m http.server 5173 --bind 127.0.0.1 --directory apps/fixflow/public`. Open http://127.0.0.1:5173/#login. This remains a separate, browser-session demo; it is not a logged-in database client.

## Production and backup

Install `requirements.txt` in an isolated environment for production Waitress. See [deployment](../../infra/deployment/README.md). From this directory `python3 -m backend.backup /absolute/private/backup.sqlite3` uses FIXFLOW_DB (or the application's default database). Store backups outside Git and away from the database disk.

## Package

After committing all changes, from the repository root:

```sh
python3 apps/fixflow/package_submission.py --output /absolute/path/FixFlow-code-with-history.zip
```

The command makes a clean clone of the current branch, includes `.git` history, excludes untracked databases/passwords/dependencies and refuses an existing destination. This is a code/history package; follow the [submission map](../../docs/team/submission-map.md) for team evidence and final release checks.

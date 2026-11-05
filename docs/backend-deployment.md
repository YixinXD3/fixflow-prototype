# Deploy the complete FixFlow application

Deployment is prepared, not provisioned. The user chose to upload the implementation first and decide the hosting platform later. No hosting account, subscription, public backend URL or paid resource was created by this work. GitHub Pages continues to serve only the existing static root prototype; uploading this branch does not run Python or create the production database.

## Local use

Use Python 3.12 or newer. From the repository root:

```sh
python -m backend.server --demo
```

Open `http://127.0.0.1:8000`. The first startup of an empty database prints a randomly generated local initial password. The manager address defaults to `manager@example.test`. `--demo` also creates `jordan@example.test`, `taylor@example.test`, `marcus@example.test`, `alex@example.test` and `sam@example.test`, sharing that initial password for local fictional testing. Without `--demo`, only the manager is created. Subsequent starts preserve accounts and do not reset passwords. Customers can register; managers can create staff through Team accounts. The first local password must be saved privately by the operator; it is not stored in plaintext or recoverable from the database. The database defaults to `.data/fixflow.sqlite3`, excluded from Git and Docker builds.

`FIXFLOW_DB` can select a different absolute database path. `--port 8001` selects a different local port. Do not bind this development server to the public internet. No real participant, customer or payment information is needed for testing.

## Production configuration

The Docker image contains the production website, API and assets. It uses Waitress as its production HTTP server. A TLS-terminating platform provides HTTPS. The app uses a single persistent SQLite database for all 16 business tables, sessions and photos. It needs one service instance and a writable persistent local volume; never use an ephemeral container filesystem for the database.

| Environment variable | Value |
| --- | --- |
| `FIXFLOW_ENV` | `production` |
| `FIXFLOW_PUBLIC_ORIGIN` | Exact externally visible HTTPS origin, e.g. `https://your-service.onrender.com`, without a path or trailing slash |
| `FIXFLOW_DB` | Absolute path on a mounted persistent volume, e.g. `/app/storage/fixflow.sqlite3` |
| `FIXFLOW_ADMIN_EMAIL` | Real operator-selected manager login; required operationally for first provisioning |
| `FIXFLOW_ADMIN_PASSWORD` | Unique random secret of at least 12 characters; required on an empty production database |
| `PORT` | Platform-provided service port; default 8000 |

Put secrets in the platform's secret/environment settings, never in a commit, Docker build argument, screenshot, README or populated `.env` file. The production bootstrap does not print credentials, and `--demo` is refused in production. Changing bootstrap environment variables does not change existing accounts. Remove the bootstrap password from platform settings after verifying the initial account and backup; a database loss should be restored, not silently replaced by a fresh account. The manager can change their own password in Account. Protect deployment access, limit registration to the classroom context, and monitor storage and failed operations. This delivery does not include public password recovery or email verification.

## Prepared Render option

`render.yaml` is an optional Blueprint for a Docker web service with a 1 GB disk mounted at `/app/storage`. It selects a paid Starter service. Do not approve provisioning without reviewing the live price and billing terms. During this work, the official pricing page listed US$7/month for the service and US$0.25/GB/month for disk, before tax and excess usage. Free Render web services do not support persistent disks. Other Docker-capable hosts with persistent volumes can run the same image.

1. Connect only the intended `YixinXD3/fixflow-prototype` repository and implementation branch to the chosen host; review any requested account permissions.
2. Select the Dockerfile and single instance; attach a persistent volume. Confirm the runtime user can write to the mount.
3. Select the service name, obtain its HTTPS origin, and set the environment values above before allowing application traffic. If the first deployment occurs before the final origin is known, add the exact origin and redeploy before testing authenticated writes.
4. Check `/api/health` reports `database: connected`; then sign in as manager and create staff accounts. Do not use local demo passwords online.
5. Run the acceptance checks below, restart/redeploy the service, and repeat the read-back checks.
6. Keep the static Pages URL labelled as the earlier demo or deliberately update its link after the real application URL is known. Do not describe Pages as the backend host.

Sources checked 5 November 2026: [Render web services](https://render.com/docs/web-services), [persistent disks](https://render.com/docs/disks), [free-service limits](https://render.com/docs/free), [pricing](https://render.com/pricing), [Waitress](https://docs.pylonsproject.org/projects/waitress/en/stable/).

## Acceptance and backups

Use independent browser profiles or private windows to sign in as customer, manager and technician. Create a fictional repair, assign it, save handover/help/parts/proposal records, and verify each role sees the right information. Confirm a resolved help request does not clear a shortage; receiving a part does not resume work; approved work does not complete it; the customer alone confirms final completion. Submit an old version to verify a conflict rather than overwriting a newer record. Try another customer's repair ID and an internal photo URL from a customer session and confirm access is refused. Check a narrow mobile viewport and keyboard navigation. Only then call online acceptance complete.

To make a consistent live backup, run on the service or an authorized maintenance environment:

```sh
python -m backend.backup /path/outside-the-database-directory/fixflow-backup-YYYY-MM-DD.sqlite3
```

The SQLite backup API includes committed WAL changes. The command checks integrity and refuses to overwrite an existing destination. A backup on the same service disk is not disaster protection: export it to approved separate storage and keep it private because it includes account hashes, sessions, conversations and photos. Backups are not Git artifacts. For restore, stop the service, preserve the current files, restore the verified backup to the configured database path with correct permissions, start the service, and rerun acceptance checks. Avoid mixing old WAL/SHM sidecars with a restored database; perform restore under operator supervision.

Limitations: one shop and one service instance; no live push updates (reload fetches others' latest changes), no automatic session or data import from the old prototype, no email/SMS, payments, AI analytics, supplier ordering, automated off-site backups, or claim of real-user validation. The deployment-ready code is not evidence of a completed cloud deployment.

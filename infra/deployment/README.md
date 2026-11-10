# FixFlow deployment and backups

## What is deployed

The public Pages address remains https://yixinxd3.github.io/fixflow-prototype/#login, serving the earlier static prototype. The Python API is not hosted by Pages. This reorganization does not create a paid service or a new public backend URL.

The personal branch adds `.github/workflows/fixflow-pages.yml`, following the course workflow, to publish `apps/fixflow/public/` as the site root. Before merging the reorganization into personal main, change that repository's Settings → Pages → Source to **GitHub Actions**, then let this workflow deploy. Do not keep legacy main-root publishing after removing the root index.html. Until the branch is merged, the existing main and live site remain intact. Do not change the course repository's Pages settings.

## Local full stack

From the repository root: `python3 apps/fixflow/run.py --demo`. From `apps/fixflow/`: `python3 -m backend.server --demo`. The local URL is http://127.0.0.1:8000. Fresh initialization creates fictional accounts and scenarios and prints a random initial password. Existing databases are retained, not reset. The default database is `apps/fixflow/.data/fixflow.sqlite3`; FIXFLOW_DB may specify a new dedicated path. Do not commit generated accounts, passwords, live databases or backups.

## Production image

Build from repository root:

```sh
docker build -f infra/containers/fixflow.Dockerfile -t fixflow .
```

Use one application instance and a persistent writable local volume. The image includes backend/, web/ and public/assets/, not the raw source repository or any developer database. Waitress serves the website and API on one origin. A hosting platform provides HTTPS. The service runs as UID 10001; verify the mounted volume is writable by that user before first deployment.

| Environment | Meaning |
| --- | --- |
| FIXFLOW_ENV | production |
| FIXFLOW_PUBLIC_ORIGIN | Exact HTTPS origin, e.g. https://your-service.example, without path or trailing slash |
| FIXFLOW_DB | Persistent path, e.g. /app/storage/fixflow.sqlite3 |
| FIXFLOW_ADMIN_EMAIL | Operator-selected initial manager email |
| FIXFLOW_ADMIN_PASSWORD | Unique secret of at least 12 characters on first empty-database provisioning |
| PORT | Platform port, default 8000 |

Store secrets in platform settings, never files in Git. Production refuses --demo. The scenario builder is for local classroom use; any public demonstration dataset must be provisioned deliberately under the chosen host's access controls. Environment bootstrap values do not reset existing accounts. Do not reuse local demo credentials online.

## Optional Render configuration

[render.yaml](render.yaml) is a prepared configuration, not evidence of deployment. It references the repository-root Docker context and `infra/containers/fixflow.Dockerfile`, one service and a persistent disk. It selects paid resources. Review the platform's current terms and cost before creating resources; this task has not approved or provisioned a subscription. Configure the Blueprint path explicitly because it no longer lives at repository root.

## Verify a deployment

Check /api/health returns a connected database. Sign in from separate browsers as customer, manager and technician. Run [the synthetic flow](../../docs/design/synthetic-service-flow.md), check private help and images, and confirm stale writes return conflicts. Restart and redeploy; verify the same records remain. Confirm HTTPS cookies, origin settings and actual mounted-volume permissions. Mobile/keyboard and off-site backup acceptance must be recorded for the chosen environment.

## Backup and restore

From apps/fixflow, with FIXFLOW_DB pointing to the intended database:

```sh
python3 -m backend.backup /absolute/private/backup.sqlite3
```

The command uses SQLite's consistent backup API, checks integrity and refuses to overwrite a destination. Keep backups private and outside both Git and the service disk. For restore, stop the service, retain the previous files, restore the verified backup without mixing old WAL/SHM sidecars, verify permissions, start and repeat the acceptance checks. No automatic off-site schedule is configured by this work.

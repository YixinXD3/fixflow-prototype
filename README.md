# FixFlow — repair coordination classroom project

FixFlow connects a customer's repair request, manager assignment, technician handover and collaboration, and final customer confirmation. The complete application has a Python API, a relational SQLite database and authenticated workspaces. All supplied demonstration records are fictional.

## Run the complete service

Python 3.12+ is required. From the repository root:

```sh
python3 apps/fixflow/run.py --demo
```

Open http://127.0.0.1:8000. A fresh database creates six fictional accounts and eight linked repair scenarios. The terminal prints a randomly generated initial password once. Manager: `manager@example.test`; technicians: `jordan@example.test`, `taylor@example.test`, `marcus@example.test`; customers: `alex@example.test`, `sam@example.test`. There is no fixed password in this repository. Existing databases and passwords are retained; a restart does not reset repairs. For a new scenario set, use a new `FIXFLOW_DB` path rather than deleting an existing database.

## Repository map

| Directory | Contents |
| --- | --- |
| [apps/](apps/README.md) | Complete FixFlow app, retained static prototype and tests |
| [docs/](docs/README.md) | Architecture, API/data contracts, synthetic-data walkthrough, verification and submission mapping |
| [guides/](guides/README.md) | Unmodified teaching guidance copied from the course repository |
| [infra/](infra/README.md) | Container, optional backend deployment configuration and operational instructions |
| [.agents/skills/](.agents/skills/README.md) | Supplied course skill source; not a claim of a newly authored student skill |

## Which website is which?

- **Complete application:** served locally by the command above; web UI → real HTTP API → SQLite. API health is `/api/health`.
- **Static demonstration:** [existing GitHub Pages](https://yixinxd3.github.io/fixflow-prototype/#login). Its code is now under `apps/fixflow/public/`. It uses same-tab sessionStorage and has no Python API.
- A paid backend host has not been provisioned by this change. [Deployment instructions](infra/deployment/README.md) explain the distinction. The Pages workflow publishes only the retained prototype, never the database or backend source.

## Read and verify

- [Application setup and checks](apps/fixflow/README.md)
- [Synthetic scenario guide](docs/design/synthetic-service-flow.md)
- [API](docs/engineering/backend-api.md) and [implemented data/ERD](docs/engineering/backend-data.md)
- [Current developer verification](docs/discovery/experiments/iteration-3/submission-verification.md)
- [Submission mapping, provenance and remaining coursework checks](docs/team/submission-map.md)

Synthetic records are permitted demonstration fixtures, not interviews, participant statements, consent or measured outcomes. There are no real payments, automatically sent supplier orders or messages, or real AI analytics. AI assistance and existing member ownership are recorded in the submission mapping.

# Infrastructure

- [Deployment and backups](deployment/README.md)
- [Production Dockerfile](containers/fixflow.Dockerfile)
- [Optional Render blueprint](deployment/render.yaml)

Build from the repository root. Application code belongs in apps/fixflow; no secret or runtime database belongs here. GitHub Pages deployment remains configured in `.github/workflows/fixflow-pages.yml`, following the course workflow.

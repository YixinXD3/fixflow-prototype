# Repository-local skills

This is the canonical library of reusable project workflows. Each child directory is one skill and must be named exactly after the skill declared in its `SKILL.md`.

Skills are inspectable procedures, not a requirement to use AI. A team may use a hosted agent, a compatible agent with a local model, or follow `SKILL.md` manually. All pathways must produce the same output and complete the same privacy, evidence and human-review checks.

## Available skills

- [`create-interview-record`](create-interview-record/SKILL.md) — turn supplied, safely de-identified customer-discovery material into a consistent project evidence record. Its [record template](create-interview-record/assets/interview-record-template.md) can also be completed manually.

## Quick start

1. Open and inspect the skill's `SKILL.md` before using it.
2. Choose the hosted AI, local AI or no-AI pathway described in the [skill development guide](../../guides/developing-agent-skills.md).
3. Supply only the minimum safely de-identified material allowed by the skill.
4. Review the result against the source and complete the skill's final checks.
5. Commit the reviewed project artifact, not sensitive source material.

Codex, GitHub Copilot and Gemini CLI can discover the canonical `.agents/skills/` location. Claude Code uses the thin adapter under `.claude/skills/`, which forwards to this canonical package. Do not maintain a separate copy of the workflow in a provider-specific directory.

Develop and test each skill in its canonical directory, using Git branches and history for safe experimentation and rollback. Use only fictional or safely anonymised examples.

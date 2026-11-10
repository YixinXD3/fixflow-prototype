# Developing agent skills

An agent skill is a small, reusable and inspectable package for a specific task. A skill can guide a hosted agent, a compatible agent using a local model, or a person following `SKILL.md` manually. The pathway may change, but the expected output, review standard and team responsibility do not.

## Choose a pathway

Using AI is optional. Choose the pathway that fits the team's access, privacy requirements and confidence.

| Pathway | How to use the skill | What to check |
| --- | --- | --- |
| Hosted AI | Use a hosted coding agent or model and ask it to follow the skill. | Do not submit identifiable or restricted data. Review the provider's data settings and inspect every output. |
| Local AI | Use a compatible agent connected to a model running on the team's device. | Confirm which tools, authentication, telemetry and network connections are still active. A local model does not by itself make the whole workflow local. |
| No AI | Open `SKILL.md` and follow its procedure as a human-readable checklist. Use the same templates and review steps. | Complete the same evidence, privacy and quality checks as the AI-assisted pathways. |

## Understand the layers

Do not treat the skill, agent and model as the same thing:

- the **skill** is the versioned workflow in this repository;
- the **agent interface** discovers the skill, reads project files and may use tools;
- the **model runtime** may be hosted by a provider or run locally.

Changing models does not automatically change the agent's file access, web access, authentication or telemetry. Check the whole workflow before using sensitive material.

## Repository structure

The portable source of truth for each project skill lives under `.agents/skills/`:

```text
.agents/skills/create-interview-record/
├── SKILL.md                     # required workflow and trigger description
├── agents/
│   └── openai.yaml              # optional provider-specific metadata
├── assets/                      # reusable templates and output resources
├── examples/                    # fictional or safely anonymised examples
├── references/                  # optional detailed guidance
└── scripts/                     # optional deterministic automation
```

Only create folders that the skill genuinely needs. Keep the workflow in the canonical `.agents/skills/<skill-name>/` package. A provider-specific adapter may point to that package, but must not contain a second independent copy of the workflow.

## Agent compatibility

Current agent interfaces discover repository skills in different ways:

| Agent interface | Repository location | Discover or invoke |
| --- | --- | --- |
| Codex | `.agents/skills/<name>/SKILL.md` | Run `/skills` or mention `$name`; Codex may also select a matching skill. |
| GitHub Copilot | `.agents/skills/<name>/SKILL.md` | List or invoke skills in the active Copilot interface; matching skills may be selected automatically. |
| Gemini CLI | `.agents/skills/<name>/SKILL.md` | Run `/skills list`; request the skill by name or allow Gemini to activate it. |
| Claude Code | `.claude/skills/<name>/SKILL.md` | Run `/name` or allow Claude to select it. This starter uses a small adapter that points to the canonical `.agents` package. |

Interfaces and commands change over time. If discovery fails, open the canonical `SKILL.md` and follow it manually rather than changing the required outcome.

## Development cycle

1. Collect concrete examples of requests that should and should not trigger the skill.
2. Define the expected output, boundaries and human review responsibility.
3. Identify reusable templates, references or deterministic scripts.
4. Create or update the canonical package under `.agents/skills/`.
5. Inspect the complete skill before running it.
6. Test it with fictional or safely anonymised cases on the working branch.
7. Compare the result with its source material and look for missing, unsupported or overgeneralised claims.
8. Refine the skill, rerun the test and record meaningful changes in Git.

## Design principles

- Give the skill one clear responsibility.
- Use a short, verb-led, lowercase hyphenated name.
- Keep `SKILL.md` focused on the instructions needed to complete and review the task.
- Put detailed reference material in `references/`.
- Put reusable output material in `assets/`.
- Use scripts only where deterministic repetition justifies them.
- Keep provider-specific metadata separate from the portable workflow.
- Never use real sensitive participant data as a demonstration or test fixture.
- Never treat generated text as verified evidence merely because it follows a template.

Develop the skill in place under `.agents/skills/<skill-name>/`. Use Git branches, commits, diffs and rollback for experimentation rather than creating a second copy elsewhere. Remove temporary test material before merging unless it remains useful for maintaining the skill.

The included `create-interview-record` skill turns supplied, safely de-identified notes into a consistent evidence record. Whether it is followed by an agent or by a person, the team must compare the result with the securely held source and decide what the evidence means.

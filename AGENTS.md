# Repository instructions for agents

## Purpose

This is a student-facing innovation project starter. Help students preserve a clear trail from research evidence, through product and design decisions, to working software. Prefer explanations and changes that help students understand the work rather than hiding important judgment behind automation.

## Before making changes

1. Read the root `README.md`.
2. Read the index for the area being changed.
3. Inspect existing project material before creating a new convention.
4. Make the smallest coherent change that satisfies the request.

Do not commit, publish, deploy, or contact external people unless the user explicitly asks.

## Preserve complete lines and content

Do not truncate lines or file content. Do not replace omitted text with ellipses, shortened excerpts, or partial output when the complete content is required. Do not hard-wrap prose merely to satisfy a line-length limit; keep each Markdown paragraph or list item on one line unless the format requires otherwise. If a tool truncates output, read the remaining content in subsequent calls before reasoning about or modifying it. Concise summaries are acceptable only when they are clearly presented as summaries rather than as the complete source.

## Repository boundaries

- Put supplied teaching material in `guides/`.
- Put student-created project evidence and documentation in `docs/`.
- Put runnable applications and prototypes in `apps/`.
- Put deployment and operational configuration in `infra/`.
- Put the canonical source for repository-local skills in `.agents/skills/`. Provider-specific discovery adapters may point to a canonical skill, but must not duplicate its workflow.

Do not create a new top-level folder when an existing area has clear ownership of the material. Update the relevant index when introducing a significant new subfolder or convention.

## Evidence and interview safety

- Never invent participant statements, observations, quotations, timestamps, consent, or research findings.
- Separate source evidence from interpretation and recommendations.
- Use participant codes rather than names in project records.
- Do not place contact details, consent forms, raw recordings, or identifiable transcripts in Git.
- Treat a missing consent statement as undocumented; never infer consent.
- Use fictional or safely anonymised material in examples and evaluations.
- Do not claim that an agent-generated summary replaces review of the source.

## Agent skills

Each canonical skill must live at `.agents/skills/<skill-name>/` and contain a valid `SKILL.md`. The procedure must also be understandable when followed manually. Use lowercase, hyphenated, verb-led names. Keep the skill concise and include only resources required to perform and review the task.

Place:

- reusable output templates in the skill's `assets/`;
- detailed domain guidance in the skill's `references/`;
- deterministic repeated operations in the skill's `scripts/`;
- teaching explanations and exercises in `guides/`;
- reusable synthetic examples or evaluations in the skill directory only when they are necessary to maintain the skill.

Develop and test a skill in its `.agents/skills/<skill-name>/` directory. Use Git branches and history for experimentation, rollback, and comparison rather than creating a parallel skill-development location. Validate a new or changed skill and test it with representative synthetic examples before treating it as ready for students. Remove temporary test artifacts before merging unless they provide continuing maintenance value.

## Applications and infrastructure

Give each independently runnable application its own directory under `apps/`. Document its setup, development, test, and build commands locally. Keep shared code inside an owning application until a genuine shared boundary emerges.

Use `infra/` only for configuration that operates or deploys the project. Never commit credentials, tokens, private keys, or populated environment files.

## Quality checks

Run the checks closest to the files changed. For code, use the owning application's documented lint, test, and build commands. For documentation, check links, examples, terminology, and the distinction between evidence and interpretation. Report checks that could not be run.

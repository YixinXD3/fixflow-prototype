# Getting started

## 1. Describe the project

Replace the opening section of the root `README.md` with a short description of your team's project. Record the problem area without presenting an untested solution as fact.

## 2. Start with discovery

Use `docs/discovery/` to record assumptions, interview records, experiments, and what the team learns. Evidence should be traceable without exposing participant identities or sensitive source material.

## 3. Develop the product direction

Use `docs/product/` for the problem framing, intended users, value proposition, scope, and requirements. Update these artifacts when evidence changes the team's understanding.

Suggested locations for common course artifacts are:

| Artifact | Suggested location |
| --- | --- |
| Business model canvas | `docs/product/business-model-canvas.md` |
| Value proposition canvas | `docs/product/value-proposition-canvas.md`, or one file per segment under `docs/product/value-propositions/` |
| Competitor business model canvases | `docs/product/competitors/` |
| Hypotheses, test cards, and learning cards | `docs/discovery/assumptions/` and `docs/discovery/experiments/` |
| De-identified interview records and synthesis | `docs/discovery/interviews/` and `docs/discovery/synthesis/` |
| Sketches and prototype documentation | `docs/design/` |
| Meeting notes and team working agreements | `docs/team/` |

Keep one current version of each canvas and use Git history to show its iterations. Link canvas hypotheses to the evidence and learning records that support or refute them.

## 4. Design and build

Use `docs/design/` for experience and solution design. Put runnable software in `apps/` and technical explanations in `docs/engineering/`.

## 5. Record important choices

Use `docs/decisions/` for choices that future team members will need to understand. Record the context, alternatives, decision, and consequences.

## 6. Keep the repository useful

Prefer a small number of current artifacts over many abandoned documents. Remove placeholder material when the team replaces it with project-specific work, and keep each area's index accurate.

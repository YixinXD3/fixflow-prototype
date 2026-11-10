# Working with agents

Using AI is optional. Teams may use a hosted agent, a compatible agent with a local model, or follow a repository skill manually. The required evidence, deliverable and review standard remain the same.

Agents can help organise evidence, critique questions, compare alternatives, write and review code, and keep documentation consistent. The team remains responsible for interviewing and listening, protecting participant data, checking sources and generated work, and deciding what the evidence means.

## Choose and inspect the workflow

Before starting, identify the skill, agent interface and model runtime separately. Read the relevant `SKILL.md`, understand its boundaries, and decide whether to use it, adapt it or reject it. A local model does not guarantee a contained workflow if the agent still has cloud tools, authentication or telemetry enabled.

## Give the agent useful context

State the outcome you want, identify relevant files, and explain important constraints. Ask the agent to distinguish what it observed from what it inferred.

## Review generated work

Check that:

- factual claims are supported;
- interview evidence has not been invented or overgeneralised;
- interpretations are labelled as interpretations;
- code passes the relevant checks;
- sensitive information has not been added;
- the result remains understandable to the team.

Do not submit identifiable or restricted research material to a hosted service. For any pathway, use the minimum safely de-identified material and keep raw sources in approved secure storage.

## Keep human judgment visible

Use agents to support decisions, not to disguise them. When a choice matters, record the alternatives, reasoning, and consequences in `docs/decisions/`.

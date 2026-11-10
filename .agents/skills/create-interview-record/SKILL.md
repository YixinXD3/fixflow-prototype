---
name: create-interview-record
description: Create a consistent, de-identified customer-discovery interview record from user-supplied notes or a safely de-identified transcript. Use when recording interview evidence under docs/discovery/interviews, separating evidence from interpretation, documenting consent status, extracting follow-up questions, or reviewing an interview record for privacy and traceability.
---

# Create Interview Record

Turn supplied, de-identified interview material into a traceable project evidence record without inventing evidence or exposing participant information.

## Workflow

1. Inspect the supplied material before writing a record.
2. If it contains names, contact details, account identifiers, precise addresses, consent forms, raw recording links, or other identifying details, stop. Identify the categories that must be removed without repeating the sensitive values. Ask for a safely de-identified version.
3. Assign or use a participant code such as `P001`. Never derive the code from the participant's name or student number.
4. Record consent as `Documented`, `Not documented`, or `Not applicable to the supplied material`. Never infer consent.
5. Separate direct evidence from interpretation:
   - Put exact, de-identified statements in **Evidence** only when the supplied source supports the wording.
   - Put summaries of observed statements or behaviour in **Observations**.
   - Put the team's reasoning in **Interpretation and implications**.
6. Mark uncertainty explicitly. Do not turn one participant's statement into a claim about a whole customer segment.
7. List hypotheses as `Supported by this interview`, `Refuted by this interview`, or `Still unclear`. One interview is evidence, not validation by itself.
8. Record follow-up questions and contradictions that need more evidence.
9. State how an agent assisted and whether a team member reviewed the result.
10. Use [assets/interview-record-template.md](assets/interview-record-template.md) and save the result under `docs/discovery/interviews/` with a stable filename such as `2026-08-12-p001-shift-scheduling.md`.

For a classroom demonstration or first practice, use only the fictional material in [examples/synthetic-notes.md](examples/synthetic-notes.md).

## Hard boundaries

- Never invent participant statements, quotations, observations, consent, dates, or findings.
- Never store participant names, contact details, consent forms, raw recordings, or identifiable transcripts in Git.
- Never claim that an agent-generated record replaces review of the source material.
- Never silently discard conflicting or unclear evidence.
- Do not include a sensitive source URL. Use a non-identifying internal source reference if the team needs traceability.

## Final review

Before saving, confirm that:

- the participant is represented only by a non-identifying code;
- direct quotations are exact and safely de-identified;
- evidence, observations, and interpretation are visibly separate;
- consent and human-review status are explicit;
- claims do not extend beyond the supplied material;
- no sensitive source material will enter Git.

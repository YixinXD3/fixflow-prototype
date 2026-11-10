# Reorganization and synthetic service verification

Date: 2026-11-10, Australia/Brisbane. Starting personal revision `7ed6d2d`; course structure reference `47fdac4`. All supplied records and browser operations in this check are fictional. Codex-assisted software verification is not participant research or a human peer review.

## Executed locally

| Check | Observed result |
| --- | --- |
| Backend unit/API tests | 20/20 passed; includes original 15, private-blocker regression and four synthetic scenario/continuation checks |
| Retained prototype pure rule suites | 74/74 passed after source paths moved to public/ |
| New web client syntax | `node --check web/app.js` passed |
| Seed creation and rerun | Eight scenarios have intended states; rerun/reopen preserves changes rather than resetting them |
| Synthetic multi-blocker browser flow | Executed through real web forms and HTTP API against a dedicated local SQLite database |
| Resolve help then Continue | Rejected with remaining Part and Customer decision blockers |
| Customer approves AUD 85 | Approval recorded; repair remains Waiting |
| Manager records Received | Receipt saved; repair still Waiting until technician's explicit Continue |
| Technician continues and marks ready | In Progress then Awaiting Customer Confirmation |
| Owning customer confirms, reloads | Completed retained at version 17; completion record visible; no internal handover/help/parts/log sections in customer page |
| Browser console inspection | No error/warn entries at inspection |
| New customer view at 390×844 | clientWidth=390, scrollWidth=390; screenshot saved; viewport override reset afterward |

Browser fixture repair: `FF-B4865CF9797E`, [DEMO] Phone - three independent blockers. Fixture initialization occurred at 13:30 AEST; browser operations recorded 13:31–13:32. These are actual software-generated times, not participant observations. Historical published updates are now labelled “at publication” under Published progress history to avoid confusing an earlier update with the repair's current status.

## Privacy fix

The former blocker text repeated private help problem text to managers and newly assigned nonparticipants despite help-array filtering. Blocker output now uses a generic unresolved-help reason for nonparticipants, including error responses, while participants can read their own detail. A new regression covers manager, participant and reassigned technician visibility.

## Evidence and limits

- [Blocked Continue screenshot](../../../presentation/images/synthetic-blockers.png)
- [Completed after reload](../../../presentation/images/synthetic-completed.png)
- [390 px customer layout](../../../presentation/images/synthetic-mobile.png)
- Full historical Playwright suite, every account/upload/revision form, keyboard-only and all mobile screens were not exercised here.
- The local Docker executable is unavailable. A container build, mounted-volume permission check and health probe are configured in CI; report their actual remote result separately, not as a local build pass.
- No paid host, public backend endpoint, off-site backup schedule, real customer data, review signature or final assessment tag was created.
- The existing Pages URL is still the static demonstration until the personal branch is merged and the new Pages workflow/source is selected.

Run commands are in [the application guide](../../../../apps/fixflow/README.md). Final submission requirements and evidence boundaries are in [the handoff map](../../../team/submission-map.md).

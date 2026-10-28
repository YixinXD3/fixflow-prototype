# Shared integration checks — 27 October 2026

Codex ran all six test files: **47 tests passed**, including the existing customer workflow and approval checks, retained legacy model tests, 10 new manager rule tests and 3 new browser integration tests. After correcting the desktop container width, all 3 manager browser tests passed again. Desktop and 390px mobile screenshots were visually inspected.

The exercised end-to-end flow covers customer request creation, assignment and reassignment, two shortages plus help, a clarification and revised proposal, approval, technician completion and customer confirmation. Separate checks cover storage failure without losing the form, escaped user content and the legacy manager URL. This is automated software verification, not human review or participant testing.

The code uses main application baseline `0b3c77d729d79e4f8fd154f73c5836d987602b6c`, with local manager integration changes. No commit, push or deployment is part of these checks. See the [current module README](README.md) for reproduction and limitations.

---

The following is the historical check record for the earlier isolated increment; its integration limitations describe that older version.

# Manager implementation check record

Checked on 19 October 2026 against main snapshot `c36c219` plus this local contribution. Checks were performed by Codex. This is software verification, not human peer review or participant research.

## Results

- JavaScript syntax checks passed for model.js and manager.js.
- Seven Node behavioural tests passed: isolated updates, receipt versus repair state, invalid input rejection, date/status validation, repeated-save history, saved-state references and missing-request handling.
- Ten headless Chrome browser checks passed:
- Missing owner rejected and focus moves to the field.
- Owner, next action and status survive same-tab reload.
- Part receipt leaves Waiting and other blocker unchanged.
- Saved user text is displayed as text, not executable markup.
- Reset is cancellable and preserves legacy technician data.
- Received and unassigned filters select the expected records.
- Malformed saved state shows a warning and safe fictional records.
- 390 px mobile layout has no horizontal page overflow.
- No browser JavaScript errors during the tested flows.
- Blocked storage reports page-only changes without claiming persistence.

Desktop (1440 px) and mobile (390 px) screenshots were visually inspected. No JavaScript page errors were captured in the exercised flows.

## Reproduce

Use the syntax/test commands and manual tasks in the [module README](README.md). Saving persists only within a browser tab when sessionStorage is available. Confirm owner and next action survive reload, invalid fields are rejected, reset preserves technician data, and receiving a part leaves repair state unchanged.

## Limits and remaining work

No participant test, assistive-technology study, shared-user synchronisation, production authorization, supplier ordering or technician integration was performed. The outcome does not demonstrate faster repairs or improved business performance. Yujie's source verification and code understanding, team scope acceptance and Yurong's peer review remain pending.

AI assistance: Codex drafted the initial implementation and performed the checks above.


## Stock check and supplier contact — 27 October 2026

Within a repair's Parts follow-up, expand **Check stock and contact supplier**. Record why the part is required and whether stock was checked, available or unavailable. This records a manual check; it does not query or adjust an inventory database.

If unavailable, enter the supplier name and an email address or HTTPS website. Enter the exact part and quantity, review/edit the prefilled email subject and message, then save. **Open email draft** opens the configured email application with those saved details for review and sending. **Open supplier website** opens a new tab for external procurement. Unsaved edits must be saved before using the links. No supplier is preselected; demonstration tests use example.com.

Opening a link does not send an email, place an order, mark parts received or resume a repair. After placing an external order, record its reference here and update the existing parts status, owner, next action and arrival estimate. For available shop stock, arrange the internal handover and record receipt separately. Earlier stock/supplier entries remain in history. Email-app launch depends on the user's configured mail handler.

This implements a limited option discussed in the teacher meeting: requirement review, stock check, then an email-editor button or supplier website. It is not a supplier portal or automatic purchasing integration. The meeting also called for team scope agreement and validation with a real repair-shop manager; those human activities remain pending. No interview findings or orders are claimed by this implementation.

Verification: 52 automated tests passed, including 4 new supplier rule tests and a new browser workflow test. Checks cover available/unavailable stock, editable draft encoding, persisted supplier details, blocked unsaved links, storage-failure retry, isolated history and unchanged repair/receipt state. The website test was intercepted locally, and email URI content was inspected without sending mail. Desktop/mobile screenshots were inspected. AI assistance: Codex implemented and checked this contribution; Yujie and Yurong's review remains required for team acceptance.

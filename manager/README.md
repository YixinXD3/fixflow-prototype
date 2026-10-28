# Shared manager workspace

Updated 27 October 2026. Open the application's `#login` page and select Manager, or open `/manager/` through the local HTTP server. Use [application setup](../README.md).

## Implemented scope

- Repair overview with active, waiting, unassigned and all filters.
- Actual technician assignment and reassignment, separate from customer preference, with history.
- Technician-reported shortages on the same repair: owner, status, next action and optional arrival date.
- Additional-work proposals with reason, work description and cost; revisions and withdrawal retain earlier customer responses.
- Work remains blocked by outstanding blocking parts, help or customer decisions. Receiving one part cannot clear another blocker. Receipt and approval do not finish a repair.
- Failed manager saves preserve the current form and original repair; unsaved navigation asks before discarding changes.

## Code map

`shared-model.js` contains immutable validation and transition rules. `workspace.js` renders the shared jobs and persists through `fixflow-prototype-v1`. `workspace.css` supplies manager layouts. `index.html` redirects the former entry URL. The earlier `model.js`, `manager.js` and `manager.css` remain as historical implementation files; the active entry no longer loads them or uses `fixflow-manager-followup-v1`.

New customer jobs start unassigned. Older sample jobs without an assignment field map to Jordan for compatibility. An explicit null assignment remains unassigned. Technical help, shortage and proposal histories remain separate.

## Review sequence

1. Create a fictional customer request; select a preferred technician.
2. Assign it as Manager and reload. Reassign it; confirm preference and history remain.
3. Select the assigned demo technician. Start work and report two blocking shortages.
4. Receive just one as Manager; check work remains blocked. Resolve the other shortage and any open help.
5. Propose additional work. Ask for clarification as Customer, revise as Manager, then approve as Customer.
6. Resume and finish as Technician; confirm completion as Customer.

See [check record](implementation-checks.md). This is a same-tab prototype with no real authentication, backend or supplier integration. Human code review, manager validation and usability testing remain pending. Codex assisted implementation and automated checks; Yujie should understand the code and review it with Yurong before team acceptance.


## Stock check and supplier contact — 27 October 2026

Within a repair's Parts follow-up, expand **Check stock and contact supplier**. Record why the part is required and whether stock was checked, available or unavailable. This records a manual check; it does not query or adjust an inventory database.

If unavailable, enter the supplier name and an email address or HTTPS website. Enter the exact part and quantity, review/edit the prefilled email subject and message, then save. **Open email draft** opens the configured email application with those saved details for review and sending. **Open supplier website** opens a new tab for external procurement. Unsaved edits must be saved before using the links. No supplier is preselected; demonstration tests use example.com.

Opening a link does not send an email, place an order, mark parts received or resume a repair. After placing an external order, record its reference here and update the existing parts status, owner, next action and arrival estimate. For available shop stock, arrange the internal handover and record receipt separately. Earlier stock/supplier entries remain in history. Email-app launch depends on the user's configured mail handler.

This implements a limited option discussed in the teacher meeting: requirement review, stock check, then an email-editor button or supplier website. It is not a supplier portal or automatic purchasing integration. The meeting also called for team scope agreement and validation with a real repair-shop manager; those human activities remain pending. No interview findings or orders are claimed by this implementation.

Verification: 52 automated tests passed, including 4 new supplier rule tests and a new browser workflow test. Checks cover available/unavailable stock, editable draft encoding, persisted supplier details, blocked unsaved links, storage-failure retry, isolated history and unchanged repair/receipt state. The website test was intercepted locally, and email URI content was inspected without sending mail. Desktop/mobile screenshots were inspected. AI assistance: Codex implemented and checked this contribution; Yujie and Yurong's review remains required for team acceptance.

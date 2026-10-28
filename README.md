# FixFlow shared workflow prototype

Open https://yixinxd3.github.io/fixflow-prototype/#login and choose Manager, Repair Technician or Customer. Switch roles in the same tab to demonstrate shared repair records.

## Manager and supplier workflow

Managers assign and reassign repairs, track parts shortages and publish additional-work proposals. In Parts follow-up, expand **Check stock and contact supplier**. Record the requirement and manual stock check. If unavailable, save the supplier name and email or HTTPS website, review the editable draft, then use **Open email draft** or **Open supplier website**. Place orders externally and record the order reference and follow-up status afterwards. Opening a link does not send mail, place an order or receive a part.

Technicians see their assigned jobs, report shortages and coordinate help. Outstanding parts, help and customer decisions block continuing work. Customers request repairs, view public progress, respond to additional-work proposals and confirm completion. A preference does not assign a technician; receipt and approval do not automatically complete a repair.

## Local use and checks

Run `python -m http.server 5173` from this folder and open http://localhost:5173/#login. No build step or application dependencies are needed. GitHub Pages serves the main branch root.

With Node installed, run `node --test tests/*.test.cjs`. Browser tests additionally require Playwright resolvable by Node and installed Chrome/Edge browsers. Tests serve local fixtures in temporary browser contexts. All 52 automated tests passed for this publication preparation; the supplier website test uses an intercepted example.com page and sends no mail.

## Scope and provenance

Application source was synchronised from the team's COMP7110-02_Gita application, including Yujie's local supplier follow-up contribution. Existing customer and approval modules retain their team authorship. Codex assisted integration and automated checks. The group repository remains the source for research, team decisions and coursework records.

This is a browser-only demonstration using session storage in one tab. It has no secure login, shared database, automatic inventory, supplier API or payment service. Closing the tab ends the session. Use fictional information. Email opening requires a configured mail handler. Participant validation and human review are separate from automated software checks; no business-performance results are claimed.

## Technician help and shared state (Tianshu)

Technicians can send blocking help or nonblocking advice requests to another demo technician, accept received requests, reply, resolve their own requests and send appreciation. Switch the **Demo technician** selector to demonstrate both participants. Help, outstanding parts and customer decisions are checked independently; clearing a blocker never automatically resumes or completes a repair.

Shared session records are versioned and validated before saving. Invalid stored data is preserved and writes are blocked until the user exports or explicitly resets it through the recovery banner. Existing customer, manager and supplier workflows remain integrated with the same records. This remains a single-tab prototype, with no server-side identity or shared database.

Deployment integration checks: 58 logic tests passed, JavaScript syntax checks passed, and interactive browser checks covered create/accept/reply/resolve with reload, manager blockers, and retained customer repair details. Run the logic checks with `node --test tests/customer-actions.test.cjs tests/manager-followup.test.cjs tests/manager-integration.test.cjs tests/manager-supplier.test.cjs tests/tianshu-workflow.test.cjs`. The full automated browser suite was not rerun successfully in the integration environment because an isolated browser could not start; its earlier publication result above describes the earlier version. New browser scenarios are in `tests/tianshu-help.browser.test.cjs` (Playwright and Edge, or `FIXFLOW_BROWSER_PATH`, required).

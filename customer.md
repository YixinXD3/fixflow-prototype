# FixFlow Customer Module

## Ownership and scope

Owner: Yurong Duan. Reviewer: Shumin Wang. Shared-state review: Tianshu Gao. Application integration: Yixin Zhang. Manager workflow: Yujie Jiao. These identify responsibilities, not completed review approvals.

The customer module provides role selection, requests, repair lists, public progress and conversations within FixFlow. Manager assignment, technician ownership checks, supplier follow-up, formal customer responses and final confirmation are integrated through their respective modules.

## Run

Open this repository in VS Code and start Live Server on `index.html`, or run from the repository root:

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Open http://127.0.0.1:5173/#login. No build step or application dependencies are required. Keep the server running and switch roles within the same browser tab. Use fictional information. There is no real authentication or shared database; sessionStorage retains data across refreshes in this tab, not across devices.

## Files

- `index.html`: entry and script/style loading.
- `customer.js`: customer routes, request saving, progress, conversations and public-update editor.
- `customer.css`: customer styling using the existing visual system.
- `customer-actions.js` and `customer-actions.css`: formal responses and completion controls.
- `app.js` and `styles.css`: technician application and base styling.
- `manager/shared-model.js`, `manager/workspace.js` and `manager/workspace.css`: integrated manager rules, pages and styles.
- `tests/customer-workflow.test.cjs`: customer browser tests.
- `tests/customer-workflow.cjs`: additional customer regression checks.
- `tests/pr1-merge-checks.md`: integrated-version verification.

Do not additionally load earlier week10/week11/week12 customer extension scripts. Historical standalone manager files remain in the repository; the active manager workspace uses the shared repair records.

## Demonstrate

1. Select Customer and Request Repair. Enter a device model and problem description. Optional notes and up to three JPG/PNG/WebP photos are supported, each at most 2 MB.
2. Choose a preferred technician or Let the manager arrange. Submit once. The new repair opens in detail and appears in My Repairs.
3. Refresh and verify the ID, problem description and saved data remain.
4. Switch to Manager and assign the same repair. A preference does not assign work automatically.
5. Switch to Repair Technician, select the assigned technician and open that repair in My Jobs. Start work when prerequisites are satisfied.
6. Publish a confirmed customer explanation, next action and optional waiting reasons. Return to Customer and check the same repair. Internal notes, logs and supplier comments are not published automatically.
7. For a general response request, open the repair conversation and send a message. Its receipt does not approve extra work.
8. For extra work, publish a structured proposal as Manager and respond through the Customer approval controls. A revised proposal uses a new ID and preserves earlier responses.
9. Resolve applicable blockers, resume work as the assigned technician, and mark it ready for customer confirmation. Confirm as Customer to complete the repair.

Sample customer record CR-1001 links to RS-10482. New customer requests use a unique shared repair/job identifier.

## Data and integration

Shared records use `fixflow-prototype-v1`, containing `{ jobs, requests, labels, techs }`. Customer records use `fixflow-customer-v1`. Customer saving checks both writes, rolls back on failure and retains input. Unreadable saved data blocks saving rather than silently overwriting it.

New jobs include `id`, `customerId`, `device`, `customerDescription`, `createdAt`, `receivedAt`, `status: 'To Do'`, `preferredTechnicianId` and `assignedTechnicianId: null`, plus the technician fields. The customer record references the job through `jobId`. Managers write confirmed assignment into `assignedTechnicianId` and `assignedTechnician` on that same job.

Legacy customer records without customerId belong to sample customer C001 for compatibility. Filtering is a demonstration UI feature, not secure access control. Missing linked repairs are explicitly reported.

Internal logs and updatedAt do not constitute public updates. Public information uses `job.publicProgress`:

```js
{
  reason: 'Waiting for a replacement display.',
  nextAction: 'The shop will check availability.',
  nextUpdate: '',
  waitingFor: ['parts', 'technical'], // parts, technical, customer
  actionRequired: false,
  statusAtPublication: 'Waiting',
  publishedAt: new Date().toISOString(),
  requestId: null // Optional explicit proposal ID.
}
```

Content is displayed while statusAtPublication matches the current repair stage; otherwise the page requests a fresh update. Unknown dates remain unconfirmed. Multiple published waiting reasons remain visible. Receiving parts or resolving help does not automatically complete a repair.

## Customer-action adapter

`window.FixFlowCustomerActions` provides these methods:

- `renderProgressActions(context)`: returns an HTMLElement with bound listeners, or null to retain the fallback.
- `getResponse(context)`: returns a stored response or null. Kinds are approved, declined and clarification, with an ISO `at` timestamp.
- Context is `{ repairId, jobId, requestId, publishedAt }`. The proposal ID comes from the publication or the job's currentApprovalRequestId.
- After successful saving, dispatch `fixflow:customer-action-saved` to refresh the view.

Receipts must be at least as recent as the publication and belong to the current proposal. The integrated adapter returns the original response stored on that request; external adapters can supply a matching requestId explicitly. Old approvals and ordinary messages cannot answer a revised formal proposal.

Controls are mounted for Awaiting Your Response and Ready for Pickup. The adapter owns validation, saving, proposal history and final confirmation. Ready for Pickup represents Awaiting Customer Confirmation; only the completion action changes it to Completed.

## Checks

With Node.js and installed Chrome/Edge, run from the repository root:

```powershell
npm install --no-save --package-lock=false playwright
node --check customer.js
node --test --test-concurrency=1 tests/*.test.cjs
node tests/customer-workflow.cjs
```

Tests start local servers and use isolated browser contexts. The separate regression runner defaults to Microsoft Edge and accepts FIXFLOW_PLAYWRIGHT, FIXFLOW_BROWSER and FIXFLOW_TEST_OUTPUT environment variables. Its default output is the operating system's temporary fixflow-customer-checks folder. node_modules is ignored by Git.

Some customer-only scenarios use controlled fixtures. Manager integration tests also exercise the connected customer → manager → technician → revised approval → completion flow.

On 28 October 2026 the integrated version passed 52 team tests and 20 additional customer checks. See [merge verification](tests/pr1-merge-checks.md). [Earlier results](tests/customer-check-results.md) describe the historical contribution. Software checks are distinct from participant research, human review and deployment verification.

## Related project records

- [Customer workflow](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/design/customer-workflow.md)
- [Customer scope](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/product/customer-mvp-scope.md)
- [Implementation checks](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/discovery/experiments/iteration-3/customer-implementation-checks.md)
- [Delivery record](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/team/yurong-customer-delivery.md)

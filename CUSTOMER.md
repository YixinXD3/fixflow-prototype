# Customer workflow — Yurong Duan

This contribution extends the existing FixFlow prototype. It uses the same page layout, routes, shared jobs and browser-tab storage. It does not create a separate application.

## Run

Open this repository folder in VS Code. Start **Live Server** on `index.html`, or run `python -m http.server 5173` in the repository root and open `http://localhost:5173/#login`.

Choose Customer. No account or password is required. Use fictional data only. Data survives refresh in the same browser tab through `sessionStorage`; it is not a database or a cross-device service.

## Changed files

- `customer.js`: customer request creation, list, detail, public progress, local conversation, technician preference, validation, saving and role integration.
- `customer.css`: additional progress, waiting-reason and receipt styling using the existing design.
- `tests/customer-workflow.cjs`: automated browser regression checks, including explicitly injected integration fixtures.
- `tests/customer-check-results.md`: observed results and test limitations.

`app.js`, `index.html`, `styles.css` and assets remain unchanged. No existing files need deletion. Do not additionally load the earlier week10/week11/week12 extension scripts: this customer module contains the consolidated implementation.

## Demonstrate the implemented flow

1. Choose Customer, then Request Repair. Enter a device and problem description. Optional notes and up to three JPG/PNG/WebP photos are supported, each at most 2 MB.
2. Choose a preferred technician or Let the manager arrange. Submit once. The newly created repair appears in My Repairs and opens its detail page.
3. Refresh. The request, description, identifier and conversation remain in this tab.
4. Switch to Repair Technician and open the same identifier in My Jobs. The original technician workflow remains available.
5. Open Publish Customer Update on the repair detail. Enter a public explanation and next action; optionally publish waiting reasons and request a customer response.
6. Return to Customer and open the same repair. Only the public explanation is shown, not internal notes, logs or supplier comments.
7. Use Review and Reply to leave a local conversation message. For a general update, a reply receipt appears. This never authorizes extra work or marks a repair completed.

The sample repair CR-1001 links to RS-10482. Newly created repairs use a unique shared job/repair ID. Existing technician controls still have their original prototype limitations: they are not evidence that manager assignment, formal approval, or blocker enforcement is implemented.

## Data contract for integration

The existing shared key is `fixflow-prototype-v1`, containing `{ jobs, requests, labels, techs }`. Customer records use `fixflow-customer-v1`. Both writes are checked; a failure rolls back storage and retains the user's input. Unreadable saved data blocks customer saving instead of silently overwriting it.

A new shared job contains `id`, `customerId`, `device`, `customerDescription`, `createdAt`, `receivedAt`, `status: 'To Do'`, `preferredTechnicianId`, and `assignedTechnicianId: null`, plus the original technician fields. The corresponding customer record uses `jobId` to reference it.

**Yujie:** write the actual assignee into `assignedTechnicianId` and `assignedTechnician` on this same job. A preference does not count as assignment. The UI reads the confirmed assignee on its next render. This repository currently has no manager module.

**Yixin / Tianshu:** preserve these fields when updating shared jobs. Internal logs and `updatedAt` are not public update timestamps. Store customer-visible information in `job.publicProgress`:

```js
{
  reason: 'Waiting for a replacement display.',
  nextAction: 'The shop will check availability.',
  nextUpdate: '', // Unknown; do not invent an arrival date.
  waitingFor: ['parts', 'technical'], // parts, technical, customer
  actionRequired: false,
  statusAtPublication: 'Waiting',
  publishedAt: new Date().toISOString(),
  requestId: null // Current formal proposal ID when applicable.
}
```

The public update is displayed only while `statusAtPublication` matches the current shared status. Otherwise the page requests a fresh public update. Multiple published waiting reasons remain visible. Completing a help request or receiving a part does not itself change customer completion state.

**Shumin:** the optional adapter is `window.FixFlowCustomerActions`:

```js
// context: { repairId, jobId, requestId, publishedAt }
window.FixFlowCustomerActions = {
  renderProgressActions(context) {
    // Return an HTMLElement containing your actual proposal or completion controls.
    // Bind listeners to the element. Returning null keeps the conversation fallback.
  },
  getResponse(context) {
    // Return null, or a persisted receipt:
    // { requestId, kind: 'approved' | 'declined' | 'clarification', at: ISO_timestamp }
  }
};
// Dispatch after your module has successfully persisted its response/job update:
window.dispatchEvent(new Event('fixflow:customer-action-saved'));
```

The adapter is mounted for Awaiting Your Response and Ready for Pickup. Receipts must be at least as recent as the publication and match its proposal ID when supplied. A new proposal must have a new request ID; an old approval must not answer it. A general conversation message is not a formal proposal response. The adapter owns its validation, saving, revised-proposal history and final-completion action. This contribution does not implement a duplicate approval engine.

Ready for Pickup is a display label for `Awaiting Customer Confirmation`; it is not `Completed`. Formal final confirmation remains the responsibility of the customer-actions module. The existing technician simulation button is not real customer confirmation.
# FixFlow Customer Module

## Ownership and scope

Owner: Yurong Duan. Reviewer: Shumin Wang. Shared-state review: Tianshu Gao. Application integration: Yixin Zhang. Manager dependency: Yujie Jiao.

The customer module provides role selection, requests, repair lists, public progress and repair conversations. It extends the existing technician application through its render function and shared jobs collection.

## Run

From the repository root:

```powershell
py -m http.server 8000 --bind 127.0.0.1 --directory apps/fixflow/public
```

Open http://127.0.0.1:8000/#login. Keep the server running and use one browser tab when switching roles. If py is unavailable but Python is installed, use python instead.

No package installation or build step is required.

## Files

- public/index.html: loads styles.css, customer.css, app.js and customer.js in order.
- public/customer.js: customer routes, request saving, progress projection, conversations and public-update editor.
- public/customer.css: customer styles using the existing visual system.
- public/app.js and public/styles.css: existing technician implementation, unchanged.
- public/manager/: existing independent manager increment, unchanged.

Remove the obsolete week10-progress and week11-progress JS/CSS files after updating index.html. Do not load the former week12-customer.js extension alongside this consolidated implementation.

Historical documentation remains available as the development record.

## Check commands

```powershell
node --check apps/fixflow/public/customer.js
node --test apps/fixflow/tests/manager-followup.test.cjs
```

## Demonstrate

1. Select Customer and submit a request using shop-arranged assignment.
2. Check the new detail, My Repairs and refresh persistence.
3. Return to #login in the same tab and select Repair Technician.
4. Open the new job through My Jobs, or use #job/ followed by its displayed identifier.
5. Start the repair using the existing technician control.
6. Publish a public explanation, next action and optional waiting categories.
7. Select Customer again and open the same repair.
8. If a response was requested, use Review and Reply.
9. Return to progress and verify Waiting for Shop Reply.

A customer message is not formal approval.

## Data and integration

The module retains fixflow-prototype-v1 and fixflow-customer-v1 sessionStorage keys. Legacy customer records without customerId are treated as records for the original sample customer C001. This is compatibility handling, not authentication.

The manager increment uses fixflow-manager-followup-v1 and separate DEMO records. It is not connected to customer-created requests by this change.

The existing technician detail contains sample assignment/date text and does not yet render every customer-description field. These are integration issues for the owning module; opening the same job does not prove that all technician labels are dynamic.

## Related records

- [Customer workflow](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/design/customer-workflow.md)
- [Customer scope](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/product/customer-mvp-scope.md)
- [Implementation checks](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/discovery/experiments/iteration-3/customer-implementation-checks.md)
- [Yurong delivery record](https://github.com/COMP1100-COMP7110-2026-s2/COMP7110-02_Gita/blob/main/docs/team/yurong-customer-delivery.md)

## Repeatable customer workflow tests

The customer browser tests are in `tests/customer-workflow.test.cjs`.

Requirements:

- Node.js with the built-in test runner.
- Playwright.
- Microsoft Edge, or Playwright Chromium.

From the repository root:

```powershell
npm install --prefix apps/fixflow/tests --no-save --package-lock=false playwright
node --test apps/fixflow/tests/customer-workflow.test.cjs
```

The test starts its own local HTTP server and uses isolated browser contexts. It does not require a running Python server and does not reuse the user's normal browser session.

If Microsoft Edge is unavailable, run the following from `apps/fixflow/tests`:

```powershell
npx playwright install chromium
$env:FIXFLOW_BROWSER = "chromium"
node --test customer-workflow.test.cjs
```

Do not commit node_modules.

The tests cover requests, validation, preference versus assignment, persistence, public updates, replies, customer filtering, storage failure recovery and optional response controls.

Assignment and response-provider scenarios use controlled fixtures. They do not establish that the manager interface or formal approval module has been integrated.

A passing test run verifies the checked software behaviours. It is not new customer research.
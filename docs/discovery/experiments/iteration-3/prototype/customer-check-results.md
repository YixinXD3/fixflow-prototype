# Customer regression results

Owner: Yurong Duan. Intended reviewer: Shumin Wang; review remains pending.

Executed: 27 October 2026, Australia/Brisbane. Baseline: `9e1b4e4fc470e6294d86d7ac22cf1b30ca6060de`, with the local customer changes accompanying this report on `yurong-duan`. This is not a claim that a new commit or deployment has been created.

Runner: `tests/customer-workflow.cjs`, Node.js, Playwright and Microsoft Edge, 390 × 900 viewport, isolated browser context. Result: **20 checks passed**, no browser JavaScript errors or missing resources during the checks.

1. Role selection loads.
2. Whitespace-only required input is rejected.
3. Shop-arranged submission creates one linked job and opens its detail.
4. Refresh and My Repairs retain the new request.
5. The same ID opens in the original technician detail.
6. Public editor publishes multiple waiting categories and response prompt.
7. Local message receipt survives refresh without approving or completing work.
8. An old message does not answer a newer publication.
9. A stage change hides the stale public explanation.
10. Customer detail reads the actual assignment fixture.
11. Another customer's fixture is excluded from list, detail and conversation.
12. Failure of the second storage write rolls back; retry retains preference without assigning it.
13. Optional response controls retain their bound event listeners.
14. Completed overrides a previous response request.
15. Problem description survives; the waiting-parts fallback does not expose internal data.
16. Ready for Pickup does not automatically complete the repair.
17. Adapter receipts must match a revised proposal ID; they do not complete a repair.
18. Technician refresh retains the publisher and the original profile Logout works.
19. Malformed customer storage is reported and preserved.
20. Mobile page has no horizontal overflow, missing resources or browser JavaScript errors.

Assignment, extra-work approval receipts, waiting states, other-customer ownership and storage failures are deliberately injected fixtures where the corresponding production module is absent. These checks verify customer-side handling, not completed manager or approval functionality. They are software checks, not customer research, peer review, deployment verification or performance measurements.

The mobile screenshot was inspected for the existing blue card layout, legible detail fields and fixed bottom navigation. Technician source, base styling and assets are unchanged. Formal integrated review must be repeated after teammates supply manager assignment, response controls and shared state rules.

# Synthetic FixFlow service flow

Prepared 2026-11-10. All names, devices, conversations and procurement references supplied by the fixture builder are fictional. These are demonstration data, not consented participant records or evidence of measured benefit. Fresh initialization uses current UTC generation times and random local credentials.

## Eight scenarios

| Device name prefix | Customer | Current technician | Initial state / purpose |
| --- | --- | --- | --- |
| [DEMO] Phone - awaiting assignment | alex@example.test | None; preference Taylor | To Do; manager can assign |
| [DEMO] Tablet - diagnostic handover | alex@example.test | Jordan | In Progress; handover, public update, message and tiny synthetic photo |
| [DEMO] Phone - three independent blockers | alex@example.test | Jordan | Waiting; accepted Taylor help, ordered display and pending AUD 85 proposal |
| [DEMO] Laptop - customer confirmation | sam@example.test | Jordan | Awaiting Customer Confirmation |
| [DEMO] Console - completed repair | alex@example.test | Jordan | Completed with customer confirmation |
| [DEMO] Phone - revised customer proposal | alex@example.test | Jordan | Waiting; old declined proposal retained, revised AUD 60 proposal pending |
| [DEMO] Tablet - reassigned with history | alex@example.test | Taylor | In Progress; original Jordan handover retained |
| [DEMO] Laptop - nonblocking technical advice | sam@example.test | Taylor | In Progress; Marcus advice request does not block |

The local manager email is manager@example.test, other technician emails jordan@example.test, taylor@example.test and marcus@example.test. On a fresh --demo start all six accounts share the randomly generated initial local password printed in the terminal; no password is committed. Sign out between roles or use separate browser profiles. A database initialized without --demo does not gain these records automatically.

## Full blocking scenario

1. Sign in as Jordan and open the three-independent-blockers phone. There are three blockers. Open My help; the Taylor request is already accepted and has a fictional reply. Resolve it as Jordan.
2. Return to the repair. Parts and approval remain; Continue must still fail until both are addressed.
3. Sign in as Alex, open that phone and approve the AUD 85 proposal. This does not complete or resume the repair.
4. Sign in as manager and open the same phone. The help status is visible but private help text is not. In parts follow-up set Received and save a next action. No supplier email or purchase is sent.
5. Sign in as Jordan. The repair is still Waiting with no blockers. Explicitly continue, then mark ready for customer confirmation.
6. Sign in as Alex and confirm completion. Reload; Completed and the confirmation persist. Internal handover/help/parts/log records remain excluded from the customer's response.

## New-request scenario

Start with the unassigned phone or submit a new fictional device as a customer. Manager assigns Jordan; Jordan starts, adds a structured handover and publishes a separate public update, then marks ready; the owning customer confirms. Receiving parts, approving a proposal or resolving help never substitutes for final confirmation.

For repeat rehearsals, keep the changed record or initialize a new dedicated database path. Startup must not erase a teacher's or teammate's previous demonstration actions.

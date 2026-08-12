# UC-004 — Approve Payroll

## 1. Feature Overview

UC-004 is the manager checkpoint between payroll calculation (UC-003) and payment processing (UC-005). A Payroll Manager reviews a pay period whose latest calculation run is `complete`, inspects the calculated employee lines, and records a single **approve** or **reject** decision for the period. Approving locks the period's totals and makes it eligible for UC-005 payment generation; rejecting sends it back to `calculated` status for UC-003 to recalculate. Every decision is written to an append-only `approval` history row and to `audit_log`.

The feature is a single React page (`ApprovalPage.jsx`) backed by four REST endpoints, all mounted under `/api/approvals` and all restricted to the `manager` role. It does not itself perform any payroll calculation — it only reads calculation output and gates the period's lifecycle status.

## 2. Actors

### Payroll Manager

The only actor with access to this feature. An authenticated `user_account` with `role = 'manager'`. Can list pay periods and their approval status, view a period's summary and employee-line breakdown, inspect an individual employee's payroll line, and submit an approve/reject decision.

### Employee

A `user_account` with `role = 'employee'` exists in the schema but has **no access** to any part of UC-004. The frontend route `/approvals` is wrapped in `<RoleRoute allowedRoles={["manager"]}>`, and every backend route in `backend/src/routes/approvals.js` runs `authenticate` then `authorize("manager")`. An employee token reaching any `/api/approvals/*` route is rejected with `403 FORBIDDEN` before the controller runs.

### Payroll Automation System

Performs the row-locking, status-transition, and audit-log recording described in the flows below, inside a single database transaction per decision.

## 3. Use Cases

### UC-004.1 — View Pending Payroll Periods & Summary

**Primary Actor:** Payroll Manager
**Trigger:** The manager opens the Approvals page, or changes the "Payroll cycle" dropdown.
**Preconditions:** The manager is authenticated with role `manager`. At least one `pay_period` row exists (not required for the page to load, only to see data).
**Main Flow:**

1. On page load, the frontend calls `GET /api/approvals/periods`.
2. The backend returns every `pay_period`, each joined (via `LEFT JOIN LATERAL`) to its **authoritative calculation run** — the highest `run_number` `calculation_runs` row with `status = 'complete'` for that period — and to its most recent `approval` decision, if any. Ordered newest `start_date` first.
3. The frontend auto-selects the first period whose `status` is `pending_approval`; if none is pending, it falls back to the first period in the list.
4. The frontend calls `GET /api/approvals/summary?payPeriodId=<id>` for the selected period and renders four summary cards (Total gross, Total net, Previous cycle net, Current status) plus a per-employee breakdown table (name, gross pay, incentive, CPF, SDL, net pay, status).
5. Switching the dropdown re-runs step 4 for the newly selected period.

**Alternative / Exception Flows:**

- No pay periods exist at all: the page shows "No payroll periods are available for review." (empty array, not an error.)
- `GET /periods` or `GET /summary` fails (network/DB error): the frontend shows "Could not load payroll periods/summary: `<error message>`" — this is the raw caught error message, not a specific error code, since neither the frontend nor these two read endpoints classify failures into codes.
- `GET /summary` called with no `payPeriodId` query param: `400` `{ message: "payPeriodId is required." }` (the frontend never omits it, but it is a reachable contract state for any other API client).
- `GET /summary` for a `payPeriodId` that matches no `pay_period`: `404` `{ message: "Pay period not found." }`.
- A selected period has **no** `complete` calculation run (e.g. still `draft`/`validated`, or a run is `running`/`failed`/`voided`): `totalGross`/`totalNet` come back `null` and `lines` is an empty array. The page still renders; the "Record decision" panel simply never appears for that period, because it is gated purely on `summary.status === 'pending_approval'`, independent of whether a run exists.

**Postconditions:** None — this flow is read-only.

**Business Rules / Validation:**

- The "authoritative" run for any period is always the latest `complete` run by `run_number`; `running`, `failed`, and `voided` runs are ignored by every query in this feature.

**Security / Authorization:**

- `authenticate` + `authorize("manager")` on the whole router; `RoleRoute` manager-only on the frontend route.

**Related Implementation:**

- Frontend: `ApprovalPage.jsx` (`loadPeriods`, `loadSummary`)
- Backend: `GET /api/approvals/periods`, `GET /api/approvals/summary`; `approvalController.listPayPeriods` / `getSummary`; `approvalService.listPayPeriods` / `getSummary`

### UC-004.2 — Inspect an Employee Payroll Line

**Primary Actor:** Payroll Manager
**Trigger:** The manager clicks "View details" on an employee row in the breakdown table.
**Preconditions:** A payroll summary with at least one line is currently loaded.
**Main Flow:**

1. The frontend calls `GET /api/approvals/lines/:lineId`.
2. The backend joins the `payroll_lines` row to `staff` (for name and employment type) and separately aggregates that staff member's non-deleted `performance_inputs` for the same period.
3. The frontend opens a modal showing total hours (regular + OT + PH), OT hours, PH hours, gross + incentive, CPF + SDL deductions, net pay, and each performance input as `metricType: metricValue`.
4. The manager closes the modal (× button or backdrop click); no data changes.

**Alternative / Exception Flows:**

- `lineId` does not match any `payroll_lines` row: `404` `{ message: "Payroll line not found." }`. The modal never opens (the frontend's `selectedLine` state is never set); the message surfaces in the page's error banner instead.
- The staff member has no `performance_inputs` recorded for that period: the response's `performanceInputs` array is empty, and the modal explicitly renders "No performance inputs required for this employee." rather than an empty list.

**Postconditions:** None — read-only; inspecting a line never changes its status or the period's status.

**Security / Authorization:** Same `authenticate` + `authorize("manager")` as the rest of the router.

**Related Implementation:**

- Frontend: `ApprovalPage.jsx` (`showLine`, the details modal)
- Backend: `GET /api/approvals/lines/:lineId`; `approvalController.getLineDetail`; `approvalService.getLineDetail`

### UC-004.3 — Record an Approve or Reject Decision

**Primary Actor:** Payroll Manager
**Trigger:** The manager submits the "Record decision" form, shown only while the selected period's `status` is `pending_approval`.
**Preconditions:**

- The pay period's current `status` is exactly `pending_approval`.
- The calculation run being approved (`summary.calculationRunId`, i.e. the run the manager is currently looking at) is `complete` and belongs to that period.
- No newer `complete` run has been produced for the period since the page loaded (nobody recalculated in the meantime).
- That run has zero incomplete payroll lines (`lines_incomplete = 0`).

**Main Flow — Approve:**

1. The manager leaves the decision as "Approve payroll" (the default) and submits.
2. The frontend `POST`s `{ payPeriodId, calculationRunId, decision: "approved", comment }` to `POST /api/approvals/`.
3. The backend opens a transaction and row-locks (`FOR UPDATE`) the `pay_period` and `calculation_runs` rows.
4. It validates, in order: the period exists and is `pending_approval`; the run exists, belongs to the period, and is `complete`; that run is still the latest `complete` run; the run has no incomplete lines.
5. It updates `pay_period`: `status = 'approved'`, `is_locked = true`, `locked_at = now()`, and copies `total_gross`/`total_net` from the run's totals.
6. It inserts an `approval` row (`decision = 'approved'`, `approved_by` = the manager's name/email/id, `comment` = trimmed value or `null`) and an `audit_log` row (`action = 'PAYROLL_APPROVED'`).
7. It commits and returns `201` with the new approval record plus `status: "approved"`, `isLocked: true`.
8. The frontend shows "Payroll approved by `<name>`.", clears the comment field, and reloads both the period list and the summary — the decision panel then disappears, since the period is no longer `pending_approval`.

**Main Flow — Reject** (differs at steps 1, 5, 6, 8):

1. The manager selects "Reject payroll" and must type a rejection reason (the textarea is `required` in the browser; the server also enforces this independently — see below).
5. `pay_period.status` is set to `'calculated'` instead of `'approved'` (sent back for UC-003 recalculation), not left as/returned to `pending_approval`.
6. The `approval` row has `decision = 'rejected'` with the manager's comment; the `audit_log` row has `action = 'PAYROLL_REJECTED'`.
8. The frontend shows "Payroll rejected and returned for calculation."

**Alternative / Exception Flows** (each is a distinct backend error code; HTTP status in parentheses — see `docs/suhaila/api-documentation.md` for full response bodies):

- Missing `payPeriodId`, missing `calculationRunId`, or `decision` not one of `approved`/`rejected`: **`VALIDATION_ERROR`** (400).
- `decision = "rejected"` with an empty or whitespace-only `comment`: **`COMMENT_REQUIRED`** (422).
- `payPeriodId` matches no `pay_period`: **`NOT_FOUND`** (404).
- The period's current status is **not** `pending_approval` — this is the actual guard against approving (or rejecting) the same period twice, since a second attempt on an already-`approved` period fails here: **`INVALID_STATUS`** (409), and the response includes the period's real current status.
- `calculationRunId` does not exist, does not belong to this period, or is not `status = 'complete'`: **`RUN_NOT_FOUND`** (404).
- A newer calculation run has since completed for this period (someone recalculated after the page was loaded): **`STALE_RUN`** (409) — the manager must reload and review the newer run.
- The targeted run still has incomplete payroll lines: **`INCOMPLETE_LINES`** (409) — this is the "cannot approve an incomplete/not-fully-calculated period" case.
- Any unexpected DB failure: the transaction rolls back and the error becomes a `500 INTERNAL_ERROR` from the global handler.

**Postconditions:**

- **Approved:** `pay_period.status = 'approved'`, `is_locked = true`, `locked_at` set, totals frozen from the run; one new `approval` row; one new `audit_log` row; the period becomes eligible for UC-005 payment processing.
- **Rejected:** `pay_period.status = 'calculated'`; one new `approval` row (`decision = 'rejected'`, with comment); one new `audit_log` row; the period must go through UC-003 recalculation before it can reach `pending_approval` again.
- On any error, the whole transaction is rolled back — there is no partial write.

**Business Rules / Validation:** See the exception list above. A comment is required only when rejecting. The `approved_by` value is a free-text snapshot of the manager's name at decision time (`fullName`, else `email`, else `id`) — it is not a live foreign-key lookup, so it will not change if the account is later renamed.

**Security / Authorization:** `authenticate` + `authorize("manager")`. The actor identity used for `approved_by` and the audit entry comes from the verified JWT (`req.user`), never from the request body.

**Related Implementation:**

- Frontend: `ApprovalPage.jsx` (`submitDecision`)
- Backend: `POST /api/approvals/`; `approvalController.submitDecision`; `approvalService.submitDecision`, `validationError`

# UC-005 — Payment Processing, Payment File Generation, HRMS Sync and Payslips

## 1. Feature Overview

UC-005 is the final payment stage of the payroll workflow. It accepts a canonical calculation run whose `payroll_lines` are complete and whose pay period has an approval linked through `approval.calculation_run_id`, is approved, and is locked. A Payroll Manager can validate payment readiness, correct bank details, generate Payment Batches and their immutable employee payment snapshots, and download the resulting CSV/GIRO payment file.

Generation immediately invokes the mock HRMS integration. A successful sync completes the Payment Batch, marks the pay period paid, and generates employee payslips. A failed sync retains the Payment Batch for retry or cancellation. The system records security-sensitive and payment-processing activity in the audit log.

## 2. Actors

### Payroll Manager

An authenticated `manager` who can inspect readiness and employees, update bank details, generate and manage Payment Batches, download payment files, retry failed HRMS syncs, cancel eligible batches, view all payslips, download payslip PDFs, and read audit events.

### Employee

An authenticated `employee` linked to a `staff` record through `user_account.staff_id`. The employee can list, view, and download only their own payslips. Employees cannot use manager Payment Batch, staff-bank, all-payslip, or audit-log operations.

### Mock HRMS Integration

The system adapter that receives the Payment Batch snapshot. It returns either an external HRMS reference and accepted-record count or a failure result. Its result drives the Payment Batch state and whether payslips are generated.

### Payroll Automation System

Performs readiness validation, snapshot and file construction, HRMS state transitions, payslip and PDF generation, masking of bank account numbers in API views, and audit recording.

## 3. Use Cases

### UC-005.1 — Supporting Authentication: Manager Login

**Primary Actor:** Payroll Manager  
**Trigger:** The manager submits the login form.  
**Preconditions:** A `user_account` exists and authentication is configured.  
**Main Flow:**

1. The manager enters a validated email address and password.
2. The backend verifies the password and confirms that the account is active.
3. The backend issues a signed JWT containing the role and linked staff ID, returns a safe user profile, updates the last-login time, and records `LOGIN_SUCCESS`.
4. The frontend stores the authenticated session and routes the manager to the requested protected page or dashboard.

**Alternative / Exception Flows:**

- A wrong password or unknown email returns the same generic `INVALID_CREDENTIALS` response and records `LOGIN_FAILURE`.
- A disabled account returns `ACCOUNT_DISABLED` and records a failure without issuing a token.
- Invalid form input, excessive login attempts, an unavailable API, or missing authentication configuration prevents login and is surfaced as an error.

**Postconditions:**

- The active manager has an access token; no password hash is returned.

**Business Rules / Validation:**

- Email is normalized and validated; password length is 8–100 characters. Login is limited to 10 requests per 15 minutes per limiter key.

**Security / Authorization:**

- Invalid and unknown accounts receive a non-enumerating credential error. Protected requests require a valid, unexpired Bearer JWT belonging to a currently active account.

**Related Implementation:**

- Frontend: `LoginPage.jsx`, `authApi.js`, `AuthContext.jsx`, `ProtectedRoute.jsx`, `RoleRoute.jsx`
- Backend: `POST /api/auth/login`; `authController.js`, `authService.js`, `authenticate.js`, `authorize.js`

### UC-005.2 — View Payment Preview and Readiness

**Primary Actor:** Payroll Manager  
**Trigger:** The manager opens Payment Preview or selects a period while generating a Payment Batch.  
**Preconditions:** The manager is authenticated; the pay-period ID is a valid UUID.  
**Main Flow:**

1. The system lists approved and locked periods and indicates whether each already has an active Payment Batch.
2. The manager selects an available period.
3. The backend loads the latest approved `approval` with a `calculation_run_id` and the run's `payroll_lines` and staff records.
4. The backend validates the period, approval, payroll-line completeness, positive net pay, duplicate state, and bank details.
5. The preview returns employee count, total approved net pay, employee payroll values, masked bank accounts, and each employee's bank-validation status.

**Alternative / Exception Flows:**

- A missing period, non-approved or unlocked period, missing run-linked approval, no payroll lines, incomplete line, non-positive net pay, or existing active Payment Batch blocks the preview with its specific error.
- Missing or invalid bank details do not suppress the preview; they make `ready` false and identify affected employees.
- Invalid IDs are rejected before service execution. API/network failure leaves the page in a retryable error state.

**Postconditions:**

- No payment data is changed; the manager sees whether generation can proceed and which employees need correction.

**Business Rules / Validation:**

- Only `approved` and locked periods are eligible. Every line selected by `approval.calculation_run_id` and period must be `complete`, and every net pay must be greater than zero.

**Security / Authorization:**

- Eligible-period and preview APIs require an authenticated manager. Returned account numbers are masked.

**Related Implementation:**

- Frontend: `PaymentPreviewPage.jsx`, `PaymentBatchesPage.jsx`, `paymentApi.js`
- Backend: `GET /api/payments/eligible-periods`, `GET /api/payments/preview`; `paymentReadinessService.js`

### UC-005.3 — Review Employees Before Payment

**Primary Actor:** Payroll Manager  
**Trigger:** The manager reviews employees from Payment Preview.  
**Preconditions:** A payment preview is available for the selected period.  
**Main Flow:**

1. The system presents payroll amounts and bank readiness for each included payroll line.
2. The manager searches employees or filters them by ready, missing, or invalid bank status.
3. The manager can open the dedicated review page, switch between missing and invalid categories, and page through results.
4. The system shows masked accounts and identifies fields or formats requiring attention.

**Alternative / Exception Flows:**

- No payroll lines produces an empty state.
- No matching employee produces a filter-specific empty state.
- A refresh or API failure shows an error and retry action.

**Postconditions:**

- The manager has identified employees that block Payment Batch generation; no payroll values are edited by this use case.

**Business Rules / Validation:**

- Bank code must match 3–20 alphanumeric/hyphen characters; account number must match 5–50 alphanumeric/hyphen characters.

**Security / Authorization:**

- The pages and APIs are manager-only, and bank account display remains masked.

**Related Implementation:**

- Frontend: `PaymentPreviewPage.jsx`, `ReviewEmployeesPage.jsx`
- Backend: `GET /api/payments/preview`; `paymentReadinessService.js`

### UC-005.4 — Update Missing or Invalid Bank Details

**Primary Actor:** Payroll Manager  
**Trigger:** The manager chooses to add, fix, or edit an employee's bank details.  
**Preconditions:** The staff ID is valid and the staff record exists.  
**Main Flow:**

1. The manager enters a bank code and bank account number.
2. Client and server validation check both formats.
3. The backend updates the staff record and records `BANK_DETAILS_UPDATED` without storing the account value in audit details.
4. The API returns a masked account number and the frontend reloads readiness.

**Alternative / Exception Flows:**

- Invalid input or ID is rejected.
- A nonexistent staff member returns `STAFF_NOT_FOUND`.
- API/network failure leaves the dialog open with an error and does not report success.

**Postconditions:**

- Valid bank data is stored on `staff`; the employee may become payment-ready.

**Business Rules / Validation:**

- Both fields are required and use the readiness format rules.

**Security / Authorization:**

- Only managers may update bank details. API responses and audit details do not expose the full account number.

**Related Implementation:**

- Frontend: `PaymentPreviewPage.jsx`, `ReviewEmployeesPage.jsx`, `staffApi.js`
- Backend: `PATCH /api/staff/:staffId/bank-details`; `staffController.js`, `staffBankService.js`

### UC-005.5 — Generate a Payment Batch and Prevent Duplicates

**Primary Actor:** Payroll Manager  
**Trigger:** The manager confirms generation for a ready period.  
**Preconditions:** All readiness checks in UC-005.2 pass, including valid bank details; no non-cancelled active Payment Batch exists.  
**Main Flow:**

1. The backend rechecks readiness inside a serializable transaction and locks the selected pay-period row.
2. It creates a `payment_batch` linked to the approved calculation run with a unique `PAY-...` reference, GIRO format, employee count, total amount, and generating manager.
3. It copies employee identity, bank, earnings, deductions, net pay, and payment reference into `payment_batch_item` snapshot rows.
4. It records `PAYMENT_BATCH_GENERATED` and automatically starts HRMS sync.
5. On successful sync, the response contains the completed Payment Batch.

**Alternative / Exception Flows:**

- Any readiness failure creates no partial Payment Batch or items.
- An active batch in `generating`, `generated`, `hrms_sync_pending`, `hrms_sync_failed`, or `completed` causes `DUPLICATE_PAYMENT_BATCH`.
- A cancelled batch does not block a replacement Payment Batch.
- HRMS failure returns `HRMS_SYNC_FAILURE` but deliberately retains the generated snapshot in `hrms_sync_failed` state for retry or cancellation.
- Invalid input, authentication failure, or API/network failure is surfaced without the UI assuming success.

**Postconditions:**

- A durable, immutable payment snapshot exists once creation commits; successful HRMS sync also completes downstream payslip generation.

**Business Rules / Validation:**

- Totals are derived from approved `payroll_lines.net_pay`; snapshot values are copied rather than recalculated from later staff/payroll changes.

**Security / Authorization:**

- Generation is manager-only and requires a valid JWT. The manager identity is stored as `generated_by` and audit actor.

**Related Implementation:**

- Frontend: `PaymentBatchesPage.jsx`, `paymentApi.js`
- Backend: `POST /api/payments/generate`; `paymentFileService.js`, `paymentReadinessService.js`, `hrmsSyncService.js`

### UC-005.6 — List, Search, Filter, and Summarize Payment Batches

**Primary Actor:** Payroll Manager  
**Trigger:** The manager opens the Payment Batches page.  
**Preconditions:** The manager is authenticated.  
**Main Flow:**

1. The backend returns Payment Batches newest first with period, generator, payment status, HRMS status, totals, and pagination metadata.
2. The manager searches by displayed batch, period, HRMS, or creator information and filters by period, payment status, HRMS status, or creator.
3. The UI displays pending, payment-ready, completed, and failed counts and paginates the filtered result.
4. The dashboard statistics endpoint can also return status counts, completed total, active staff, current period, current-year batch count, and pending approvals.

**Alternative / Exception Flows:**

- No records or no matches produces an empty state.
- Invalid server-side status or pagination query values are rejected.
- API/network failure produces a retryable error state.

**Postconditions:**

- No records are changed; the manager can select a Payment Batch for details or download.

**Business Rules / Validation:**

- The backend search covers batch and HRMS references; the current UI additionally filters its loaded rows by displayed period and creator. Server page size is capped at 100.

**Security / Authorization:**

- List and statistics endpoints are manager-only.

**Related Implementation:**

- Frontend: `PaymentBatchesPage.jsx`, `paymentApi.js`
- Backend: `GET /api/payments`, `GET /api/payments/dashboard/statistics`; `paymentFileService.js`

### UC-005.7 — View Payment Batch Details

**Primary Actor:** Payroll Manager  
**Trigger:** The manager selects a Payment Batch.  
**Preconditions:** The batch ID is a valid UUID.  
**Main Flow:**

1. The backend loads the batch, period, generator, and snapshot items.
2. It returns batch and HRMS state, references, totals, timestamps, cancellation data, employee payment rows, and payment-file metadata.
3. The UI displays employee readiness, payment values, HRMS outcome, file checksum/size, and actions permitted by the current state.

**Alternative / Exception Flows:**

- Invalid IDs are rejected; an unknown ID returns `PAYMENT_BATCH_NOT_FOUND`.
- API/network failure displays an error with retry behavior.

**Postconditions:**

- No record is changed.

**Business Rules / Validation:**

- File metadata is derived from the stored snapshot. Employee account numbers are masked.

**Security / Authorization:**

- Details are manager-only.

**Related Implementation:**

- Frontend: `PaymentBatchDetailsPage.jsx`, `PaymentBatchesPage.jsx`
- Backend: `GET /api/payments/:batchId`; `paymentFileService.js`

### UC-005.8 — Download Payment CSV / GIRO File

**Primary Actor:** Payroll Manager  
**Trigger:** The manager selects Download Payment File (GIRO).  
**Preconditions:** The Payment Batch exists, is not cancelled, and contains at least one item.  
**Main Flow:**

1. The backend formats the stored `payment_batch_item` snapshots as the GIRO CSV.
2. It records `PAYMENT_FILE_DOWNLOAD`.
3. It returns a `text/csv` attachment with a generated payroll filename; the UI saves the file.

**Alternative / Exception Flows:**

- A nonexistent batch returns `PAYMENT_BATCH_NOT_FOUND`.
- A cancelled batch returns `PAYMENT_BATCH_CANCELLED`; an empty batch returns `PAYMENT_FILE_EMPTY`.
- Missing/invalid JWT is rejected, an employee receives `FORBIDDEN`, and download/network failure is shown to the manager.

**Postconditions:**

- A CSV/GIRO copy is downloaded; stored payment data is unchanged and the download is audited.

**Business Rules / Validation:**

- File content is regenerated from the immutable snapshot; details expose its filename, MIME type, byte size, and SHA-256 checksum.

**Security / Authorization:**

- Payment-file downloads are manager-only; the endpoint is never public.

**Related Implementation:**

- Frontend: `PaymentBatchesPage.jsx`, `PaymentBatchDetailsPage.jsx`, `paymentApi.js`
- Backend: `GET /api/payments/:batchId/file`; `paymentFileService.js`, `giroFileFormatter.js`

### UC-005.9 — Perform and Retry HRMS Sync

**Primary Actor:** Payroll Manager (generation/retry); Mock HRMS Integration  
**Trigger:** Payment Batch generation starts automatic sync, or the manager confirms retry on a failed batch.  
**Preconditions:** The batch exists and is not cancelled; manual retry additionally requires `hrms_sync_failed`.  
**Main Flow:**

1. The backend marks the batch and sync as pending and records `HRMS_SYNC_START`.
2. It sends batch reference, period, total, and snapshot payroll records to the mock HRMS adapter.
3. On success, one transaction marks the batch and HRMS sync completed, stores the external reference and sync time, marks the approved period `paid`, and generates payslips.
4. The system records `HRMS_SYNC_SUCCESS` and each `PAYSLIP_GENERATION` event.
5. For a retry, it first records `HRMS_RETRY` and reuses the retained Payment Batch rather than regenerating it.

**Alternative / Exception Flows:**

- HRMS failure marks the batch `hrms_sync_failed`, stores the error message, records `HRMS_SYNC_FAILURE`, returns a gateway failure, and generates no payslips.
- Retry of any state other than `hrms_sync_failed` returns `INVALID_HRMS_RETRY`.
- A cancelled batch cannot sync; a completed batch passed directly to sync is idempotently returned.
- A nonexistent batch or invalid ID is rejected; API/network failure remains visible for another retry.

**Postconditions:**

- Success produces a completed Payment Batch, paid period, HRMS reference, and payslips; failure retains a retryable snapshot without payslips.

**Business Rules / Validation:**

- Only the explicit failed state is manually retryable. Retry never creates a second Payment Batch.

**Security / Authorization:**

- The retry endpoint is manager-only; all sync transitions and outcomes are audited.

**Related Implementation:**

- Frontend: `PaymentBatchDetailsPage.jsx`, `PaymentBatchesPage.jsx`
- Backend: automatic sync via `POST /api/payments/generate`; `POST /api/payments/:batchId/retry-hrms`; `hrmsSyncService.js`, `hrmsAdapter.js`

### UC-005.10 — Cancel an Eligible Payment Batch

**Primary Actor:** Payroll Manager  
**Trigger:** The manager enters a reason and confirms cancellation.  
**Preconditions:** The batch exists and is in `generated` or `hrms_sync_failed`.  
**Main Flow:**

1. The manager supplies a cancellation reason.
2. The backend soft-cancels the batch and stores actor, time, and reason.
3. It records `PAYMENT_BATCH_CANCELLED` and returns the updated state.
4. The UI disables payment-file download; the approved, locked period remains available for replacement generation.

**Alternative / Exception Flows:**

- A reason shorter than 5 or longer than 500 characters is rejected.
- Completed, pending, already-cancelled, or other ineligible states return `INVALID_CANCELLATION`.
- A nonexistent batch or invalid ID is rejected; API/network failure leaves the prior state unchanged from the UI's perspective.

**Postconditions:**

- The financial record remains stored with `cancelled` status and cannot be downloaded or synced.

**Business Rules / Validation:**

- Cancellation is a soft state change, not deletion. It does not change the approved/locked pay period and does not count as an active duplicate.

**Security / Authorization:**

- Cancellation is manager-only and is attributable through stored and audited actor data.

**Related Implementation:**

- Frontend: `PaymentBatchDetailsPage.jsx`
- Backend: `PATCH /api/payments/:batchId/cancel`; `paymentFileService.js`

### UC-005.11 — Generate Payslips Automatically

**Primary Actor:** Payroll Automation System  
**Trigger:** HRMS sync succeeds.  
**Preconditions:** The Payment Batch and pay period exist and the batch contains snapshot items.  
**Main Flow:**

1. For every Payment Batch item, the system constructs a payslip snapshot with company, employee, period, earnings, deductions, net pay, and batch references.
2. It inserts the payslips in the same transaction that completes the batch and marks the period paid.
3. Duplicate inserts are ignored, supporting safe repeat execution.
4. It records `PAYSLIP_GENERATION` for each resulting payslip.

**Alternative / Exception Flows:**

- Missing Payment Batch returns `PAYMENT_BATCH_NOT_FOUND`; a missing related period returns `PAY_PERIOD_NOT_FOUND`.
- An empty batch creates no payslip rows.
- Failed HRMS sync creates no payslips.

**Postconditions:**

- One immutable payslip snapshot exists per Payment Batch payroll item/line for the successful batch.

**Business Rules / Validation:**

- Payslips use the Payment Batch snapshot, not mutable live payroll or bank values.

**Security / Authorization:**

- Generation is internal to the protected HRMS completion flow and is fully audited.

**Related Implementation:**

- Frontend: payslips become available in `PayslipsPage.jsx`
- Backend: `payslipService.generateForBatch`, called by `hrmsSyncService.js`

### UC-005.12 — Manager View Payslip List

**Primary Actor:** Payroll Manager  
**Trigger:** The manager opens Payslips or selects View Payslips from a Payment Batch.  
**Preconditions:** The manager is authenticated; payslips have been generated for non-empty results.  
**Main Flow:**

1. The backend returns all payslips newest first, or payslips for a selected Payment Batch.
2. The UI can constrain rows to a batch and search/filter by employee, period, and status, then paginate the result.
3. Each row includes payment status/method, currency, masked account details, and earnings/deductions derived from the snapshot.
4. The view is recorded as `PAYSLIP_VIEW`.

**Alternative / Exception Flows:**

- A nonexistent batch returns `PAYMENT_BATCH_NOT_FOUND`.
- No payslips or no filter matches produces an empty state.
- API/network failure provides an error and retry action.

**Postconditions:**

- No payslip is modified; the manager can open details or download a PDF.

**Business Rules / Validation:**

- Batch-specific results are ordered by employee name; the all-payslip result is newest first.

**Security / Authorization:**

- All-payslip and batch-payslip lists are manager-only; employee access returns `FORBIDDEN` on the manager list.

**Related Implementation:**

- Frontend: `PayslipsPage.jsx`, `PaymentBatchDetailsPage.jsx`, `payslipApi.js`, `paymentApi.js`
- Backend: `GET /api/payslips`, `GET /api/payments/:batchId/payslips`; `payslipService.js`

### UC-005.13 — Manager View Payslip Details

**Primary Actor:** Payroll Manager  
**Trigger:** The manager selects a payslip.  
**Preconditions:** The payslip ID is a valid UUID and the payslip exists.  
**Main Flow:**

1. The backend loads the payslip with its Payment Batch and matching Payment Batch item.
2. It returns employee and period data, snapshot earnings/deductions, totals, net pay, payment method/status, and masked bank data.
3. The UI shows the preview/details and makes PDF download available.
4. The system records `PAYSLIP_VIEW`.

**Alternative / Exception Flows:**

- Invalid IDs are rejected; an unknown ID returns `PAYSLIP_NOT_FOUND`.
- API/network failure displays a retryable error.

**Postconditions:**

- No payslip is changed.

**Business Rules / Validation:**

- The Payment Batch item join matches both `payroll_line_id` and `payment_batch_id`, preventing duplication after a cancelled batch is regenerated.

**Security / Authorization:**

- Managers may view any payslip; bank accounts remain masked.

**Related Implementation:**

- Frontend: `PayslipsPage.jsx`, `PayslipDetailsPage.jsx`
- Backend: `GET /api/payslips/:payslipId`; `payslipService.js`

### UC-005.14 — Employee View Own Payslips

**Primary Actor:** Employee  
**Trigger:** The employee signs in or opens My Payslips.  
**Preconditions:** The employee is authenticated and their `user_account` is linked to a staff record.  
**Main Flow:**

1. The frontend calls the own-payslip endpoint for an employee account.
2. The backend filters `payslip.staff_id` by the JWT-derived `staffId`.
3. The employee searches/filters the returned own-payslip list and opens a payslip.
4. The backend rechecks ownership for the selected payslip and records `PAYSLIP_VIEW`.

**Alternative / Exception Flows:**

- An employee account without a linked staff record receives `PAYSLIP_ACCESS_DENIED`.
- A missing payslip returns `PAYSLIP_NOT_FOUND`; invalid IDs are rejected.
- No results or API/network failure is shown without exposing other employees' data.

**Postconditions:**

- The employee sees only their own payslip snapshots; no payroll data changes.

**Business Rules / Validation:**

- Ownership is determined by the authenticated account's server-loaded `staffId`, not a client-supplied staff ID.

**Security / Authorization:**

- The backend filters lists and enforces ownership again on detail access. Employees cannot call the all-payslip endpoint.

**Related Implementation:**

- Frontend: `PayslipsPage.jsx`, `PayslipDetailsPage.jsx`, `ProfilePage.jsx`, `payslipApi.js`
- Backend: `GET /api/payslips/me`, `GET /api/payslips/:payslipId`; `payslipService.js`, `authenticate.js`

### UC-005.15 — Prevent Cross-Employee Payslip Access

**Primary Actor:** Employee  
**Trigger:** An employee requests a payslip ID belonging to another staff member.  
**Preconditions:** The requester has a valid employee session; the requested payslip exists.  
**Main Flow:**

1. The backend loads the requested payslip.
2. It compares `payslip.staff_id` with the authenticated user's server-loaded `staffId`.
3. A mismatch is rejected with `PAYSLIP_ACCESS_DENIED` before payslip data or a PDF is returned.

**Alternative / Exception Flows:**

- An invalid token is rejected before lookup; an invalid UUID is rejected by validation.
- A nonexistent payslip returns `PAYSLIP_NOT_FOUND`.
- A manager is allowed to access any payslip.

**Postconditions:**

- No cross-employee payslip content is disclosed and no record is modified.

**Business Rules / Validation:**

- The same access assertion protects detail and PDF download because PDF creation first calls the protected payslip lookup.

**Security / Authorization:**

- Authorization is enforced server-side; frontend routing is only an additional usability control.

**Related Implementation:**

- Frontend: `ProtectedRoute.jsx`, `RoleRoute.jsx`, `PayslipsPage.jsx`
- Backend: `GET /api/payslips/:payslipId`, `GET /api/payslips/:payslipId/pdf`; `payslipService.assertAccess`

### UC-005.16 — Download Payslip PDF

**Primary Actor:** Payroll Manager or Employee  
**Trigger:** An authorized user chooses Download PDF.  
**Preconditions:** The payslip exists; an employee requester owns it.  
**Main Flow:**

1. The backend performs the same manager/owner access check used for payslip details.
2. It creates an A4 PDF from the immutable payslip snapshot, including references, employee data, masked payment data, earnings, deductions, and net pay.
3. It records `PAYSLIP_DOWNLOAD` and returns an `application/pdf` attachment.
4. The frontend saves the file using the payslip reference.

**Alternative / Exception Flows:**

- Missing/invalid JWT, cross-employee access, invalid ID, or missing payslip is rejected before download.
- PDF generation or API/network failure is displayed and no successful-download notice is shown.

**Postconditions:**

- An authorized user receives the PDF; payslip data remains unchanged and the download is audited.

**Business Rules / Validation:**

- The PDF uses application/company display data and masks the bank account; it does not expose the raw account number.

**Security / Authorization:**

- The endpoint is authenticated and applies employee ownership enforcement; managers may download any payslip.

**Related Implementation:**

- Frontend: `PayslipsPage.jsx`, `PayslipDetailsPage.jsx`, `payslipApi.js`
- Backend: `GET /api/payslips/:payslipId/pdf`; `payslipService.js`

### UC-005.17 — Record and View Audit Events

**Primary Actor:** Payroll Manager (view); Payroll Automation System (record)  
**Trigger:** An audited authentication, readiness, bank, Payment Batch, HRMS, payslip, or download action occurs, or a manager requests audit history/details.  
**Preconditions:** Recording has an action and entity context; viewing requires an authenticated manager.  
**Main Flow:**

1. Services record the actor when available, action, entity type/ID, IP address, timestamp, and safe contextual details.
2. UC-005 records login outcomes, logout, readiness failure, bank update, Payment Batch generation/cancellation/file download, HRMS start/success/failure/retry, payslip generation/view/download.
3. A manager can request audit events newest first with limit/offset pagination and open an event by valid UUID.

**Alternative / Exception Flows:**

- Login failure may be recorded without a user ID when the email is unknown.
- Audit recording failures attached to readiness-error reporting are intentionally swallowed so the original business error remains the response.
- A nonexistent audit ID returns `AUDIT_LOG_NOT_FOUND`; invalid IDs are rejected.

**Postconditions:**

- Audit evidence exists for successfully recorded activities; viewing does not alter it.

**Business Rules / Validation:**

- List limit defaults to 50 and is capped at 100. Bank-update audit details name updated fields but omit raw account values.

**Security / Authorization:**

- Audit list/detail routes are manager-only. Audit payloads deliberately avoid storing passwords, tokens, or full bank account numbers in UC-005 details.

**Related Implementation:**

- Frontend: no dedicated audit-log page is implemented in the inspected UC-005 frontend
- Backend: `GET /api/audit-logs`, `GET /api/audit-logs/:id`; `auditController.js`, `auditService.js` and UC-005 services

## 4. Enhanced Capabilities

- Multi-condition payment readiness validation against the approved canonical run.
- Manager/employee role-based access control plus server-side payslip ownership enforcement.
- Transactional duplicate prevention and replacement generation after soft cancellation.
- Immutable `payment_batch_item` and `payslip` snapshots of approved values.
- Reproducible CSV/GIRO output with file size and SHA-256 metadata.
- Automatic mock HRMS sync, retained-failure retry, and explicit cancellation workflow.
- Automatic, idempotent payslip creation after successful sync and protected PDF generation.
- Bank-account masking in detail, payslip, and update responses; safe bank-update audit data.
- Payment Batch search/filter/pagination and dashboard statistics, plus client-side payslip filtering.
- Audited authentication, readiness failures, financial actions, integrations, views, and downloads.
- State-specific errors and UI retry/error handling for validation, authorization, API, and network failures.

## Cross-UC Dependencies

UC-005 depends on earlier payroll processing only through the canonical input state:

- A `calculation_runs` record exists for the period.
- Its selected `payroll_lines` exist, belong to that run and period, are complete, and have positive approved net pay.
- An approved `approval` exists with `approval.calculation_run_id` pointing to that run.
- The pay period is `approved` and locked.

UC-005 does not recreate calculation, exception resolution, or approval workflows. It consumes their final integrated output and, after successful payment processing, changes the period to `paid`.

## Traceability Summary

| Use Case | Frontend | Backend | Main Entities |
| --- | --- | --- | --- |
| UC-005.1 Supporting Authentication: Manager Login | `LoginPage.jsx`, `AuthContext.jsx` | `POST /api/auth/login`; `authService.js` | `user_account`, `audit_log` |
| UC-005.2 Preview and Readiness | `PaymentPreviewPage.jsx`, `PaymentBatchesPage.jsx` | `GET /api/payments/eligible-periods`, `/preview`; `paymentReadinessService.js` | `pay_period`, `calculation_runs`, `payroll_lines`, `approval`, `staff`, `payment_batch` |
| UC-005.3 Review Employees | `PaymentPreviewPage.jsx`, `ReviewEmployeesPage.jsx` | `GET /api/payments/preview`; `paymentReadinessService.js` | `payroll_lines`, `staff` |
| UC-005.4 Update Bank Details | `PaymentPreviewPage.jsx`, `ReviewEmployeesPage.jsx` | `PATCH /api/staff/:staffId/bank-details`; `staffBankService.js` | `staff`, `audit_log` |
| UC-005.5 Generate / Duplicate Prevention | `PaymentBatchesPage.jsx` | `POST /api/payments/generate`; `paymentFileService.js`, `paymentReadinessService.js` | `payment_batch`, `payment_batch_item`, `pay_period`, `approval`, `payroll_lines` |
| UC-005.6 List / Search / Statistics | `PaymentBatchesPage.jsx` | `GET /api/payments`, `/dashboard/statistics`; `paymentFileService.js` | `payment_batch`, `pay_period`, `user_account`, `staff` |
| UC-005.7 Batch Details | `PaymentBatchDetailsPage.jsx` | `GET /api/payments/:batchId`; `paymentFileService.js` | `payment_batch`, `payment_batch_item`, `pay_period`, `user_account` |
| UC-005.8 CSV/GIRO Download | `PaymentBatchesPage.jsx`, `PaymentBatchDetailsPage.jsx` | `GET /api/payments/:batchId/file`; `paymentFileService.js` | `payment_batch`, `payment_batch_item`, `audit_log` |
| UC-005.9 HRMS Sync / Retry | `PaymentBatchDetailsPage.jsx` | generate flow, `POST /api/payments/:batchId/retry-hrms`; `hrmsSyncService.js` | `payment_batch`, `payment_batch_item`, `pay_period`, `payslip`, `audit_log` |
| UC-005.10 Cancel Batch | `PaymentBatchDetailsPage.jsx` | `PATCH /api/payments/:batchId/cancel`; `paymentFileService.js` | `payment_batch`, `audit_log` |
| UC-005.11 Generate Payslips | `PayslipsPage.jsx` | `payslipService.generateForBatch` | `payslip`, `payment_batch`, `payment_batch_item`, `pay_period`, `audit_log` |
| UC-005.12 Manager Payslip List | `PayslipsPage.jsx` | `GET /api/payslips`, `/api/payments/:batchId/payslips`; `payslipService.js` | `payslip`, `payment_batch`, `payment_batch_item`, `staff`, `audit_log` |
| UC-005.13 Manager Payslip Details | `PayslipsPage.jsx`, `PayslipDetailsPage.jsx` | `GET /api/payslips/:payslipId`; `payslipService.js` | `payslip`, `payment_batch`, `payment_batch_item`, `audit_log` |
| UC-005.14 Employee Own Payslips | `PayslipsPage.jsx`, `PayslipDetailsPage.jsx` | `GET /api/payslips/me`, `/:payslipId`; `payslipService.js` | `user_account`, `staff`, `payslip`, `audit_log` |
| UC-005.15 Ownership Enforcement | `ProtectedRoute.jsx`, `RoleRoute.jsx` | payslip detail/PDF routes; `payslipService.assertAccess` | `user_account`, `payslip` |
| UC-005.16 Payslip PDF | `PayslipsPage.jsx`, `PayslipDetailsPage.jsx` | `GET /api/payslips/:payslipId/pdf`; `payslipService.js` | `payslip`, `payment_batch_item`, `audit_log` |
| UC-005.17 Audit Events | No dedicated frontend page | `GET /api/audit-logs`, `/:id`; `auditController.js`, `auditService.js` | `audit_log`, `user_account` |

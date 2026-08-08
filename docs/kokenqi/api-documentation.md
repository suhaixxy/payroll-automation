# UC-005 — API Documentation

## 1. API Overview

The backend mounts application routes under `/api`. The frontend Axios client uses `${VITE_BACKEND_URL || VITE_API_URL || "http://localhost:5000"}/api`, attaches a stored JWT as `Authorization: Bearer <token>`, and has a 15-second timeout.

UC-005 exposes authentication, payment readiness, Payment Batches, mock HRMS synchronization, staff bank-detail correction, payslips, protected CSV/PDF downloads, and audit-log reads. Success bodies use the endpoint-specific shapes documented below; UC-005 controllers do not uniformly wrap successes in the shared `success/data` helper.

Application errors handled by the global error middleware use this exact envelope:

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_BATCH_NOT_FOUND",
    "message": "Payment batch not found.",
    "details": []
  }
}
```

The current global handler always emits `details: []`. The login rate limiter is an exception: its 429 response is `{ "error": "TOO_MANY_LOGIN_ATTEMPTS", "message": "...", "details": [] }` without `success` and without a nested error object.

## 2. Authentication / Authorization

- `POST /api/auth/login` is public. It returns a signed JWT for an active `user_account` after password verification.
- Protected calls use `Authorization: Bearer <accessToken>`.
- A missing or malformed Bearer header returns 401 `AUTHENTICATION_REQUIRED`.
- An invalid or expired JWT, a missing token subject, or an account that is no longer active returns 401 `INVALID_TOKEN`.
- A disabled account attempting login returns 403 `ACCOUNT_DISABLED`.
- All `/api/payments/*`, the UC-005 bank-update route, and `/api/audit-logs/*` require role `manager`.
- `GET /api/payslips` is manager-only. The other payslip routes require authentication; employees are restricted to payslips whose `staff_id` matches the server-loaded `user_account.staff_id`.
- Role failures return 403 `FORBIDDEN`. Payslip ownership/linkage failures return 403 `PAYSLIP_ACCESS_DENIED`.
- The frontend clears its stored token and emits `payroll:unauthorized` when a protected request returns 401.

## 3. Endpoint Reference

### Authentication

### `POST /api/auth/login`

**Purpose:** Authenticate an active manager or employee and issue a JWT.  
**Authentication:** None.  
**Authorization:** Public.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** `email` (required string, normalized lowercase, valid email, maximum 255 characters); `password` (required string, 8–100 characters). Unknown fields are stripped.  
**Success Response:** 200 JSON: `{ accessToken, user: { id, fullName, email, role, staffId } }`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_DISABLED`; 429 `TOO_MANY_LOGIN_ATTEMPTS`; 500 `AUTH_CONFIGURATION_ERROR` or `INTERNAL_ERROR`.  
**Used By:** `LoginPage.jsx` through `authApi.login`.

### `GET /api/auth/me`

**Purpose:** Restore or inspect the authenticated user profile.  
**Authentication:** Bearer JWT.  
**Authorization:** Any active authenticated user.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ user: { id, fullName, email, role, staffId } }`.  
**Possible Errors:** 401 `AUTHENTICATION_REQUIRED` or `INVALID_TOKEN`; 500 `AUTH_CONFIGURATION_ERROR` or `INTERNAL_ERROR`.  
**Used By:** `AuthContext.jsx` through `authApi.getCurrentUser`.

### `POST /api/auth/logout`

**Purpose:** Record logout audit activity for the current user.  
**Authentication:** Bearer JWT.  
**Authorization:** Any active authenticated user.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ "message": "Logged out successfully." }`.  
**Possible Errors:** 401 `AUTHENTICATION_REQUIRED` or `INVALID_TOKEN`; 500 `AUTH_CONFIGURATION_ERROR` or `INTERNAL_ERROR`.  
**Used By:** Authenticated application shell through `authApi.logout`.

### Payment Readiness / Preview

### `GET /api/payments/eligible-periods`

**Purpose:** List approved, locked pay periods and flag whether each has a non-cancelled Payment Batch.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ rows: [{ id, startDate, endDate, status, isLocked, hasActivePaymentBatch }] }`.  
**Possible Errors:** 401 authentication errors; 403 `FORBIDDEN`; 500 `INTERNAL_ERROR`.  
**Used By:** `PaymentPreviewPage.jsx` and the generation dialog in `PaymentBatchesPage.jsx`.

### `GET /api/payments/preview`

**Purpose:** Validate a period and return its employee-level payment readiness without rejecting missing/invalid bank details.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** None.  
**Query Parameters:** `payPeriodId` (required database UUID).  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ ready, payPeriod, employeeCount, totalAmount, employees }`; employee fields are shown in Section 4.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `PAY_PERIOD_NOT_FOUND`; 409 `DUPLICATE_PAYMENT_BATCH`, `PERIOD_NOT_APPROVED`, `PERIOD_NOT_LOCKED`, `APPROVAL_RECORD_MISSING`, `PAYROLL_LINES_MISSING`, `INCOMPLETE_PAYROLL_LINE`, or `INVALID_NET_PAY`; 500 `INTERNAL_ERROR`.  
**Used By:** `PaymentPreviewPage.jsx`, `ReviewEmployeesPage.jsx`, and `PaymentBatchesPage.jsx`.

### Payment Batches

### `GET /api/payments/dashboard/statistics`

**Purpose:** Return Payment Batch and dashboard summary statistics.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ totalBatches, byStatus, completedTotalAmount, summary: { activeStaff, currentPayPeriod, currentYearBatchCount, pendingApprovals } }`; `currentPayPeriod` is `null` or `{ id, startDate, endDate, status }`.  
**Possible Errors:** 401 authentication errors; 403 `FORBIDDEN`; 500 `INTERNAL_ERROR`.  
**Used By:** `paymentApi.getPaymentStatistics`; the inspected UC-005 pages do not directly call this helper.

### `POST /api/payments/generate`

**Purpose:** Create a Payment Batch and immutable `payment_batch_item` snapshots, then automatically invoke mock HRMS sync.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** `{ "payPeriodId": "<database UUID>" }`; required, with unknown fields stripped.  
**Success Response:** 201 JSON: `{ message, data }`, where `data` is the serialized Payment Batch.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `PAY_PERIOD_NOT_FOUND`; 409 `DUPLICATE_PAYMENT_BATCH`, `PERIOD_NOT_APPROVED`, `PERIOD_NOT_LOCKED`, `APPROVAL_RECORD_MISSING`, `PAYROLL_LINES_MISSING`, `INCOMPLETE_PAYROLL_LINE`, or `INVALID_NET_PAY`; 424 `MISSING_BANK_DETAILS` or `INVALID_BANK_DETAILS`; 502 `HRMS_SYNC_FAILURE`; 500 `INTERNAL_ERROR`.  
**Used By:** generation dialog in `PaymentBatchesPage.jsx`.

### `GET /api/payments`

**Purpose:** List Payment Batches newest first with server-side search, status filtering, and offset pagination.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** None.  
**Query Parameters:** `status` optional enum (`generating`, `generated`, `hrms_sync_pending`, `hrms_sync_failed`, `completed`, `cancelled`); `search` optional trimmed string up to 100 characters, matching batch or HRMS reference case-insensitively; `limit` optional integer 1–100, default 25; `offset` optional non-negative integer, default 0. Unknown query keys are stripped.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ count, rows: [<serialized Payment Batch>] }`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 500 `INTERNAL_ERROR`.  
**Used By:** `PaymentBatchesPage.jsx` through `paymentApi.getPaymentBatches`.

### `GET /api/payments/:batchId`

**Purpose:** Return Payment Batch details, snapshot items, and generated file metadata.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** `batchId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 serialized Payment Batch plus `paymentFile` (`null` or `{ fileName, mimeType, sizeBytes, checksumSha256 }`) and `items`. Item fields are `{ id, staffId, employeeReference, employeeName, bankCode, bankAccountNumber, grossPay, incentivePay, cpfAmount, sdlAmount, netPay, paymentReference }`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `PAYMENT_BATCH_NOT_FOUND`; 500 `INTERNAL_ERROR`.  
**Used By:** `PaymentBatchDetailsPage.jsx`.

### `GET /api/payments/:batchId/file`

**Purpose:** Generate and download the stored Payment Batch snapshot as a CSV/GIRO payment file.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** `batchId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 CSV bytes; `Content-Type: text/csv; charset=utf-8`; attachment filename generated by the GIRO formatter and beginning `Payroll_PAY-`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `PAYMENT_BATCH_NOT_FOUND`; 409 `PAYMENT_BATCH_CANCELLED` or `PAYMENT_FILE_EMPTY`; 500 `INTERNAL_ERROR`.  
**Used By:** `PaymentBatchesPage.jsx` and `PaymentBatchDetailsPage.jsx`.

### HRMS Sync / Retry / Cancellation

### `POST /api/payments/:batchId/retry-hrms`

**Purpose:** Retry mock HRMS synchronization using a retained failed Payment Batch without regenerating it.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** `batchId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** None; the frontend sends an empty body.  
**Success Response:** 200 JSON: `{ "message": "HRMS synchronisation completed.", "data": <serialized Payment Batch> }`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `PAYMENT_BATCH_NOT_FOUND`; 409 `INVALID_HRMS_RETRY`; 502 `HRMS_SYNC_FAILURE`; 500 `INTERNAL_ERROR`.  
**Used By:** `PaymentBatchDetailsPage.jsx`.

### `PATCH /api/payments/:batchId/cancel`

**Purpose:** Soft-cancel a generated or HRMS-failed Payment Batch.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** `batchId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** `{ "reason": "..." }`; required trimmed string, 5–500 characters, unknown fields stripped.  
**Success Response:** 200 JSON: `{ "message": "Payment batch cancelled.", "data": <serialized Payment Batch> }`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `PAYMENT_BATCH_NOT_FOUND`; 409 `INVALID_CANCELLATION`; 500 `INTERNAL_ERROR`.  
**Used By:** `PaymentBatchDetailsPage.jsx`.

### Staff Bank Details

### `PATCH /api/staff/:staffId/bank-details`

**Purpose:** Correct the staff bank details used by payment readiness.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** `staffId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** `bankCode` (required, 3–20 alphanumeric/hyphen characters); `bankAccountNumber` (required, 5–50 alphanumeric/hyphen characters). Unknown fields are stripped.  
**Success Response:** 200 JSON: `{ "message": "Bank details updated.", "data": { id, employeeReference, employeeName, bankCode, bankAccountNumber } }`; the returned account number is masked.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `STAFF_NOT_FOUND`; 500 `INTERNAL_ERROR`.  
**Used By:** bank dialogs in `PaymentPreviewPage.jsx` and `ReviewEmployeesPage.jsx`.

### Payslips

### `GET /api/payments/:batchId/payslips`

**Purpose:** List payslips for one Payment Batch, ordered by employee name.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only because the route is inside the manager-protected payments router.  
**Path Parameters:** `batchId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ rows: [<serialized payslip>] }`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `PAYMENT_BATCH_NOT_FOUND`; 500 `INTERNAL_ERROR`.  
**Used By:** exposed as `paymentApi.getBatchPayslips`; `PaymentBatchDetailsPage.jsx` instead navigates to `PayslipsPage.jsx?batchId=...`, where the loaded all-payslip result is filtered client-side.

### `GET /api/payslips/me`

**Purpose:** List only the authenticated account's staff-linked payslips, newest first.  
**Authentication:** Bearer JWT.  
**Authorization:** Any authenticated account with a linked `staffId`; intended employee endpoint.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ rows: [<serialized payslip>] }`.  
**Possible Errors:** 401 authentication errors; 403 `PAYSLIP_ACCESS_DENIED` when no staff record is linked; 500 `INTERNAL_ERROR`.  
**Used By:** employee mode of `PayslipsPage.jsx`.

### `GET /api/payslips`

**Purpose:** List all generated payslips, newest first.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** None.  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ rows: [<serialized payslip>] }`.  
**Possible Errors:** 401 authentication errors; 403 `FORBIDDEN`; 500 `INTERNAL_ERROR`.  
**Used By:** manager mode of `PayslipsPage.jsx`.

### `GET /api/payslips/:payslipId`

**Purpose:** Return one serialized payslip.  
**Authentication:** Bearer JWT.  
**Authorization:** Managers may access any payslip; an employee may access only a payslip whose `staffId` matches their authenticated account.  
**Path Parameters:** `payslipId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 serialized payslip; fields are listed in Section 4.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `PAYSLIP_ACCESS_DENIED`; 404 `PAYSLIP_NOT_FOUND`; 500 `INTERNAL_ERROR`.  
**Used By:** `PayslipsPage.jsx` preview and `PayslipDetailsPage.jsx`.

### `GET /api/payslips/:payslipId/pdf`

**Purpose:** Generate a protected PDF from the payslip snapshot.  
**Authentication:** Bearer JWT.  
**Authorization:** Managers may download any payslip; employees may download only their own.  
**Path Parameters:** `payslipId` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 PDF bytes; `Content-Type: application/pdf`; `Content-Disposition: attachment; filename="<payslipReference>.pdf"`.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `PAYSLIP_ACCESS_DENIED`; 404 `PAYSLIP_NOT_FOUND`; 500 `INTERNAL_ERROR`.  
**Used By:** `PayslipsPage.jsx` and `PayslipDetailsPage.jsx`.

### Audit Logs

### `GET /api/audit-logs`

**Purpose:** List audit records newest first.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** None.  
**Query Parameters:** `limit` optional; converted with `Number`, defaults to 50, and is capped at 100. `offset` optional; converted with `Number` and defaults to 0. This route has no Yup query validator.  
**Request Body:** None.  
**Success Response:** 200 JSON: `{ count, rows }`, where rows are serialized `audit_log` model records.  
**Possible Errors:** 401 authentication errors; 403 `FORBIDDEN`; invalid database pagination input or other failures reach 500 `INTERNAL_ERROR`.  
**Used By:** No inspected UC-005 frontend page calls this implemented API.

### `GET /api/audit-logs/:id`

**Purpose:** Return one audit record.  
**Authentication:** Bearer JWT.  
**Authorization:** Manager only.  
**Path Parameters:** `id` (required database UUID).  
**Query Parameters:** None.  
**Request Body:** None.  
**Success Response:** 200 serialized `audit_log` model record.  
**Possible Errors:** 400 `VALIDATION_ERROR`; 401 authentication errors; 403 `FORBIDDEN`; 404 `AUDIT_LOG_NOT_FOUND`; 500 `INTERNAL_ERROR`.  
**Used By:** No inspected UC-005 frontend page calls this implemented API.

## 4. Request / Response Examples

UUIDs, references, timestamps, and the token below are illustrative values; field names, types, nesting, status, and masking follow the implemented serializers.

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "manager@payroll.local",
  "password": "Manager123!"
}
```

```json
{
  "accessToken": "<signed JWT>",
  "user": {
    "id": "81000000-0000-0000-0000-000000000002",
    "fullName": "Payroll Manager",
    "email": "manager@payroll.local",
    "role": "manager",
    "staffId": null
  }
}
```

### Payment Preview / Readiness

```http
GET /api/payments/preview?payPeriodId=93000000-0000-4000-8000-000000000001
Authorization: Bearer <token>
```

```json
{
  "ready": true,
  "payPeriod": {
    "id": "93000000-0000-4000-8000-000000000001",
    "startDate": "2026-09-01",
    "endDate": "2026-09-15",
    "status": "approved",
    "isLocked": true
  },
  "employeeCount": 1,
  "totalAmount": "1325.00",
  "employees": [
    {
      "staffId": "11111111-1111-1111-1111-111111111111",
      "employeeReference": "S001",
      "employeeName": "Test Employee",
      "bankCode": "7339",
      "bankAccountNumber": "XXXX6789",
      "grossPay": "1500.00",
      "incentivePay": "75.00",
      "cpfAmount": "200.00",
      "sdlAmount": "10.00",
      "approvedNetPay": "1325.00",
      "bankValidationStatus": "ready",
      "bankValidationReason": null,
      "missingFields": []
    }
  ]
}
```

For missing bank data, preview still returns 200 with `ready: false`, `bankValidationStatus: "missing"`, a reason, and `missingFields` containing `bankCode` and/or `bankAccountNumber`. Generation then returns 424 `MISSING_BANK_DETAILS`.

### Generate Payment Batch

```json
{
  "payPeriodId": "93000000-0000-4000-8000-000000000001"
}
```

Successful automatic HRMS synchronization returns 201:

```json
{
  "message": "Payment batch generated and synchronised successfully.",
  "data": {
    "id": "94000000-0000-4000-8000-000000000001",
    "payPeriodId": "93000000-0000-4000-8000-000000000001",
    "batchReference": "PAY-20260915020000-ABC123",
    "fileFormat": "giro",
    "paymentType": "GIRO",
    "currency": "SGD",
    "employeeCount": 1,
    "totalAmount": "1325.00",
    "status": "completed",
    "hrmsSyncStatus": "completed",
    "hrmsReference": "HRMS-A1B2C3D4E5F6",
    "hrmsErrorMessage": null,
    "generatedAt": "2026-09-15T02:00:00.000Z",
    "hrmsSyncedAt": "2026-09-15T02:00:01.000Z",
    "cancelledAt": null,
    "cancellationReason": null,
    "createdAt": "2026-09-15T02:00:00.000Z",
    "payPeriod": {
      "id": "93000000-0000-4000-8000-000000000001",
      "startDate": "2026-09-01",
      "endDate": "2026-09-15",
      "status": "paid"
    },
    "generatedBy": {
      "id": "81000000-0000-0000-0000-000000000002",
      "fullName": "Payroll Manager"
    }
  }
}
```

The exact generated reference and timestamps vary. If mock HRMS fails, the call returns 502 while retaining the batch in `hrms_sync_failed`; there is no success body for that attempt.

### Payment Batch Details

The response contains every serialized Payment Batch field above plus:

```json
{
  "paymentFile": {
    "fileName": "Payroll_PAY-20260915020000-ABC123.csv",
    "mimeType": "text/csv; charset=utf-8",
    "sizeBytes": 241,
    "checksumSha256": "<64-character SHA-256 hex digest>"
  },
  "items": [
    {
      "id": "95000000-0000-4000-8000-000000000001",
      "staffId": "11111111-1111-1111-1111-111111111111",
      "employeeReference": "S001",
      "employeeName": "Test Employee",
      "bankCode": "7339",
      "bankAccountNumber": "XXXX6789",
      "grossPay": "1500.00",
      "incentivePay": "75.00",
      "cpfAmount": "200.00",
      "sdlAmount": "10.00",
      "netPay": "1325.00",
      "paymentReference": "PAY-20260915020000-ABC123-S001"
    }
  ]
}
```

`paymentFile` is `null` when the batch has no items.

### HRMS Retry

```http
POST /api/payments/94000000-0000-4000-8000-000000000001/retry-hrms
Authorization: Bearer <token>
```

```json
{
  "message": "HRMS synchronisation completed.",
  "data": {
    "id": "94000000-0000-4000-8000-000000000001",
    "status": "completed",
    "hrmsSyncStatus": "completed",
    "hrmsReference": "HRMS-A1B2C3D4E5F6"
  }
}
```

The actual `data` object contains the complete serialized Payment Batch field set shown in the generation example; the excerpt highlights retry state changes.

### Cancellation

```json
{
  "reason": "Manager cancelled failed batch"
}
```

```json
{
  "message": "Payment batch cancelled.",
  "data": {
    "id": "94000000-0000-4000-8000-000000000001",
    "status": "cancelled",
    "hrmsSyncStatus": "failed",
    "cancelledAt": "2026-09-15T02:10:00.000Z",
    "cancellationReason": "Manager cancelled failed batch"
  }
}
```

The actual `data` object contains the complete serialized Payment Batch field set.

### Bank-Detail Update

```json
{
  "bankCode": "7339",
  "bankAccountNumber": "9988776655"
}
```

```json
{
  "message": "Bank details updated.",
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "employeeReference": "S001",
    "employeeName": "Test Employee",
    "bankCode": "7339",
    "bankAccountNumber": "XXXX6655"
  }
}
```

### Payslip List and Detail

List endpoints wrap serialized payslips in `rows`. A detail endpoint returns the serialized object directly:

```json
{
  "id": "96000000-0000-4000-8000-000000000001",
  "paymentBatchId": "94000000-0000-4000-8000-000000000001",
  "payPeriodId": "93000000-0000-4000-8000-000000000001",
  "payrollLineId": "93000000-0000-4000-8000-000000000002",
  "staffId": "11111111-1111-1111-1111-111111111111",
  "payslipReference": "PS-PAY-20260915020000-ABC123-95000000",
  "companyName": "Emergencies First Aid & Rescue",
  "employeeReference": "S001",
  "employeeName": "Test Employee",
  "payPeriodStart": "2026-09-01",
  "payPeriodEnd": "2026-09-15",
  "grossPay": "1500.00",
  "incentivePay": "75.00",
  "cpfAmount": "200.00",
  "sdlAmount": "10.00",
  "otherDeduction": "0.00",
  "netPay": "1325.00",
  "batchReference": "PAY-20260915020000-ABC123",
  "generatedAt": "2026-09-15T02:00:01.000Z",
  "status": "completed",
  "bank": "7339",
  "bankAccountNumber": "XXXX6789",
  "paymentMethod": "GIRO",
  "currency": "SGD",
  "earnings": [
    { "code": "gross_pay", "description": "Gross Pay", "amount": "1500.00" },
    { "code": "incentive_pay", "description": "Incentive Pay", "amount": "75.00" }
  ],
  "deductions": [
    { "code": "cpf", "description": "CPF", "amount": "200.00" },
    { "code": "sdl", "description": "SDL", "amount": "10.00" }
  ],
  "totalEarnings": "1575.00",
  "totalDeductions": "210.00"
}
```

Zero-valued earning/deduction entries are omitted. `payPeriodId`, status, bank fields, or payment method can be `null` when their optional associations/data are absent.

## Error Codes

The following 29 codes/shapes are verified in UC-005 middleware, services, controllers, or route configuration.

| Code | HTTP | Meaning | Endpoint(s) |
| --- | ---: | --- | --- |
| `VALIDATION_ERROR` | 400 | Body, query, or UUID validation failed. | Validated login, preview, generation, Payment Batch path/list, cancellation, bank, payslip-ID, audit-ID routes |
| `AUTHENTICATION_REQUIRED` | 401 | Bearer header/token is missing or malformed. | All protected endpoints |
| `INVALID_TOKEN` | 401 | JWT is invalid/expired or its account is absent/inactive. | All protected endpoints |
| `INVALID_CREDENTIALS` | 401 | Email/password combination is invalid; unknown email uses the same error. | Login |
| `FORBIDDEN` | 403 | Authenticated role is not allowed. | Manager-only payment, bank, all-payslip, and audit routes |
| `ACCOUNT_DISABLED` | 403 | Login account is disabled. | Login |
| `PAYSLIP_ACCESS_DENIED` | 403 | Account lacks a staff link, requests another employee's payslip, or fails service-level payslip access. | Own list, payslip detail/PDF; service guard for manager list |
| `PAY_PERIOD_NOT_FOUND` | 404 | Pay period is absent; also used internally if a batch's period disappeared during payslip generation. | Preview, generation; HRMS completion path |
| `PAYMENT_BATCH_NOT_FOUND` | 404 | Payment Batch does not exist. | Batch detail/file/payslip list/retry/cancel; HRMS flow |
| `STAFF_NOT_FOUND` | 404 | Staff record does not exist. | Bank-detail update |
| `PAYSLIP_NOT_FOUND` | 404 | Payslip does not exist. | Payslip detail/PDF |
| `AUDIT_LOG_NOT_FOUND` | 404 | Audit record does not exist. | Audit detail |
| `DUPLICATE_PAYMENT_BATCH` | 409 | A non-cancelled active Payment Batch already exists for the period. | Preview, generation |
| `PERIOD_NOT_APPROVED` | 409 | Pay period status is not `approved`. | Preview, generation |
| `PERIOD_NOT_LOCKED` | 409 | Approved period is not locked. | Preview, generation |
| `APPROVAL_RECORD_MISSING` | 409 | No approved approval linked by `approval.calculation_run_id`. | Preview, generation |
| `PAYROLL_LINES_MISSING` | 409 | No `payroll_lines` exist for the approved run and period. | Preview, generation |
| `INCOMPLETE_PAYROLL_LINE` | 409 | At least one selected payroll line is not `complete`. | Preview, generation |
| `INVALID_NET_PAY` | 409 | At least one approved net-pay amount is zero or negative. | Preview, generation |
| `PAYMENT_BATCH_CANCELLED` | 409 | Download attempted for a cancelled Payment Batch. | Payment file download |
| `PAYMENT_FILE_EMPTY` | 409 | Payment Batch contains no payment items. | Payment file download |
| `INVALID_HRMS_RETRY` | 409 | Manual retry requested when status is not `hrms_sync_failed`. | HRMS retry |
| `INVALID_CANCELLATION` | 409 | Cancellation requested outside `generated` or `hrms_sync_failed`. | Cancellation |
| `MISSING_BANK_DETAILS` | 424 | Generation blocked by absent required bank data. | Generation |
| `INVALID_BANK_DETAILS` | 424 | Generation blocked by bank data that fails format rules. | Generation |
| `HRMS_SYNC_FAILURE` | 502 | Mock HRMS rejected/failed; Payment Batch is retained for retry. | Generation, HRMS retry |
| `TOO_MANY_LOGIN_ATTEMPTS` | 429 | More than 10 login requests in the 15-minute limiter window. | Login; noncanonical top-level limiter body |
| `AUTH_CONFIGURATION_ERROR` | 500 | JWT secret is not configured. | Login and all authenticated endpoints |
| `INTERNAL_ERROR` | 500 | Unhandled failure fallback from the global handler. | Any endpoint reaching the handler without an application status/code |

`INVALID_PAYMENT_STATE` also exists as an internal HRMS service guard for synchronizing a cancelled batch, but no exposed UC-005 route calls `sync` on a cancelled batch: the retry endpoint rejects the state first as `INVALID_HRMS_RETRY`. It is therefore not counted as a currently reachable endpoint error contract.

## 6. Payment Readiness Rules

`GET /api/payments/preview` and `POST /api/payments/generate` validate the following server-side rules:

1. The pay period exists, has status `approved`, and is locked.
2. No Payment Batch in `generating`, `generated`, `hrms_sync_pending`, `hrms_sync_failed`, or `completed` already exists for the period. A cancelled batch does not block replacement generation.
3. An approved `approval` exists and contains `approval.calculation_run_id`.
4. `payroll_lines` exist for both that calculation run and period.
5. Every selected payroll line has `line_status: "complete"` and net pay greater than zero.
6. Every associated staff record has a bank code matching 3–20 alphanumeric/hyphen characters and account number matching 5–50 alphanumeric/hyphen characters.

Preview allows bank issues so the UI can show affected employees and returns `ready: false`. Generation does not: missing details return 424 `MISSING_BANK_DETAILS`, invalid formats return 424 `INVALID_BANK_DETAILS`, and the transaction creates no partial Payment Batch. Generation repeats readiness inside a serializable transaction and snapshots approved values into `payment_batch_item`.

There is no separate direct check of a `calculation_runs.status` field in `paymentReadinessService`; readiness is established through the approved run relationship and the completeness of its selected `payroll_lines`. This distinction is intentional documentation of the current API behavior.

## 7. File Download Endpoints

| Endpoint | Authentication / Authorization | Success Contract | Failure Contract |
| --- | --- | --- | --- |
| `GET /api/payments/:batchId/file` | Bearer JWT; manager only | 200 `text/csv; charset=utf-8`; attachment filename produced by `giroFileFormatter` and beginning `Payroll_PAY-` | Invalid UUID 400; unauthenticated 401; employee 403; missing batch 404; cancelled/empty batch 409 |
| `GET /api/payslips/:payslipId/pdf` | Bearer JWT; manager or owning employee | 200 `application/pdf`; attachment filename `<payslipReference>.pdf` | Invalid UUID 400; unauthenticated 401; non-owner 403; missing payslip 404 |

Both endpoints are requested as blobs by the frontend. Payment CSV generation uses immutable Payment Batch items and records `PAYMENT_FILE_DOWNLOAD`. PDF generation first performs the same ownership check as payslip detail, uses masked account data, and records `PAYSLIP_DOWNLOAD`.

## 8. Frontend-to-API Mapping

| Frontend Page | API Endpoint(s) | Purpose |
| --- | --- | --- |
| `LoginPage.jsx` | `POST /api/auth/login` | Authenticate and route by returned role |
| `PaymentPreviewPage.jsx` | `GET /api/payments/eligible-periods`; `GET /api/payments/preview`; `PATCH /api/staff/:staffId/bank-details` | Select period, inspect readiness, search/filter employees, correct bank data |
| `ReviewEmployeesPage.jsx` | `GET /api/payments/preview`; `PATCH /api/staff/:staffId/bank-details` | Review missing/invalid bank details and refresh after correction |
| `PaymentBatchesPage.jsx` | `GET /api/payments`; `GET /api/payments/eligible-periods`; `GET /api/payments/preview`; `POST /api/payments/generate`; `GET /api/payments/:batchId/file` | List/filter Payment Batches, validate and generate, download payment file |
| `PaymentBatchDetailsPage.jsx` | `GET /api/payments/:batchId`; `GET /api/payments/:batchId/file`; `POST /api/payments/:batchId/retry-hrms`; `PATCH /api/payments/:batchId/cancel` | Inspect snapshots/file metadata, download, retry, or cancel; navigates to batch-filtered payslip UI |
| `PayslipsPage.jsx` | Manager: `GET /api/payslips`; employee: `GET /api/payslips/me`; both: `GET /api/payslips/:payslipId`, `GET /api/payslips/:payslipId/pdf` | List/filter, preview, and download authorized payslips |
| `PayslipDetailsPage.jsx` | `GET /api/payslips/:payslipId`; `GET /api/payslips/:payslipId/pdf` | Show one authorized payslip and download its PDF |

`paymentApi.js` also implements `getPaymentStatistics` and `getBatchPayslips`, but the inspected pages do not directly invoke those helpers. The backend endpoints remain part of the implemented UC-005 API and are documented above.

## 9. Traceability to Tests

| API Group | Main Test File | Individual Evidence Mirror |
| --- | --- | --- |
| Authentication and token behavior | `backend/tests/auth.test.js` | `tests/kokenqi/auth.test.js` |
| Manager/employee authorization | `backend/tests/authorization.test.js` | `tests/kokenqi/authorization.test.js` |
| Readiness, Payment Batches, CSV, HRMS, cancellation, bank update | `backend/tests/payment.test.js` | `tests/kokenqi/payment.test.js` |
| Payslip generation, listing, ownership, details, PDF | `backend/tests/payslip.test.js` | `tests/kokenqi/payslip.test.js` |

The `tests/kokenqi` copies are individual evidence. This documentation does not claim they are included in the repository's active Jest configuration; that is determined by the current test runner configuration, not by their presence.

## 10. Important Implementation Notes

- HRMS synchronization uses the current mock adapter because no real external HRMS API is integrated. Generation invokes it automatically; only `hrms_sync_failed` batches can use manual retry.
- Payment Batches deliberately preserve that terminology in UI and API documentation.
- `payment_batch_item` rows are immutable payment snapshots copied from approved `payroll_lines`; CSV/GIRO output, HRMS payloads, and payslips consume those snapshots.
- Successful HRMS sync completes the Payment Batch, stores the HRMS reference, changes the approved period to `paid`, and generates payslips transactionally. Failure retains the Payment Batch and generates no payslips.
- Employee ownership is enforced in the backend from authenticated `user_account.staff_id`, not from a client-provided employee identifier.
- Account numbers returned in readiness, Payment Batch details, bank-update responses, and payslips are masked. Raw account values are required only in the authorized update request and stored snapshot/file processing paths.
- The global error envelope is canonical for handled application errors, but UC-005 success bodies remain endpoint-specific and the login rate-limiter body is a documented exception.
- Audit APIs are implemented and manager-only, although no dedicated audit-log frontend page exists in the inspected UC-005 UI.

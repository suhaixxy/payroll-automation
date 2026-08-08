# API Documentation

Base URL: `http://localhost:5000/api`

---

## UC-001 - (Owner: Andrea)

### Roster Sync

#### POST `/roster/sync`

Auth: **Not currently required.** Body: `payPeriodId` (optional UUID string; defaults to the active period), `simulateFailure` (optional boolean).

Example `200 OK`:

```json
{
  "success": true,
  "payPeriodId": "11111111-1111-1111-1111-111111111111",
  "staffSynced": 2,
  "totalHours": 16,
  "unmatchedCount": 0,
  "invalidTimeCount": 0,
  "syncedAt": "2026-08-08T00:05:00.000Z",
  "draftTimesheets": [{ "staffId": "S001", "fullName": "Andrea Chua", "totalHours": 8, "shifts": [{ "date": "2026-08-08", "hours": 8, "matchedBy": "id", "clockIn": "09:00", "clockOut": "17:00" }], "matchStatus": "matched" }],
  "unmatched": [],
  "invalidTime": []
}
```

Errors: `424 Failed Dependency` with `ROSTER_SOURCE_UNREACHABLE`, `ROSTER_SOURCE_EMPTY`, `PAY_PERIOD_NOT_FOUND`, or `ACTIVE_PAY_PERIOD_NOT_FOUND` in `{ success: false, error, message }` form. Source errors include `previousDraft` when available. `simulateFailure: true` always returns a simulated `424 ROSTER_SOURCE_UNREACHABLE` response. Unexpected failures return `500 Internal Server Error`.

#### GET `/roster/sync/summary`

Auth: **Not currently required.** Query: `payPeriodId` (optional UUID string; defaults to the active period). No body.

Example `200 OK` when no draft exists:

```json
{
  "success": false,
  "payPeriodId": "11111111-1111-1111-1111-111111111111",
  "message": "No sync has been run yet for this pay period. Click \"Import Now\" to run the first sync."
}
```

Errors: `500 Internal Server Error` for unexpected service or database failures.

#### GET `/roster/sync/history`

Auth: **Not currently required.** Query: `payPeriodId` (optional UUID string). No body.

Example `200 OK`:

```json
{
  "history": [{ "action": "roster_synced", "actor": "manual", "detail": { "staffSynced": 2, "totalHours": 16 }, "createdAt": "2026-08-08T00:05:00.000Z" }]
}
```

Errors: `500 Internal Server Error` for unexpected service or database failures.

### Staff

All Staff endpoints require `Authorization: Bearer <access-token>` for a user with the `manager` role. Shared auth errors are `401 AUTHENTICATION_REQUIRED` (missing token), `401 INVALID_TOKEN` (invalid, expired, or inactive-user token), and `403 FORBIDDEN` (non-manager).

#### GET `/staff`

Auth: manager bearer token. Query: `status` (optional string; only `active` is accepted). No body.

Example `200 OK`:

```json
[{ "id": "11111111-1111-1111-1111-111111111111", "externalRef": "S001", "fullName": "Andrea Chua", "employmentType": "full_time", "status": "active" }]
```

Errors: `400 INVALID_STATUS_FILTER` for any `status` value other than `active`; shared auth errors; `500 Internal Server Error` for database failures.

#### GET `/staff/:id`

Auth: manager bearer token. Path: `id` (UUID string). No body or query.

Example `200 OK`:

```json
{ "id": "11111111-1111-1111-1111-111111111111", "externalRef": "S001", "fullName": "Andrea Chua", "employmentType": "full_time", "status": "active" }
```

Errors: `400 INVALID_STAFF_ID`, `404 STAFF_NOT_FOUND`, shared auth errors, or `500 Internal Server Error`.

#### POST `/staff`

Auth: manager bearer token. Body: `external_ref` (required string, unique), `full_name` (required non-empty string), and `employment_type` (required string: `full_time` or `part_time`). No query.

Example `201 Created`:

```json
{ "id": "22222222-2222-2222-2222-222222222222", "externalRef": "S008", "fullName": "Jordan Lee", "employmentType": "part_time", "status": "active" }
```

Errors: `400 VALIDATION_ERROR` for missing/empty fields, `400 INVALID_EMPLOYMENT_TYPE`, `409 STAFF_EXTERNAL_REF_EXISTS`, shared auth errors, or `500 Internal Server Error`.

#### PATCH `/staff/:id`

Auth: manager bearer token. Path: `id` (UUID string). Body must contain at least one of: `full_name` (non-empty string), `employment_type` (`full_time` or `part_time`), or `status` (`active` or `inactive`). No query.

Example `200 OK`:

```json
{ "id": "11111111-1111-1111-1111-111111111111", "externalRef": "S001", "fullName": "Andrea C. Chua", "employmentType": "full_time", "status": "active" }
```

Errors: `400 INVALID_STAFF_ID`, `VALIDATION_ERROR`, `INVALID_EMPLOYMENT_TYPE`, or `INVALID_STAFF_STATUS`; `404 STAFF_NOT_FOUND`; shared auth errors; or `500 Internal Server Error`.

#### DELETE `/staff/:id`

Auth: manager bearer token. Path: `id` (UUID string). No body or query. This is a soft delete: it sets `status` to `inactive`.

Example `200 OK`:

```json
{ "id": "11111111-1111-1111-1111-111111111111", "externalRef": "S001", "fullName": "Andrea Chua", "employmentType": "full_time", "status": "inactive" }
```

Errors: `400 INVALID_STAFF_ID`, `404 STAFF_NOT_FOUND`, shared auth errors, or `500 Internal Server Error`.

#### PATCH `/staff/:staffId/bank-details`

Auth: manager bearer token. Path: `staffId` (UUID string). Body: `bankCode` (required string, 3–20 alphanumeric/hyphen characters) and `bankAccountNumber` (required string, 5–50 alphanumeric/hyphen characters). No query.

Example `200 OK`:

```json
{ "message": "Bank details updated.", "data": { "id": "11111111-1111-1111-1111-111111111111", "employeeReference": "S001", "employeeName": "Andrea Chua", "bankCode": "7171", "bankAccountNumber": "*****6789" } }
```

Errors: `400 VALIDATION_ERROR` for an invalid UUID or invalid body, `404 STAFF_NOT_FOUND`, shared auth errors, or `500 Internal Server Error`.

### Pay Periods

#### GET `/pay-periods`

Auth: **Not currently required.** No body or query parameters.

Example `200 OK`:

```json
[{ "id": "33333333-3333-3333-3333-333333333333", "startDate": "2026-08-06", "endDate": "2026-08-19", "isActive": true }, { "id": "44444444-4444-4444-4444-444444444444", "startDate": "2026-08-20", "endDate": "2026-09-02", "isActive": false }]
```

Errors: `500 Internal Server Error` for database failures.

#### GET `/pay-periods/:id`

Auth: **Not currently required.** Path: `id` (UUID string). No body or query.

Example `200 OK`:

```json
{ "id": "33333333-3333-3333-3333-333333333333", "startDate": "2026-08-06", "endDate": "2026-08-19" }
```

Errors: `404 Not Found` with `{ "message": "Pay period not found" }` when absent; `500 Internal Server Error` for database failures, including an invalid database ID format.

---

## UC-002 - Timesheet Validation (Owner: Kieron)

*(To be filled in by Kieron as UC-002 is built)*

---

## UC-003 - Payroll Calculation (Owner: Robert)

*(To be filled in by Robert as UC-003 is built)*

---

## UC-004 - Approval (Owner: Suhaila)

*(To be filled in by Suhaila as UC-004 is built)*

---

## UC-005 - Payment (Owner: En Qi)

*(To be filled in by En Qi as UC-005 is built)*

---

## Shared

### GET /health

Checks server and database connectivity.

**Example response:**

```json
{ "status": "ok", "database": "connected" }
```

**Error codes:**

- 500: Database disconnected or query failed

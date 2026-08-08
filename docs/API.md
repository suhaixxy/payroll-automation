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

Base path: `/api/uc003` · Postman collection: [`docs/UC-003.postman_collection.json`](./UC-003.postman_collection.json)

### Conventions

**Every** UC-003 response uses the standard envelope (the CSV export is the single
deliberate exception — it returns a file):

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 6 } }
// failure
{ "success": false, "error": { "code": "PERIOD_NOT_VALIDATED", "message": "…", "details": [] } }
```

**Money is never a float.** All amounts are `NUMERIC(12,2)` **strings** (`"1264.50"`),
computed internally in integer cents. Parse them as decimals, never as floats, and
format only at the display edge.

**Authentication:** every endpoint requires `Authorization: Bearer <jwt>`.
Unauthenticated → `401`; wrong role → `403`. Roles are enforced on the routes, never
in the frontend.

**Soft deletes return `204 No Content`** (no envelope, no body) — the row survives for
the audit trail with `deleted_at` set, and disappears from the API.

| Operation | accounting | manager |
|---|---|---|
| All reads (periods, staff, lines, runs, summary, variance, export, rate sets) | ✅ | ✅ |
| Calculate / recalculate | ✅ | ✅ |
| Submit for approval, void a run | ❌ | ✅ |
| Create/update/delete adjustments & performance inputs | ❌ | ✅ |
| Create a new statutory rate set version | ❌ | ✅ |

### Reads

#### GET /api/uc003/periods
Pay periods with their status, oldest first. Used by the period picker.
```json
{ "success": true, "data": { "periods": [
  { "id": "…", "startDate": "2026-07-01", "endDate": "2026-07-15", "status": "validated" }
] } }
```

#### GET /api/uc003/staff
Active staff for form pickers (read-only access to UC-001's table).

#### GET /api/uc003/periods/:periodId/summary
The **authoritative run** (latest non-voided complete run) with its four totals, plus
the period-level variance check.
```json
{ "success": true, "data": {
  "period": { "id": "…", "startDate": "2026-07-01", "endDate": "2026-07-15", "status": "calculated" },
  "run": {
    "id": "…", "runNumber": 2, "rateSetVersion": "2026-01",
    "runAt": "2026-08-06T15:42:11+08", "runByName": "Robert",
    "totals": { "gross": "1164.00", "employeeDeductions": "222.00",
                "employerCost": "199.00", "netPayable": "942.00" },
    "linesComplete": 3, "linesIncomplete": 0
  },
  "varianceWarning": false, "variance": null
} }
```
`run` is `null` when the period has never been calculated.

#### GET /api/uc003/periods/:periodId/lines
Lines of the authoritative run.

| Query param | Values | Default |
|---|---|---|
| `status` | `complete` \| `incomplete` | all |
| `search` | matches staff name or external ref (ILIKE) | — |
| `sort` | `name` \| `gross` \| `net` \| `status` | `name` |
| `dir` | `asc` \| `desc` | `asc` |
| `page` | 1-based | `1` |
| `limit` | 1–100 | `20` |

Paging metadata comes back in `meta` (`page`, `limit`, `total`).

#### GET /api/uc003/lines/:lineId
One line with `calcBreakdown` — the ordered, human-readable derivation the engine
**stored with the run** (never recomputed) — plus run provenance (`runNumber`,
`rateSetVersion`, `runByName`, `runAt`). This is what the "Details" modal renders.
- `404 LINE_NOT_FOUND`

#### GET /api/uc003/periods/:periodId/runs
Every run for the period, newest first, **including voided ones with their reasons** —
the audit trail is the point, so nothing is hidden.

#### GET /api/uc003/periods/:periodId/variance
Per-staff net-pay comparison against the previous period's authoritative run, sorted by
largest absolute movement. Staff present in only one of the two runs still appear
(joiners/leavers). Incomplete lines return `null` — never a misleading `"0.00"`.
- `previousPeriod` is `null` when no earlier period has a completed run.
- `409 NO_RUN` if this period has never been calculated.

#### GET /api/uc003/periods/:periodId/export.csv
Payroll register of the authoritative run as a CSV **file download**
(`text/csv`, `Content-Disposition: attachment`, UTF-8 BOM so Excel detects the encoding).
18 columns, one row per staff line, no paging. **Does not use the JSON envelope.**
- `409 NO_RUN` if the period has never been calculated.

### Calculation runs

#### POST /api/uc003/periods/:periodId/calculate  → `201`
Runs the calculation on the period's frozen hour snapshot and creates **run #1**.
Requires the period to be `validated`; moves it to `calculated`.

```json
{ "success": true, "data": {
  "periodId": "…", "status": "calculated",
  "run": { "id": "…", "runNumber": 1, "rateSetVersion": "2026-01" },
  "totals": { "gross": "1264.50", "employeeDeductions": "180.00",
              "employerCost": "159.26", "netPayable": "1084.50" },
  "linesComplete": 2, "linesIncomplete": 4,
  "varianceWarning": false, "variance": null
} }
```

- `404 PERIOD_NOT_FOUND`
- `409 PERIOD_NOT_VALIDATED` — the period is not `validated` (use recalculate instead)
- `422 NO_RATE_SET` — no statutory rate set covers the period end date

#### POST /api/uc003/periods/:periodId/recalculate  → `201`
Same mechanics, different guard: allowed from `validated`, `calculated`, or
`pending_approval`. Creates the **next** run number; earlier runs are preserved
untouched. A `pending_approval` period drops back to `calculated`.
- `409 PERIOD_LOCKED` once the period is `approved` or `paid`

#### POST /api/uc003/periods/:periodId/submit-approval  → `200` *(manager)*
`calculated` → `pending_approval`, handing off to UC-004.
- `409 INVALID_PERIOD_STATE` — only a `calculated` period can be submitted
- `409 NO_RUN` — nothing has been calculated yet
- `422 INCOMPLETE_LINES` — at least one line of the authoritative run is incomplete;
  `details[0].incompleteCount` says how many. Resolve them and recalculate first.

#### POST /api/uc003/runs/:runId/void  → `200` *(manager)*
Marks a run voided. The latest remaining non-voided complete run becomes authoritative.
Body: `{ "reason": "why this run is wrong" }` — **required**.
- `400 VALIDATION_ERROR` — missing/blank reason
- `404 RUN_NOT_FOUND` · `409 RUN_ALREADY_VOIDED` · `409 PERIOD_LOCKED`

### Payroll adjustments

One-off bonuses, allowances, deductions, clawbacks, and corrections that fold into a
staff member's gross for one period. Types: `bonus`, `allowance`, `deduction`,
`clawback`, `correction`. Negative amounts are valid (deductions). `cpfApplicable`
controls whether the amount enters the CPF wage base.

| Method | Path | Role |
|---|---|---|
| GET | `/api/uc003/adjustments?periodId=…` | any |
| GET | `/api/uc003/adjustments/:id` | any |
| POST | `/api/uc003/adjustments` | manager |
| PATCH | `/api/uc003/adjustments/:id` | manager |
| DELETE | `/api/uc003/adjustments/:id` | manager (soft delete → `204`) |

```jsonc
// POST body
{ "staffId": "…", "periodId": "…", "adjustmentType": "bonus",
  "amount": 200.00, "cpfApplicable": true, "reason": "Retention bonus for July" }
```
- `400 VALIDATION_ERROR` — unknown type, more than 2 decimal places, `reason` under 3 chars, amount outside ±100,000
- `404` unknown id (including soft-deleted rows)
- `409 PERIOD_LOCKED` — the period is `approved` or `paid`
- `staffId` and `periodId` are immutable on PATCH.

### Performance inputs

Drive full-timer incentive pay as `quantity × unitValue`. At most **one live row per
(staff, period, inputType)**; soft-deleting one frees the slot again.

| Method | Path | Role |
|---|---|---|
| GET | `/api/uc003/performance-inputs?periodId=…` | any |
| GET | `/api/uc003/performance-inputs/:id` | any |
| POST | `/api/uc003/performance-inputs` | manager |
| PATCH | `/api/uc003/performance-inputs/:id` | manager |
| DELETE | `/api/uc003/performance-inputs/:id` | manager (soft delete → `204`) |

```jsonc
// POST body
{ "staffId": "…", "periodId": "…", "inputType": "sessions",
  "quantity": 24.00, "unitValue": 15.00, "notes": "Sessions delivered in July" }
```
- `400 VALIDATION_ERROR` — `inputType` must be a slug `^[a-z][a-z0-9_-]{1,39}$`; quantity/unitValue 0–100,000 with at most 2 decimals
- `409 DUPLICATE_INPUT` — a live row already exists for that staff + period + type
- `409 PERIOD_LOCKED`
- `staffId` and `inputType` are immutable on PATCH.

### Statutory rate sets

Versioned CPF/SDL/multiplier tables. A rate set is **superseded, never edited** — there
is deliberately no PATCH or DELETE, because runs are pinned to the set they used and
editing one would silently rewrite history.

| Method | Path | Role |
|---|---|---|
| GET | `/api/uc003/rate-sets` | any |
| GET | `/api/uc003/rate-sets/:id` | any (includes the CPF band table) |
| POST | `/api/uc003/rate-sets` | manager |

`POST` creates a new version and closes the current one (`effective_to` = the day
before the new `effectiveFrom`).
```jsonc
{ "versionLabel": "2027-01", "effectiveFrom": "2027-01-01",
  "sdlRate": 0.0025, "sdlMin": 2, "sdlMax": 11.25, "sdlWageCap": 4500,
  "otMultiplier": 1.5, "phMultiplier": 2, "cpfOwCeiling": 8000,
  "bands": [
    { "ageMin": 0,  "ageMax": 55,   "employeeRate": 0.20, "employerRate": 0.17, "minWageThreshold": 500 },
    { "ageMin": 56, "ageMax": null, "employeeRate": 0.18, "employerRate": 0.16, "minWageThreshold": 500 }
  ] }
```
- `400 VALIDATION_ERROR` — CPF bands must **cover every age with no gaps**: the first
  band starts at 0, each subsequent `ageMin` is the previous `ageMax + 1`, and the last
  band is open-ended (`ageMax: null`). Nobody may fall through the table.
- `422 EFFECTIVE_FROM_NOT_AFTER_CURRENT` — the new version must start after the
  currently open one.

### Reason codes (incomplete lines)

An incomplete line is **excluded from every total** and blocks submit-approval.

| Code | Meaning | Resolved by |
|---|---|---|
| `MISSING_PAY_RATE` | Part-timer has hours but no effective pay rate | Whoever owns pay rates (§3.3, open) |
| `MISSING_PERFORMANCE_INPUT` | Full-timer has no performance input this period | **Resolve button** → add the input → auto-recalculate |
| `NO_HOURS_RECORDED` | Part-timer has no frozen timesheet hours | UC-002 |
| `INVALID_HOURS` | Hours are negative, or OT + PH exceeds total hours | UC-002 |
| `MISSING_DATE_OF_BIRTH` | CPF-eligible staff with no DOB — the age band is unknowable | UC-001 |

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

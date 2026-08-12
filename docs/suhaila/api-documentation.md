# UC-004 — API Documentation

## 1. API Overview

The backend mounts application routes under `/api` (`backend/src/app.js`), and `backend/src/routes/index.js` mounts the approval router at `/approvals` (`router.use("/approvals", require("./approvals"))`). The frontend Axios client (`frontend/src/api/client.js`) targets `${VITE_BACKEND_URL || VITE_API_URL || "http://localhost:5000"}/api` and attaches a stored JWT as `Authorization: Bearer <token>`.

**Response-shape note (verified against the actual controller code):** the app has a shared response-envelope helper (`res.ok` / `res.fail`, in `middleware/apiResponse.js`) that produces `{ success, data }` / `{ success: false, error: { code, message, details } }`. **`approvalController.js` does not use it anywhere.** Every UC-004 endpoint hand-writes its own response with `res.json(...)` / `res.status(...).json(...)`, and the shapes are **not consistent with each other**:

- `GET /periods` returns a bare JSON **array**.
- `GET /summary` and `GET /lines/:lineId` return a bare JSON **object**, and their only documented failures return `{ message: "..." }` — **no machine-readable `code` field**.
- `POST /` returns a bare decision object on success (`201`), and on business-rule failure returns the service's own result object directly: `{ error: "<CODE>", message: "...", ...extra }` — a flat shape, **not** the `{ success:false, error:{ code, message, details } }` envelope.

The only place that shared envelope actually appears for this feature is **authentication/authorization failures** (thrown as `AppError` in `authenticate`/`authorize` middleware, before any controller runs) and any **uncaught exception**, both of which flow through the global `errorHandler` and always produce:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "details": []
  }
}
```

## 2. Authentication / Authorization

Every route in `backend/src/routes/approvals.js` runs `router.use(authenticate, authorize("manager"))` — there is no exception, including the read-only `GET` endpoints.

- A missing or malformed `Authorization: Bearer <token>` header → `401` `AUTHENTICATION_REQUIRED`.
- An invalid/expired JWT, or a JWT whose subject no longer resolves to an active `user_account` → `401` `INVALID_TOKEN`.
- `jwtSecret` not configured on the server → `500` `AUTH_CONFIGURATION_ERROR`.
- An authenticated user whose `role` is not `manager` (e.g. `employee`) → `403` `FORBIDDEN`.

These four all use the shared envelope shown in Section 1 and apply identically to all four endpoints below, so they are not repeated per-endpoint.

## 3. Endpoint Reference

### `GET /api/approvals/periods`

**Purpose:** List every pay period with its authoritative (latest `complete`) calculation run totals and its most recent approval decision, newest period first.
**Authentication:** Bearer JWT.
**Authorization:** Manager only.
**Path Parameters:** None.
**Query Parameters:** None.
**Request Body:** None.
**Success Response:** `200`, a bare JSON array:

```json
[
  {
    "id": "5ada0000-0000-4000-8000-000000000001",
    "startDate": "2026-11-01",
    "endDate": "2026-11-14",
    "status": "pending_approval",
    "totalGross": "4000.00",
    "totalNet": "3667.00",
    "validatedAt": null,
    "calculationRunId": "5adac300-0000-4000-8000-000000000001",
    "runNumber": 1,
    "runTotalGross": "4000.00",
    "runTotalNet": "3667.00",
    "latestDecision": null,
    "approvedBy": null,
    "decidedAt": null
  }
]
```

`calculationRunId`, `runNumber`, `runTotalGross`, `runTotalNet` are `null` when the period has no `complete` calculation run. `latestDecision`, `approvedBy`, `decidedAt` are `null` when the period has no `approval` row yet.
**Possible Errors:** `401` `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN`; `403` `FORBIDDEN`; `500` `INTERNAL_ERROR` (unexpected DB failure — not explicitly caught into a specific code by this endpoint).
**Used By:** `ApprovalPage.jsx` → `loadPeriods()`.

### `GET /api/approvals/summary`

**Purpose:** Return one pay period's totals, previous-cycle comparison, and full per-employee line breakdown.
**Authentication:** Bearer JWT.
**Authorization:** Manager only.
**Path Parameters:** None.
**Query Parameters:** `payPeriodId` (required, `pay_period.id`).
**Request Body:** None.
**Success Response:** `200`:

```json
{
  "payPeriodId": "5ada0000-0000-4000-8000-000000000001",
  "startDate": "2026-11-01",
  "endDate": "2026-11-14",
  "status": "pending_approval",
  "validatedAt": null,
  "calculationRunId": "5adac300-0000-4000-8000-000000000001",
  "runNumber": 1,
  "totalGross": "4000.00",
  "totalNet": "3667.00",
  "previousCycle": { "totalNet": null },
  "lines": [
    {
      "id": "5ada0110-0000-4000-8000-000000000011",
      "fullName": "Andrea Chua",
      "grossPay": "1200.00",
      "incentivePay": "100.00",
      "cpfAmount": "120.00",
      "sdlAmount": "10.00",
      "netPay": "1170.00",
      "status": "complete"
    }
  ]
}
```

`previousCycle.totalNet` is `null` if there is no prior `approved`/`paid` period before this one's `start_date`. `lines` is `[]` if the period has no `complete` run.
**Possible Errors:** `400` `{ "message": "payPeriodId is required." }` (no `code` field); `404` `{ "message": "Pay period not found." }` (no `code` field); `401`/`403` as in Section 2; `500` `INTERNAL_ERROR`.
**Used By:** `ApprovalPage.jsx` → `loadSummary()`.

### `GET /api/approvals/lines/:lineId`

**Purpose:** Return the full detail of one employee's payroll line, including performance inputs, for the details modal.
**Authentication:** Bearer JWT.
**Authorization:** Manager only.
**Path Parameters:** `lineId` (required, `payroll_lines.id`).
**Query Parameters:** None.
**Request Body:** None.
**Success Response:** `200`:

```json
{
  "id": "5ada0110-0000-4000-8000-000000000011",
  "fullName": "Andrea Chua",
  "employmentType": "part_time",
  "grossPay": "1200.00",
  "incentivePay": "100.00",
  "cpfAmount": "120.00",
  "sdlAmount": "10.00",
  "netPay": "1170.00",
  "status": "complete",
  "totalHours": "80.00",
  "otHours": "0.00",
  "phHours": "0.00",
  "performanceInputs": []
}
```

**Possible Errors:** `404` `{ "message": "Payroll line not found." }` (no `code` field); `401`/`403` as in Section 2; `500` `INTERNAL_ERROR`.
**Used By:** `ApprovalPage.jsx` → `showLine()`.

### `POST /api/approvals/`

**Purpose:** Record a manager's approve/reject decision for a pay period and transition its lifecycle status.
**Authentication:** Bearer JWT.
**Authorization:** Manager only.
**Path Parameters:** None.
**Query Parameters:** None.
**Request Body:**

```json
{
  "payPeriodId": "5ada0000-0000-4000-8000-000000000001",
  "calculationRunId": "5adac300-0000-4000-8000-000000000001",
  "decision": "approved",
  "comment": ""
}
```

`payPeriodId` (required, UUID) · `calculationRunId` (required, UUID) · `decision` (required, `"approved"` or `"rejected"`) · `comment` (string; required non-empty/non-whitespace when `decision` is `"rejected"`, otherwise optional and stored as `null` if blank).

**Success Response:** `201`:

```json
{
  "id": "b1a2c3d4-0000-4000-8000-000000000001",
  "payPeriodId": "5ada0000-0000-4000-8000-000000000001",
  "calculationRunId": "5adac300-0000-4000-8000-000000000001",
  "decision": "approved",
  "approvedBy": "Suhaila (Manager)",
  "comment": null,
  "decidedAt": "2026-08-12T09:15:00.000Z",
  "status": "approved",
  "isLocked": true
}
```

For a rejection, `decision: "rejected"`, `comment` holds the trimmed reason, `status: "calculated"`, `isLocked: false`.

**Possible Errors** (all returned as a flat `{ "error": "<CODE>", "message": "...", ...extra }` body — **not** the shared envelope):

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | `payPeriodId`, `calculationRunId`, or a valid `decision` (`approved`/`rejected`) is missing/invalid. |
| `COMMENT_REQUIRED` | 422 | `decision` is `rejected` and `comment` is empty/whitespace-only. |
| `NOT_FOUND` | 404 | `payPeriodId` matches no `pay_period`. |
| `INVALID_STATUS` | 409 | The period's current `status` is not `pending_approval` (includes the real status as `status` in the body — this is also the "already approved / approve twice" case). |
| `RUN_NOT_FOUND` | 404 | `calculationRunId` doesn't exist, doesn't belong to this period, or isn't `status = 'complete'`. |
| `STALE_RUN` | 409 | A newer `complete` run exists for this period than the one submitted. |
| `INCOMPLETE_LINES` | 409 | The targeted run still has `lines_incomplete > 0`. |

Plus the shared `401`/`403` authentication failures from Section 2, and `500` `INTERNAL_ERROR` for any unexpected/DB failure (the transaction is rolled back first).

**Used By:** `ApprovalPage.jsx` → `submitDecision()`.

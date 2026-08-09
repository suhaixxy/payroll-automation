# UC002 – Timesheet Validation API Documentation

## Overview

**Base URL:** `/api/timesheets`  
**Authentication:** Bearer JWT access token  
**Authorised role:** `manager`

All UC002 routes are protected by authentication and manager-role authorisation. A missing token returns `401 AUTHENTICATION_REQUIRED`, an invalid or expired token returns `401 INVALID_TOKEN`, and an authenticated non-manager returns `403 FORBIDDEN`.

The shared error response format is:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable explanation.",
  "details": []
}
```

---

## 1. List Pay Periods

**Method:** `GET`  
**Path:** `/api/timesheets/periods`  
**Purpose:** Returns pay periods available for timesheet validation.

### Request Body

None.

### Example Response – 200

```json
{
  "rows": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "startDate": "2026-08-01",
      "endDate": "2026-08-14",
      "status": "draft",
      "validatedAt": null
    }
  ]
}
```

### Error Responses

| Status | Code | Meaning |
|---|---|---|
| 401 | `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN` | No valid login token. |
| 403 | `FORBIDDEN` | User is not a manager. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server/database error. |

---

## 2. Get Timesheet Review

**Method:** `GET`  
**Path:** `/api/timesheets/:payPeriodId/review`  
**Purpose:** Returns timesheet rows grouped by staff together with exceptions and validation summary information.

### Path Parameter

`payPeriodId` must be a valid database UUID.

### Request Body

None.

### Example Response – 200

```json
{
  "success": true,
  "period": {
    "id": "11111111-1111-1111-1111-111111111111",
    "startDate": "2026-08-01",
    "endDate": "2026-08-14",
    "status": "draft",
    "validatedAt": null
  },
  "status": "draft",
  "lastValidatedAt": null,
  "staffReviewed": 1,
  "totalHoursValidated": 10,
  "discrepancyCount": 1,
  "canValidate": false,
  "staff": [
    {
      "staffDbId": "22222222-2222-2222-2222-222222222222",
      "staffId": "S001",
      "name": "Example Employee",
      "totalHours": 10,
      "entries": [
        {
          "id": "33333333-3333-3333-3333-333333333333",
          "date": "2026-08-03",
          "clockIn": "08:00",
          "clockOut": "18:00",
          "actualHours": 10,
          "matchStatus": "matched",
          "isFrozen": false
        }
      ],
      "flags": [
        {
          "id": "44444444-4444-4444-4444-444444444444",
          "entryId": "33333333-3333-3333-3333-333333333333",
          "flagType": "exceeds_cap",
          "label": "Hours exceed threshold",
          "status": "open",
          "note": "10 hours on 2026-08-03 exceeds the 8-hour daily review threshold.",
          "expectedValue": "8.00",
          "actualValue": "10.00",
          "resolvedBy": null
        }
      ],
      "status": "Flagged"
    }
  ]
}
```

### Error Responses

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `payPeriodId` is not a valid UUID. |
| 401 | `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN` | No valid login token. |
| 403 | `FORBIDDEN` | User is not a manager. |
| 404 | `PAY_PERIOD_NOT_FOUND` | Pay period does not exist. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server/database error. |

---

## 3. Run Timesheet Validation

**Method:** `POST`  
**Path:** `/api/timesheets/:payPeriodId/validate`  
**Purpose:** Runs the UC002 rules engine for the selected pay period and refreshes unresolved validation exceptions.

### Request Body

None.

### Rules Checked

- unmatched or invalid-time timesheet rows;
- shift above the 8-hour daily review threshold;
- overlapping normal same-day shifts for the same staff member;
- staff weekly total above 44 hours;
- active staff with no matched timesheet entry for the period.

### Example Response – 200

```json
{
  "message": "Timesheet validation completed.",
  "data": {
    "success": true,
    "detected": 3,
    "newlyFlagged": 3
  }
}
```

### Error Responses

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid pay-period UUID. |
| 401 | `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN` | No valid login token. |
| 403 | `FORBIDDEN` | User is not a manager. |
| 404 | `PAY_PERIOD_NOT_FOUND` | Pay period does not exist. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected validation/database error. |

---

## 4. Resolve One Timesheet Exception

**Method:** `PATCH`  
**Path:** `/api/timesheets/exceptions/:exceptionId`  
**Purpose:** Resolves, corrects, or returns a single validation exception.

### Path Parameter

`exceptionId` must be a valid database UUID.

### Example Request – Note as Acceptable

```json
{
  "resolution": "noted",
  "note": "Confirmed with supervisor; hours are valid."
}
```

### Example Request – Correct Hours

```json
{
  "resolution": "corrected",
  "correctedHours": 8,
  "note": "Roster total corrected after supervisor review."
}
```

### Example Request – Return for Follow-up

```json
{
  "resolution": "returned",
  "note": "Please verify the original clock-out time."
}
```

Supported `resolution` values are `corrected`, `noted`, and `returned`. `correctedHours`, when supplied, must be between 0 and 24. Notes are limited to 1000 characters.

### Example Response – 200

```json
{
  "message": "Timesheet exception updated.",
  "data": {
    "success": true
  }
}
```

### Error Responses

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid UUID, resolution, hours, or note. |
| 400 | `CORRECTED_HOURS_REQUIRED` | `corrected` selected without corrected hours for a row-linked exception. |
| 401 | `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN` | No valid login token. |
| 403 | `FORBIDDEN` | User is not a manager. |
| 404 | `EXCEPTION_NOT_FOUND` | Exception does not exist. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server/database error. |

---

## 5. Bulk Resolve Exceptions

**Method:** `PATCH`  
**Path:** `/api/timesheets/:payPeriodId/exceptions/bulk`  
**Purpose:** Marks all unresolved exceptions of one rule type in a pay period as `noted`.

### Example Request

```json
{
  "ruleType": "overlap",
  "note": "Confirmed repeated overlap exceptions with the supervisor."
}
```

Supported `ruleType` values are:

- `overlap`
- `exceeds_cap`
- `missing_entry`
- `public_holiday`

The current validation engine automatically generates the first three rule types where applicable. `public_holiday` remains a supported database/API rule type but is not automatically generated by the current rules engine.

### Example Response – 200

```json
{
  "message": "2 exception(s) confirmed.",
  "data": {
    "success": true,
    "resolvedCount": 2
  }
}
```

### Error Responses

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid UUID or unsupported rule type. |
| 401 | `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN` | No valid login token. |
| 403 | `FORBIDDEN` | User is not a manager. |
| 404 | `PAY_PERIOD_NOT_FOUND` | Pay period does not exist. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server/database error. |

---

## 6. Complete Timesheet Validation

**Method:** `POST`  
**Path:** `/api/timesheets/:payPeriodId/complete`  
**Purpose:** Finalises the selected pay period after all blocking exceptions are resolved. All timesheet rows in the period are frozen and the pay period becomes `validated`.

### Request Body

None.

### Example Response – 200

```json
{
  "message": "Pay period validated and timesheets frozen.",
  "data": {
    "success": true,
    "frozenTimesheetRows": 18
  }
}
```

### Error Responses

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid pay-period UUID. |
| 401 | `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN` | No valid login token. |
| 403 | `FORBIDDEN` | User is not a manager. |
| 404 | `PAY_PERIOD_NOT_FOUND` | Pay period does not exist. |
| 409 | `UNRESOLVED_TIMESHEET_EXCEPTIONS` | At least one exception remains `open` or `returned`. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server/database error. |

Example 409 response:

```json
{
  "error": "UNRESOLVED_TIMESHEET_EXCEPTIONS",
  "message": "Resolve or note every blocking timesheet exception before validating this pay period.",
  "details": [
    {
      "unresolvedCount": 2
    }
  ]
}
```

---

## 7. Get Validation Audit Log

**Method:** `GET`  
**Path:** `/api/timesheets/:payPeriodId/audit-log`  
**Purpose:** Returns up to 30 audit-history entries for the selected pay period.

### Request Body

None.

### Example Response – 200

```json
{
  "entries": [
    {
      "action": "TIMESHEET_EXCEPTION_RESOLVED",
      "actor": "manager@example.com",
      "detail": {
        "exceptionId": "44444444-4444-4444-4444-444444444444",
        "resolution": "noted",
        "correctedHours": null
      },
      "createdAt": "2026-08-08T10:00:00.000Z"
    },
    {
      "action": "TIMESHEET_VALIDATION_RUN",
      "actor": "manager@example.com",
      "detail": {
        "detected": 1,
        "inserted": 1
      },
      "createdAt": "2026-08-08T09:58:00.000Z"
    }
  ]
}
```

### Error Responses

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid pay-period UUID. |
| 401 | `AUTHENTICATION_REQUIRED` / `INVALID_TOKEN` | No valid login token. |
| 403 | `FORBIDDEN` | User is not a manager. |
| 404 | `PAY_PERIOD_NOT_FOUND` | Pay period does not exist. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server/database error. |

---

## UC002 Audit Actions

UC002 records these actions in the shared audit log:

| Action | When it is recorded |
|---|---|
| `TIMESHEET_VALIDATION_RUN` | Validation rules are run for a pay period. |
| `TIMESHEET_EXCEPTION_RESOLVED` | One exception is corrected, noted, or returned. |
| `TIMESHEET_EXCEPTIONS_BULK_RESOLVED` | Multiple exceptions of one rule type are confirmed together. |
| `TIMESHEET_PERIOD_VALIDATED` | A pay period is finalised and its timesheet rows are frozen. |

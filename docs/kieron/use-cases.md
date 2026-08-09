# UC002 – Timesheet Validation Use Cases

## Scope

UC002 allows an authenticated **manager** to review roster-derived timesheet records for a selected pay period, run validation rules, resolve blocking exceptions, review audit history, and finalise the period by freezing validated timesheet rows before payroll calculation.

The backend protects all UC002 routes using authentication and manager-role authorisation. Employees are not permitted to access or perform UC002 actions.

## UC002-01 – View Timesheet Validation Review

**Actor:** Manager  
**Trigger:** The manager opens the Timesheet Validation page.  
**Preconditions:** The manager is authenticated, has the `manager` role, and at least one pay period exists.

### Main Flow

1. The system retrieves the available pay periods.
2. The latest pay period is selected by default in the frontend.
3. The system retrieves the timesheet review for the selected pay period.
4. The page displays the number of staff reviewed, total matched hours, open exceptions, and pay-period status.
5. The manager can search by employee name or staff reference.
6. The manager can filter the table to show only flagged employees.
7. Each employee row shows shift entries, total hours, validation status, and any exceptions.

### Alternative / Edge Flows

- If no pay period exists, the page shows an empty-state message instead of validation data.
- If the selected pay period does not exist, the API returns `404 PAY_PERIOD_NOT_FOUND`.
- If the user is not authenticated, the API returns `401`.
- If the authenticated user is not a manager, the API returns `403 FORBIDDEN`.
- If there are no timesheet rows for the period, the review cannot be finalised because `canValidate` is false.

---

## UC002-02 – Run Timesheet Validation

**Actor:** Manager  
**Trigger:** The manager clicks **Run Validation**.  
**Preconditions:** The manager is authenticated, has selected an existing pay period, and roster/timesheet data has been loaded for that period.

### Main Flow

1. The manager selects a pay period and clicks **Run Validation**.
2. The backend loads all timesheet rows for the selected period and all active staff.
3. The validation rules engine checks the data for discrepancies.
4. Existing unresolved findings with status `open` or `returned` are refreshed.
5. Previously resolved findings with status `corrected` or `noted` are preserved.
6. New unresolved findings are inserted into `timesheet_exception` with status `open`.
7. An audit-log entry is recorded for the validation run.
8. The frontend refreshes the review and displays the latest exception results.

### Validation Rules Implemented

- **Missing / unmatched entry:** a timesheet row is unmatched or contains invalid time data.
- **Daily hours threshold:** a matched shift exceeds 8 hours.
- **Overlapping shifts:** two normal same-day shifts overlap for the same staff member.
- **Weekly hours threshold:** matched hours for a staff member exceed 44 hours in one ISO week.
- **Missing active staff timesheet:** an active staff member has no matched timesheet row in the selected period.

The database supports the `public_holiday` exception type, but the current UC002 rules engine does not automatically generate public-holiday findings because no holiday-calendar integration is implemented in this version.

### Alternative / Edge Flows

- Cross-midnight shift overlap is not automatically checked by the current rules engine.
- Re-running validation does not overwrite previous `corrected` or `noted` decisions.
- An invalid pay-period UUID returns `400 VALIDATION_ERROR`.
- A non-existent pay period returns `404 PAY_PERIOD_NOT_FOUND`.

---

## UC002-03 – Resolve a Timesheet Exception

**Actor:** Manager  
**Trigger:** The manager clicks **Review** beside an unresolved exception.  
**Preconditions:** The exception exists and the manager is authenticated.

### Main Flow

1. The manager opens an unresolved exception.
2. The manager chooses one of the supported resolutions:
   - `noted` – confirm the exception as acceptable and optionally add a note;
   - `corrected` – correct the timesheet hours for an exception tied to a timesheet row;
   - `returned` – return the exception for follow-up.
3. If `corrected` is selected, the manager enters corrected hours between 0 and 24.
4. The backend updates the affected timesheet row when required.
5. The backend updates the exception status, note, resolver, and timestamp.
6. An audit-log entry is recorded.
7. The frontend reloads the review data.

### Alternative / Edge Flows

- If `corrected` is selected without corrected hours, the API returns `400 CORRECTED_HOURS_REQUIRED`.
- If the exception does not exist, the API returns `404 EXCEPTION_NOT_FOUND`.
- A correction is only offered in the UI when the exception is linked to a specific timesheet row.
- Invalid resolution values or corrected hours outside 0–24 return `400 VALIDATION_ERROR`.

---

## UC002-04 – Bulk Confirm Repeated Exceptions

**Actor:** Manager  
**Trigger:** At least two unresolved exceptions share the same rule type and the manager clicks the bulk-confirm button.  
**Preconditions:** The selected pay period exists and unresolved exceptions of the selected rule type are present.

### Main Flow

1. The frontend counts unresolved exceptions by rule type.
2. When at least two unresolved exceptions share a type, a bulk-confirm option is displayed.
3. The manager selects the bulk-confirm action.
4. The backend changes all `open` or `returned` exceptions of that type in the period to `noted`.
5. The backend stores the manager identity and update time.
6. An audit-log entry records the rule type and number of exceptions resolved.
7. The frontend refreshes the review.

### Alternative / Edge Flows

- Bulk resolution only changes matching `open` or `returned` exceptions.
- Previously `corrected` or `noted` exceptions are not changed.
- An invalid rule type returns `400 VALIDATION_ERROR`.

---

## UC002-05 – Complete Timesheet Validation

**Actor:** Manager  
**Trigger:** The manager clicks **Mark Period Validated**.  
**Preconditions:** Timesheet rows exist for the period and there are no exceptions with status `open` or `returned`.

### Main Flow

1. The manager reviews the selected period and resolves all blocking exceptions.
2. The frontend enables **Mark Period Validated** when `canValidate` is true.
3. The backend checks again that no unresolved blocking exceptions remain.
4. All timesheet rows in the selected period are updated to `is_frozen = true`.
5. The pay period status is updated to `validated` and `validated_at` is set.
6. An audit-log entry records the number of frozen timesheet rows.
7. The frontend refreshes the period and review data and shows the period as validated.

### Alternative / Edge Flows

- If any exception is still `open` or `returned`, the API returns `409 UNRESOLVED_TIMESHEET_EXCEPTIONS` and the period is not finalised.
- If the pay period does not exist, the API returns `404 PAY_PERIOD_NOT_FOUND`.
- Once validated, the UI shows **Period Validated** and disables the finalisation button.

---

## UC002-06 – View Validation Audit History

**Actor:** Manager  
**Trigger:** The manager clicks **View History**.  
**Preconditions:** The selected pay period exists.

### Main Flow

1. The frontend requests the audit history for the selected pay period.
2. The backend retrieves up to 30 audit entries for entity type `pay_period` and the selected pay-period ID.
3. The frontend displays the action, actor, and timestamp in reverse chronological order.
4. The manager can hide the history panel again.

### Alternative / Edge Flows

- If there is no audit history, the page displays that no validation history has been recorded.
- If the selected pay period does not exist, the API returns `404 PAY_PERIOD_NOT_FOUND`.

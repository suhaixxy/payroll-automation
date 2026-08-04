# API Documentation

Base URL: `http://localhost:5000/api`

---

## UC-001 — Roster Sync (Owner: Andrea)

### GET /roster
Returns roster sync status / placeholder data.

**Example response:**
```json
{ "message": "Roster route placeholder" }
```

**Error codes:**
- 500: Internal server error

---

## UC-002 — Timesheet Validation (Owner: Kieron)

*(To be filled in by Kieron as UC-002 is built)*

---

## UC-003 — Payroll Calculation (Owner: Robert)

*(To be filled in by Robert as UC-003 is built)*

---

## UC-004 — Approval (Owner: Suhaila)

*(To be filled in by Suhaila as UC-004 is built)*

---

## UC-005 — Payment (Owner: En Qi)

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
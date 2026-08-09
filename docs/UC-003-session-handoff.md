# UC-003 Payroll Calculation — Build Notes & Handover

**Project:** IT2213 Payroll Automation · **Owner:** Robert · **Branch:** `feature/uc-003-robert`
**Last updated:** 6 August 2026 · **Status:** all 8 implementation phases complete

> **Reviewers start here.** This is the reasoning behind UC-003 — what was built, why each
> significant decision went the way it did, what's still open for the team, and the traps
> that cost time. For the API surface see [`API.md`](API.md); for setup see the
> [README](../README.md).

---

## 1. What we were working on, and where it stands

We implemented **UC-003 (Calculate Payroll & Incentives)** end to end, following
*UC-003_Implementation_Guide (2).md* through its eight phases. The use case takes a
**validated** pay period, calculates every staff member's pay from the frozen timesheet
snapshot, and hands the result to UC-004 for approval.

**All eight phases are done and verified.** What remains is entirely process, not code:
commit the work and open the PR.

| Phase | Scope | State |
|---|---|---|
| 0 | Environment, `db:*` scripts, wait-for-db, dependencies | ✅ Committed |
| 1 | Migrations 006–010, audit service, RBAC middleware, seed | ✅ Committed |
| 2 | Pure calculation engine, rate-set service | ✅ Committed |
| 3 | Run service, `/api/uc003` surface, legacy code removed | ✅ Committed |
| 4 | Adjustments CRUD + engine fold-in | ✅ Committed |
| 5 | Performance inputs CRUD + the resolve loop | ✅ Committed |
| 6 | Rate-set versioning, statutory figures verified | ✅ Committed |
| 7 | Polish: breakdown modal, table controls, run history, CSV, variance | ✅ Committed |
| 8 | Coverage thresholds, Postman collection, documentation | ✅ Committed |

### Verification evidence

All of the following were run against the final state of the branch:

- **Backend tests:** 12 suites, 76 passed + 5 `todo`, exit 0
- **Coverage:** passes every enforced threshold — calculation engine at 99.0% statements / 94.3% branches / 100% functions / 100% lines
- **Frontend build:** clean, 40 modules, no warnings
- **Clean-database gate:** `npm run db:reset` works from scratch (volume nuked → migrated → seeded)
- **API contract:** 54/54 assertions passed against a freshly reset database, mirroring the full Postman collection

---

## 2. Run it

```bash
npm run db:reset                 # repo root — clean database + demo data
cd backend  && npm run dev       # http://localhost:5000
cd frontend && npm run dev       # http://localhost:5173
```

> **Register a new account after any `db:reset`.** The reset drops the Docker volume, so the
> `users` table goes with it and any previous login no longer exists. Register with the
> **manager** role to see every control.

### The demo narrative baked into the seed data

The July 2026 period (`2026-07-01 → 2026-07-15`) starts **validated**, with three staff
chosen to exercise three different paths:

| Staff | Type | Setup | Result on first calculate |
|---|---|---|---|
| S001 Alice Tan | Full-time, CPF eligible | 1 performance input, +$200 CPF-applicable bonus | ✅ Complete |
| S002 Ben Lim | Part-time, CPF eligible | 3 frozen timesheets, $18/h rate, −$50 non-CPF deduction | ✅ Complete |
| S003 Chandra Rao | Full-time, **CPF exempt** | **No performance input** (deliberate) | ⚠️ Incomplete |

So the intended demo is: **Calculate Payroll** → 2 complete, 1 incomplete → **Submit for
Approval** is refused with `422 INCOMPLETE_LINES` → click **Resolve** on S003's line → add
the input → it auto-recalculates → now submit succeeds. That refusal is the feature working,
not a bug.

---

## 3. Key decisions and the reasoning behind them

These are the choices a reviewer is most likely to question, so each one records *why*.

### Money is never a floating-point number

New tables store `NUMERIC(12,2)`; all arithmetic happens in **integer cents**, and rates in
**basis points** (1bp = 0.01%). The API returns amounts as decimal **strings** (`"1264.50"`),
never JSON numbers. Floating-point cents silently lose money at scale, and a payroll system
that is off by a cent is a payroll system nobody trusts.

### CPF uses the CPF Board's official rounding, not the guide's blanket round-half-up

The implementation guide said "round half-up at each statutory step". We deliberately
**deviated**: the *total* contribution is rounded to the nearest dollar, the *employee* share
is rounded **down** to the dollar, and the employer share is the remainder. This is what the
CPF Board actually specifies. Matching the guide would have produced figures that disagree
with the employee's real CPF statement — the deviation is documented in code comments so a
reviewer sees it was a decision, not an accident.

### SDL is employer-borne

`net = gross − CPF(employee)`. The Skills Development Levy and employer CPF are costs *on
top of* pay and are never deducted from the employee. An earlier ported version subtracted
SDL from net pay; fixing it moved S002's net from $500 to $502. The UI groups both under
**"Employer Cost"** so the distinction is visible rather than implied.

### The CPF wage base is computed separately from gross

Only adjustments flagged `cpf_applicable` enter the CPF base, and the base is clamped at ≥ 0.
This means a non-CPF deduction reduces take-home pay without reducing CPF contributions —
which is the correct behaviour, and impossible to express if you derive CPF from `gross_total`.

### Calculation runs are immutable and numbered

Recalculating creates run #2, #3 … and never overwrites. Only the **latest non-voided
complete** run is authoritative. Voiding requires a written reason, and voided runs stay
visible in the history *with* their reasons. Payroll is audited; "what did we pay, when, and
on whose authority" must survive a correction. Each run is also pinned forever to the
statutory rate set it used, so recalculating an old period can't silently apply this year's
CPF rates.

### Rate sets are superseded, never edited

There is deliberately **no PATCH and no DELETE** on rate sets. Creating a new version closes
the current one (`effective_to` = the day before). Editing a rate set in place would silently
rewrite the history of every run pinned to it. Band coverage is validated on write: the first
band starts at age 0, each subsequent band continues from the last, and the final band is
open-ended — nobody may fall through the table.

### Incomplete lines are excluded from totals and block submission

When the engine can't compute a line (no pay rate, no performance input, no hours, invalid
hours, missing date of birth) it produces a **reason code** rather than guessing a number.
Those lines contribute nothing to any total and prevent the period being submitted for
approval. A wrong number that looks confident is far more dangerous than a visible gap.

### The status contract is a shared file, in JSON

`shared/payrollStatus.json` is read by both the backend and the frontend, so the two can
never drift on what `calculated` means. It's **JSON rather than an ESM `.mjs` module**
specifically because Jest cannot `require()` ESM — JSON loads natively in Node, Jest, and
Vite alike. That was a real failure we hit and worked around.

### RBAC lives on the routes, never in the frontend

Hiding a button is a UX affordance, not a security control. Every mutation is guarded by
`requireAuth` + `requireRole(...)` server-side; the UI hiding matches it purely for clarity.

### Soft deletes, with a partial unique index

Deleting an adjustment or performance input sets `deleted_at` and returns `204`; the row
survives for the audit trail. This initially broke re-creation, because the unique constraint
on (staff, period, type) still counted deleted rows. Migration **013** replaces it with a
partial unique index (`WHERE deleted_at IS NULL`) so a soft-deleted row frees its slot.

### Test fixtures live in isolated date windows

Each integration suite creates data in its own year — 2030 (`payrollCalc`), 2031
(`adjustments`), 2032 (`performanceInputs`), 2099 (`rateSets`) — with its own rate set and
`beforeAll`/`afterAll` cleanup. Suites can never collide with each other or with the seeded
2026 demo data. Note that the engine lines up **every active staff member**, so seeded staff
legitimately appear as incomplete lines inside a test window; the expectations account for it.

### Coverage is scoped to UC-003 files

`jest.config.js` measures only UC-003-owned code. Including the other use cases' unbuilt
files would dilute the number into meaninglessness. Thresholds **fail the run** if breached:
95/90/100/95 on the calculation engine (the money-critical file), 80/65/85/80 globally.

### Sessions are validated against the database, not just the signature

`GET /api/user/auth` now checks the user row still exists. A JWT stays cryptographically
valid for 8 hours, so after a `db:reset` the browser would restore a "session" for a deleted
user and then fail with a foreign-key error on the first write. Now it returns
`401 STALE_SESSION` with a plain-English explanation.

### UI labels use domain language

"Payroll Calculation", not "UC-003 Payroll". The people who use this think in payroll terms;
`UC-00X` belongs in code comments and documentation only.

### Two small technical traps worth remembering

- **Postgres `DATE` + timezone:** `Date.toISOString()` can shift a day in SGT, so date columns
  are read with `to_char(col, 'YYYY-MM-DD')` rather than letting the driver hand back a
  `Date` object.
- **The CSV export is the one endpoint that skips the JSON envelope** — it returns
  `text/csv` with a `Content-Disposition` attachment header and a UTF-8 BOM so Excel detects
  the encoding correctly.

---

## 4. Files created and modified

### Backend — new

```
src/services/calculationEngine.js        Pure per-line calculator (cents + basis points)
src/services/runService.js               Runs, summary, lines, history, variance, register
src/services/rateSetService.js           Rate-set resolution + versioning
src/services/adjustmentService.js        Adjustments CRUD
src/services/performanceInputService.js  Performance inputs CRUD
src/services/uc003AuditService.js        Audit-trail writer (before/after)
src/controllers/uc003Controller.js       Run lifecycle + variance + CSV export
src/controllers/adjustmentController.js  Yup validation for adjustments
src/controllers/performanceInputController.js
src/controllers/rateSetController.js
src/routes/uc003.js                      Full /api/uc003 surface with RBAC
src/middleware/apiResponse.js            res.ok / res.created / res.noContent / res.fail
src/db/migrations/006_auth_users.sql
src/db/migrations/007_uc003_statutory_rates.sql
src/db/migrations/008_uc003_inputs_adjustments.sql
src/db/migrations/009_uc003_runs_lines.sql
src/db/migrations/010_uc003_audit_log.sql
src/db/migrations/011_uc003_line_breakdown.sql
src/db/migrations/012_uc003_drop_legacy_tables.sql
src/db/migrations/013_uc003_input_unique_active_only.sql
src/db/seeds/030_uc003_seed.sql          Rate set, CPF bands, adjustments, inputs
scripts/wait-for-db.js
tests/payrollCalc.test.js                Run lifecycle + CSV + variance
tests/adjustments.test.js
tests/performanceInputs.test.js
tests/rateSets.test.js
tests/calculationEngine.test.js
```

### Backend — modified

```
src/controllers/userController.js   Stale-session check on GET /api/user/auth
src/middleware/auth.js              requireAuth + multi-role requireRole
src/models/index.js                 Trimmed to { sequelize, User, PayRate, syncUc003Tables }
src/routes/index.js                 Mounts /uc003, removed dead route imports
src/services/uc003SeedService.js    Boot-time demo seeder, legacy writes removed
jest.config.js                      Scoped coverage + enforced thresholds
package.json                        Added test:coverage script
```

### Backend — deleted (superseded by the new engine)

```
src/routes/payroll.js               src/models/PayrollLine.js
src/controllers/payrollController.js  src/models/IncentiveScheme.js
src/services/payrollCalcEngine.js     src/models/PerformanceInput.js
src/services/statutoryEngine.js
src/services/incentiveEngine.js
```

### Frontend

```
NEW  src/components/LineBreakdownModal.jsx   "Show your working" modal
NEW  src/components/RunHistoryPanel.jsx      Run history + manager void
NEW  src/components/StaffVariancePanel.jsx   Per-staff net-pay deltas
NEW  src/components/AdjustmentsPanel.jsx
NEW  src/components/PerformanceInputsPanel.jsx
NEW  src/components/RateSetsPanel.jsx
NEW  src/components/LoginPanel.jsx
MOD  src/pages/PayrollCalcPage.jsx           5 tabs, search/sort/paging, CSV, variance
MOD  src/components/PayrollLineTable.jsx     Sortable headers, Details + Resolve buttons
MOD  src/api/client.js                       Full /api/uc003 client incl. blob download
MOD  src/pages/DashboardPage.jsx             Domain-language tab labels
MOD  src/App.jsx                             Domain-language nav
MOD  src/index.css                           EFAR palette, modal, table controls
MOD  vite.config.js                          /api proxy → localhost:5000
```

### Root and documentation

```
NEW  shared/payrollStatus.json                  Shared status contract
NEW  docs/UC-003.postman_collection.json        49 requests incl. every failure path
NEW  docs/UC-003-session-handoff.md             This file — build notes and handover
MOD  package.json                               db:up/down/nuke/wait/migrate/seed/reset
MOD  README.md                                  db scripts + full UC-003 section
MOD  docs/API.md                                Complete UC-003 API reference
MOD  .env.example
```

---

## 5. What still needs to be done

The code is finished. Everything below needs a person, not a commit.

### Open questions the team needs to answer

1. **Who owns writing to `pay_rate`?** (guide §3.3) Nobody does today. UC-003 reads it and
   raises `MISSING_PAY_RATE` when it's absent. Without an owner, part-timers can never be paid.
2. **Grow the seed data.** With only 3 staff and 1 period, two useful cases can't be
   demonstrated: an hourly part-timer with **no pay rate**, and a **previous completed period**
   so the variance comparison has something to compare against. This needs a change to
   `001_sample_data.sql`, which UC-003 doesn't own.
3. **Should an idle part-timer block submission?** Zero hours currently produces
   `NO_HOURS_RECORDED` → incomplete → submission blocked. That's right for a genuine data gap
   and wrong for someone who simply didn't work this period.
4. **Confirm the ±$100,000 bounds** on adjustment amounts and performance-input values —
   currently a placeholder, marked `TODO(verify)` in the code.
5. **Is `calculated` ratified as a status?** UC-003 introduced it between `validated` and
   `pending_approval`; UC-004 needs to agree.
6. **`docker-compose.yml` improvements** (recommendations only — it's shared infrastructure
   and UC-003 must not modify it): add a healthcheck, make the host port configurable so a
   native Postgres install can't conflict on 5432, and remove the obsolete `version:`
   attribute that Docker now warns about on every command.

### Integration still ahead

- **UC-002** must actually freeze timesheets; UC-003 reads only `is_frozen = true`,
  `match_status = 'matched'` rows.
- **UC-004** picks up periods at `pending_approval` and owns the `approved` transition.
  UC-003 already refuses to touch a period once it's `approved` or `paid`.

---

## 6. Known issues and things to watch out for

### `db:reset` deletes your login — every time

It drops the Docker volume, so the `users` table goes with it. **Re-register after every
reset.** The app now handles this gracefully (you get dropped to the login screen with an
explanation rather than a foreign-key error), but the account really is gone. Before that
guard existed, this surfaced as a baffling `calculation_runs_run_by_fkey` error on the first
calculate — the browser was holding a still-valid JWT for a user that no longer existed.

### Restart the backend after backend changes

`npm start` does not watch files. If you add a route and it 404s, the server is stale rather
than the route being wrong — this wasted time twice during the build. **Use `npm run dev`**
(nodemon) instead.

### Port 5432 conflicts with a native Postgres install

If you've ever installed PostgreSQL natively on Windows, check Services for
`postgresql-x64-*` and disable it. It will silently win the port and Docker's database will
be unreachable in a way that looks like a code bug.

### Registration requires a name of at least 2 characters

A 1-character name returns `400` and looks, from the login screen, like bad credentials. This
cost real debugging time during a phase gate; there's now a Postman request pinning the behaviour.

### The seeded period intentionally has an incomplete line

S003 has no performance input, so the first calculate always yields one incomplete line and
`submit-approval` correctly returns `422`. Use the **Resolve** button — this is the demo, not
a defect.

### Test suites share one database

They clean up after themselves via `afterAll`, but a suite killed midway (Ctrl-C) can leave
rows behind. Each suite defensively re-runs its cleanup in `beforeAll`, so a re-run recovers.
`npm test` runs with `--runInBand` deliberately — parallel workers would fight over the
shared database.

### Two deliberate deviations from the guide's §4.0

The environment variable is `APP_SECRET` (not `JWT_SECRET`), and the backend runs on port
5000. These match the existing repo rather than the guide. Similarly, the repo uses **UUID**
primary keys and a **singular `pay_period`** table where the guide assumed `SERIAL` and
`pay_periods`.

### The Postman collection mutates data

Running the whole collection calculates, recalculates, voids a run, and creates then deletes
records. Run `npm run db:reset` before demoing afterwards. The collection's first `calculate`
request strictly expects `201`, which requires a **validated** period — so reset before
running it too.

---

## 7. Where to look first

| If you need to… | Read |
|---|---|
| Understand the maths | `backend/src/services/calculationEngine.js` — pure, no I/O, heavily commented |
| Understand runs and state transitions | `backend/src/services/runService.js` |
| Call the API | `docs/API.md`, then `docs/UC-003.postman_collection.json` |
| See the business rules summarised | The UC-003 section of `README.md` |
| Change a statutory rate | Don't edit one — POST a new rate set version |

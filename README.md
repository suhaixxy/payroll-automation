# Payroll Automation

## Stack
React + Vite (frontend) · Node.js + Express (backend) · PostgreSQL via Docker

## Prerequisites
- Node.js 18+ or 20+
- Docker Desktop (with WSL2 enabled on Windows)
- **Important (Windows users):** if you've ever installed PostgreSQL natively before, make sure it's not running as a background service (check Windows Services for anything named `postgresql-x64-...` and disable it) — it will silently conflict with Docker on port 5432.

## Setup — Backend
1. Clone the repo and check out your feature branch
2. `cp .env.example .env` (in the project root)
3. `cp .env backend/.env` — the backend reads its `.env` from inside `backend/`, so it needs its own copy
4. `docker compose up -d` — starts the PostgreSQL container
5. `cd backend && npm install`
6. `npm run migrate` — creates all database tables
7. `npm run seed` — adds sample staff + one sample pay period
8. `npm run dev` — starts the backend server
9. Confirm it works: visit `http://localhost:5000/health` — should show `{"status":"ok","database":"connected"}`

## Setup — Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Visit `http://localhost:5173/` — you should see the nav bar and Dashboard page, with a "Backend connection test" showing the same `{"status":"ok","database":"connected"}` (requires the backend to be running too, from the steps above)

## Database scripts (run from the repo root)

These wrap Docker Compose so nobody has to remember the flags:

| Command | What it does |
|---|---|
| `npm run db:up` | Start the PostgreSQL container |
| `npm run db:down` | Stop it (data survives) |
| `npm run db:nuke` | Stop it **and delete the volume** — all data gone |
| `npm run db:wait` | Block until Postgres accepts connections (used by the other scripts) |
| `npm run db:migrate` | Apply any migrations not yet recorded in `schema_migrations` |
| `npm run db:seed` | Load the demo data |
| `npm run db:reset` | nuke → up → wait → migrate → seed. The one-liner for "give me a clean database" |
| `npm run db:psql` | Open a psql shell inside the container |

> ⚠️ **`db:reset` deletes the `users` table too.** Your logged-in account disappears
> with it, so **re-register after every reset**. The app now detects this and drops you
> back to the login screen with an explanation instead of failing with a database error.

## Branching
main → dev → feature/uc-00X-name. PR into dev, 1 reviewer required.
No direct commits to main or dev.

## Commit convention
feat(uc-00X): ...
fix(uc-00X): ...
docs(api): ...
test(uc-00X): ...

## Database
- Migrations live in `backend/src/db/migrations/`, numbered in order (001, 002, ...)
- Never edit an existing migration file after it's merged — add a new numbered one instead
- Seed data lives in `backend/src/db/seeds/`

## Frontend structure
- Pages live in `frontend/src/pages/` — one file per UC, plus `DashboardPage.jsx`
- Dashboard and login are shared infrastructure, not owned by any single UC — to be finalized as a team decision
- API calls go through `frontend/src/api/client.js` (`apiGet`, `apiPost`) rather than raw `fetch` calls scattered across pages
- User-facing labels use **domain language** ("Payroll Calculation"), never use-case
  numbers. `UC-00X` belongs in code comments and docs only.

---

# UC-003 — Payroll Calculation (Owner: Robert)

Calculates pay for a validated pay period from its frozen timesheet snapshot, then hands
the result to UC-004 for approval.

**Full API reference:** [`docs/API.md`](docs/API.md#uc-003--payroll-calculation-owner-robert) ·
**Postman collection:** [`docs/UC-003.postman_collection.json`](docs/UC-003.postman_collection.json)

## Try it in 60 seconds

```bash
npm run db:reset                 # from the repo root — clean database + demo data
cd backend  && npm run dev       # http://localhost:5000
cd frontend && npm run dev       # http://localhost:5173
```

Then in the browser: **register an account with the `manager` role** → open
**Payroll Calculation** → the July 2026 period is already `validated` → **Calculate
Payroll**. Try **Details** on a line, the **Run History** tab, and **Export CSV**.

## What it does

1. **Loads a frozen snapshot** — only `is_frozen = true`, `matched` timesheet rows count,
   so a run can never be moved by later edits upstream.
2. **Calculates each staff line** — part-timer gross from hours × rate (with OT and
   public-holiday multipliers), full-timer incentives from performance inputs, then
   one-off adjustments, CPF by age band, and SDL.
3. **Writes an immutable numbered run** — pinned forever to the statutory rate set it
   used, with a stored step-by-step breakdown per line.
4. **Flags incomplete lines** rather than guessing, and excludes them from all totals.
5. **A manager submits** the calculated period to approval.

## Business rules that matter

**Money is never a float.** New tables store `NUMERIC(12,2)`; all arithmetic happens in
integer cents (and basis points for rates, where 1bp = 0.01%). The API returns amounts
as decimal **strings** — parse them as decimals.

**Runs are immutable.** Recalculating creates run #2, #3 … and never overwrites. Only
the *latest non-voided complete* run is authoritative. Voiding requires a written reason.
Once a period is `approved` or `paid`, UC-003 refuses to touch it (`409 PERIOD_LOCKED`).

**Status flow** (shared contract in [`shared/payrollStatus.json`](shared/payrollStatus.json),
read by both backend and frontend so the two can never drift):

```
draft → validated → calculated → pending_approval → approved → paid
                └── UC-003 owns these two transitions ──┘
```

**SDL is employer-borne.** `net = gross − CPF(employee)`. SDL and employer CPF are costs
*on top of* pay and are never deducted from the employee — the UI labels them
"Employer Cost" for exactly this reason.

**CPF uses the CPF Board's official rounding**, not a blanket round-half-up: the *total*
contribution is rounded to the nearest dollar, the *employee* share is rounded **down** to
the dollar, and the employer share is the difference. This deliberately deviates from the
implementation guide's simpler rule, because matching the Board is what makes the figures
defensible in an audit.

**CPF wage base ≠ gross.** Only `cpf_applicable` adjustments enter the CPF base, so a
non-CPF deduction reduces take-home pay without reducing CPF. The base is clamped at ≥ 0.

**Statutory figures** (verified against cpf.gov.sg / mom.gov.sg on 2026-08-06, sources
cited in [`030_uc003_seed.sql`](backend/src/db/seeds/030_uc003_seed.sql)):
CPF 20% employee / 17% employer up to age 55, tapering to 5% / 7.5% above 70;
$8,000 Ordinary Wage ceiling; SDL 0.25% on the first $4,500, min $2.00 / max $11.25;
OT ≥ 1.5×; public-holiday work = an extra day's pay (2.0×); no employee CPF share at or
below $500 in total wages.

**Rate sets are versioned, never edited** — a new version supersedes the old one by
closing its `effective_to`. Editing one in place would silently rewrite the history of
every run pinned to it.

## Testing

```bash
cd backend
npm test               # 12 suites, 76 tests
npm run test:coverage  # scoped to UC-003 files, with enforced thresholds
```

Coverage is scoped to UC-003-owned files in `jest.config.js` — including the other use
cases' unbuilt files would dilute the number into meaninglessness. Thresholds **fail the
run** if breached: 95/90/100/95 on the calculation engine (the money-critical file),
80/65/85/80 globally.

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `calculationEngine.js` | 99.0% | 94.3% | 100% | 100% |
| `runService.js` | 89.3% | 74.3% | 90.9% | 95.4% |
| `uc003AuditService.js` | 100% | 85.7% | 100% | 100% |
| **All UC-003 files** | **82.9%** | **71.5%** | **94.4%** | **87.7%** |

Integration suites each use their own isolated date window (2030, 2031, 2032, 2099) with
`beforeAll`/`afterAll` cleanup, so they never collide with the seeded 2026 demo data or
with each other.

## Known gaps & open team questions

- **Pay-rate ownership (§3.3)** — nobody owns writing to `pay_rate`. UC-003 reads it and
  raises `MISSING_PAY_RATE` when it's absent. Needs a decision.
- **Seed data is thin** — only 3 staff (S001–S003) and one pay period. Two useful cases
  can't be demoed until `001_sample_data.sql` grows: an hourly part-timer with **no pay
  rate**, and a **previous completed period** so the variance comparison has something to
  compare against.
- **Idle part-timers block submission** — a part-timer with zero hours produces
  `NO_HOURS_RECORDED`, which is incomplete, which blocks submit-approval. Correct for a
  genuine data gap, wrong for someone who simply didn't work. Needs a team rule.
- **±$100,000 bounds** on adjustment amounts and performance-input values are a
  placeholder — the team should confirm the real limits.
- **$500–$750 CPF phase-in is simplified** — full employee rates apply from $500 rather
  than the official graduated band. Documented in the seed file.
- **`docker-compose.yml` has no healthcheck** and hardcodes port 5432. Recommended (not
  changed — it's shared team infrastructure): add a healthcheck and make the host port
  configurable so a native Postgres install can't conflict.
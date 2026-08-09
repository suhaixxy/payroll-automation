# Payroll Automation System

## Overview

Payroll Automation is an integrated full-stack application that carries payroll data from roster import through validation, calculation, approval, payment processing and employee payslips. The five use cases share a PostgreSQL data model and an authenticated React interface.

## Key Features

- **UC-001 — Roster and timesheet synchronization:** imports published roster CSV data, manages staff and pay periods, tracks sync history and resolves roster exceptions.
- **UC-002 — Timesheet validation:** reviews timesheets and exceptions, applies validation decisions and freezes accepted payroll input.
- **UC-003 — Payroll calculation:** creates versioned calculation runs and canonical `payroll_lines`, including statutory rates, adjustments, performance inputs, variance checks and CSV export.
- **UC-004 — Payroll approval:** reviews payroll summaries and lines, records approval decisions and locks approved periods.
- **UC-005 — Payment processing and payslips:** validates payment readiness and bank details, generates Payment Batches and CSV/GIRO files, performs mock HRMS sync/retry/cancellation, creates protected payslips/PDFs and records audit events.

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, Material UI, Axios |
| Backend | Node.js, Express 4, Sequelize 6, `pg` |
| Database | PostgreSQL 16, SQL migrations and integrated SQL seeds, Docker Compose locally |
| Security | JWT, bcrypt, Helmet, CORS, login rate limiting, role authorization |
| Testing | Jest, Supertest, disposable PostgreSQL test databases |
| Intended deployment | Vercel frontend, Render backend, managed PostgreSQL; not deployed yet |

## Repository Structure

```text
frontend/       React/Vite application
backend/        Express API, services, models, migrations, seeds and tests
shared/         Cross-UC status contracts
docs/           Group and individual technical documentation
tests/          Individual submission evidence (excluded from backend Jest discovery)
ai/             Individual AI-use evidence and reflections
```

## Prerequisites

- Node.js and npm compatible with the committed dependencies
- Docker Desktop with Docker Compose
- Git

No unsupported Node.js version is asserted by the package configuration. Use a currently supported Node.js release that can install the lockfiles successfully.

## Local Setup

```bash
git clone <repository-url>
cd payroll-automation

copy .env.example .env
npm run db:up
npm run db:wait

cd backend
npm install
npm run migrate
npm run seed

cd ../frontend
npm install
```

On macOS/Linux, use `cp .env.example .env` instead of `copy`. The backend loads the root `.env`. For Vite, copy the frontend variables from `.env.example` into `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

The database commands may also be run from the repository root as `npm run db:migrate` and `npm run db:seed`.

## Environment Variables

Copy [.env.example](.env.example) and replace placeholder secrets locally. Do not commit `.env` files. Important settings include:

- `DATABASE_URL` or the component PostgreSQL variables
- `JWT_SECRET` and `JWT_EXPIRES_IN`
- `FRONTEND_URL` for CORS
- `VITE_BACKEND_URL` for frontend API requests
- `ROSTER_SHEET_CSV_URL` for the published roster CSV
- `HRMS_MODE=mock`

`GENERATE_PAY_PERIODS_ON_STARTUP` should normally remain `false`; the integrated seeds provide controlled demonstration periods.

## Database Setup

Local PostgreSQL runs in Docker on port `5432`. The migration runner applies all 20 retained migrations in `backend/src/db/migrations/` and records them in `schema_migrations`. Migration history is intentionally preserved; add a new migration rather than rewriting an applied one.

The seed runner executes these six files in order:

```text
001_shared_reference.sql
010_uc001_roster.sql
020_uc002_validation.sql
030_uc003_calculation.sql
040_uc004_approval.sql
050_uc005_payment.sql
```

The current baseline contains seven non-overlapping pay periods, including one draft period. Seeds are intended for local demonstration and testing, not production data.

Useful root commands:

| Command | Purpose |
| --- | --- |
| `npm run db:up` | Start Docker PostgreSQL |
| `npm run db:down` | Stop services while preserving the volume |
| `npm run db:wait` | Wait for PostgreSQL readiness |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Run all integrated seeds |
| `npm run db:psql` | Open a PostgreSQL shell |
| `npm run db:reset` | Destructively recreate the local volume and reload migrations/seeds |

`db:reset` deletes the local Docker volume. It is not required for normal startup and must not be used against data that needs to be retained.

## Running the Application

In separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- REST API base: `http://localhost:5000/api`
- Health check: `http://localhost:5000/health`

## Testing

Start local PostgreSQL, then run from `backend/`:

```bash
npm test
npm test -- --detectOpenHandles
npm run test:coverage
```

`npm test` automatically creates a uniquely named disposable PostgreSQL database, applies all migrations and seeds, runs the authoritative suite under `backend/tests/`, and removes the database even when Jest fails. A guard refuses to use the normal `payroll_automation` database as a destructive test target.

Current verified result: **20 suites, 183 tests, 0 failures, 0 skipped/todo**.

Frontend verification:

```bash
cd frontend
npm run lint
npm run build
```

## Deployment

The project has **not been deployed yet**.

**Public Application URL: To be added after deployment.**

Intended deployment procedure:

1. Provision a managed PostgreSQL database and set its SSL connection string as backend `DATABASE_URL`.
2. Deploy `backend/` to Render (or an equivalent Node host), install dependencies, run `npm run migrate`, optionally load demonstration seeds only when explicitly required, and start with `npm start`.
3. Configure backend production variables: `NODE_ENV=production`, a strong `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `DATABASE_URL`, `HRMS_MODE=mock`, `GENERATE_PAY_PERIODS_ON_STARTUP=false`, and integration settings that are actually used.
4. Deploy `frontend/` to Vercel (or an equivalent static host) using `npm run build` and set `VITE_BACKEND_URL` to the public backend origin.
5. Set backend `FRONTEND_URL` to the final frontend origin, rerun migrations for the target database and perform authentication, workflow, file-download and authorization smoke tests.

Do not publish local database credentials or seed passwords. HRMS remains in mock mode because no real external HRMS API is available.

## Documentation

- [System architecture](docs/architecture.md)
- [Architecture diagram](docs/architecture-diagram.png)
- Group API reference and Postman assets under `docs/`
- Individual use-case, API and database evidence under member folders such as `docs/kokenqi/`

## Team and UC Ownership

The integrated workflow is owned across the team: UC-001 roster synchronization, UC-002 validation, UC-003 calculation, UC-004 approval and UC-005 payment processing. Shared login, dashboard, layout, database infrastructure and status contracts support the complete system. Individual ownership details should be taken from the corresponding member documentation; this README does not infer names that are not recorded consistently in the repository.

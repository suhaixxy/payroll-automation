# Payroll Automation

## Stack
React + Vite (frontend) · Node.js + Express (backend) · PostgreSQL via Docker

## Prerequisites
- Node.js 18+ or 20+
- Docker Desktop (with WSL2 enabled on Windows)
- **Important (Windows users):** if you've ever installed PostgreSQL natively before, make sure it's not running as a background service (check Windows Services for anything named `postgresql-x64-...` and disable it) — it will silently conflict with Docker on port 5432.

## Setup
1. Clone the repo and check out your feature branch
2. `cp .env.example .env` (in the project root)
3. `cp .env backend/.env` — the backend reads its `.env` from inside `backend/`, so it needs its own copy
4. `docker compose up -d` — starts the PostgreSQL container
5. `cd backend && npm install`
6. `npm run migrate` — creates all database tables
7. `npm run seed` — adds sample staff + one sample pay period
8. `npm run dev` — starts the backend server
9. Confirm it works: visit `http://localhost:5000/health` — should show `{"status":"ok","database":"connected"}`

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
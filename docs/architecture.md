# System Architecture

## Overview
Payroll Automation is a full-stack app that automates payroll for a healthcare & training service provider. It replaces a manual process where staff spend hours copying roster hours into an HRMS and paying staff by hand.

## Pipeline (strictly sequential)

Roster (Google Sheets)
      down to
UC-001: Import & Sync Roster Hours - writes to staff, timesheet
      down to
UC-002: Validate & Consolidate Timesheets - writes to timesheet_exception, freezes timesheet
      down to
UC-003: Calculate Payroll & Incentives - writes to payroll_line
      down to
UC-004: Review & Approve Payroll - writes to approval
      down to
UC-005: Generate Payment File & Sync to HRMS - writes to payment_batch

## Tech Stack
- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: PostgreSQL (running in Docker)
- Integrations: Google Sheets (published CSV export) for roster import; HRMS and banking/GIRO file generation are currently stubbed pending real API access

## Folder Structure

payroll-automation/
- backend/
  - src/
    - adapters/ - external integrations (Google Sheets, HRMS, banking)
    - config/ - database connection
    - controllers/ - request handlers (one per UC)
    - db/ - migrations and seed data
    - middleware/ - logging, error handling
    - models/ - data models (one per table)
    - routes/ - API routes (one per UC)
    - services/ - business logic (one per UC)
- frontend/
  - src/
    - api/ - API client (client.js)
    - pages/ - one page per UC plus Dashboard
    - components/ - shared UI pieces

## Database Schema (11 tables)
staff, pay_period, audit_log, timesheet, timesheet_exception, pay_rate, incentive_scheme, performance_input, payroll_line, approval, payment_batch

Shared foundation tables (staff, pay_period, audit_log) support all UCs. Each UC has its own dedicated table(s) built on top.

## Git Workflow
main (protected) <- dev (protected) <- feature/uc-00X-name branches
All merges require a Pull Request with 1 approval.

## Open Team Decisions (to finalize in meeting)
- Dashboard and login page: to be built as shared infrastructure, not owned by a single UC - one person ports the cleanest existing version
- HRMS/banking real API access: currently stubbed, pending real credentials/access
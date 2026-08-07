-- ==========================================================
-- Payroll Automation System
-- Login / Authentication Sample Data
-- PostgreSQL
-- ==========================================================
--
-- This file contains ONLY authentication sample accounts (table: user_account).
-- All business/payroll sample data lives in 005_sample_data.sql.
--
-- Password hashes below were generated with bcrypt at cost factor 12, matching
-- the cost factor used by the application's own hashing call
-- (backend/src/services/authService.js -> bcrypt.compare, and the historical
-- seeder backend/src/db/seeders/20260720000200-authentication-users.js which
-- called bcrypt.hash(password, 12)). No plaintext password is stored in any
-- column -- only the resulting bcrypt hash.
--
-- Development-only plaintext passwords (for local login testing ONLY,
-- never used in any INSERT value, never for production):
--   manager@payroll.local   / Manager123!
--   employee@payroll.local  / Employee123!
--   disabled@payroll.local  / Disabled123!  (status = disabled, cannot log in)
--
-- Required execution order: this file MUST run BEFORE 005_sample_data.sql.
-- 005_sample_data.sql inserts payment_batch rows whose generated_by /
-- cancelled_by columns are foreign keys to the manager account created here.
-- Running 005_sample_data.sql first will fail with a foreign-key violation.
--
-- The employee account is inserted below with staff_id = NULL. The EMP001
-- staff row (id 11111111-1111-1111-1111-111111111111) does not exist yet at
-- this point on a clean database -- it is only created later, in
-- 005_sample_data.sql. That file links the two together afterwards with an
-- UPDATE once the staff row exists (see the comment there). This avoids a
-- circular foreign-key dependency between the two seed files.
--
-- Run against a local/dev database only, e.g.:
--   psql -d payroll_automation -f backend/src/db/seeds/login_sample_data.sql
--   psql -d payroll_automation -f backend/src/db/seeds/005_sample_data.sql
-- ==========================================================

INSERT INTO user_account
(
    id,
    full_name,
    email,
    password_hash,
    role,
    staff_id,
    status
)
VALUES
(
    '81000000-0000-0000-0000-000000000002',
    'Payroll Manager',
    'manager@payroll.local',
    '$2b$12$NaG2pTu/3Jw8rHL6WJbH4uYwb0Sj8TR3FHqv7sTj/XQICjwN0VKu6',
    'manager',
    NULL,
    'active'
),
(
    -- staff_id starts NULL: the EMP001 staff row it links to does not exist
    -- yet on a clean database (staff rows are only created in
    -- 005_sample_data.sql, which runs after this file). 005_sample_data.sql
    -- backfills this to 11111111-1111-1111-1111-111111111111 (Tan Wei Ming /
    -- EMP001) once that staff row has been inserted, so this account can
    -- view that employee's own payroll lines / payslips.
    '81000000-0000-0000-0000-000000000003',
    'Tan Wei Ming',
    'employee@payroll.local',
    '$2b$12$/Vd1SeQFuIpsK2J8.1zOnOwFmKlr3ZtMr6ifhDsj/dDcY7wJrMfhC',
    'employee',
    NULL,
    'active'
),
(
    -- Demonstrates the disabled-account login path (UC login: disabled users
    -- must be rejected even with a correct password).
    '81000000-0000-0000-0000-000000000004',
    'Disabled Demonstration User',
    'disabled@payroll.local',
    '$2b$12$40XtTx/JPTD0364GHZPsg.7yJ14Ftg3y3ZTaM2n3CXPV/YFDbZJmC',
    'employee',
    NULL,
    'disabled'
)
ON CONFLICT (id) DO NOTHING;

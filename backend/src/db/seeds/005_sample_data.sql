-- ==========================================================
-- Payroll Automation System
-- Sample Data
-- PostgreSQL
-- ==========================================================

-- ==========================================================
-- STAFF
-- ==========================================================

INSERT INTO staff
(
    id,
    external_ref,
    full_name,
    employment_type,
    bank_account_no,
    bank_code,
    cpf_eligible,
    status
)
VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'EMP001',
    'Tan Wei Ming',
    'part_time',
    '123456789',
    '7171',
    TRUE,
    'active'
),
(
    '22222222-2222-2222-2222-222222222222',
    'EMP002',
    'Nurul Aisyah',
    'full_time',
    '987654321',
    '7339',
    TRUE,
    'active'
),
(
    '33333333-3333-3333-3333-333333333333',
    'EMP003',
    'Rajesh Kumar',
    'part_time',
    '345678901',
    '7375',
    TRUE,
    'active'
);

-- ==========================================================
-- LINK EMPLOYEE LOGIN TO EMP001
-- ==========================================================
-- 004_uc005_login_sample_data.sql (which runs before this file) creates the
-- employee@payroll.local account with staff_id = NULL, because the EMP001
-- staff row above did not exist yet on a clean database. Now that EMP001
-- exists, link the two. Matching by email (not id) and re-running this
-- UPDATE on every seed run keeps it idempotent.
UPDATE user_account
SET staff_id = '11111111-1111-1111-1111-111111111111'
WHERE email = 'employee@payroll.local';

-- ==========================================================
-- PAY PERIOD
-- ==========================================================

INSERT INTO pay_period
(
    id,
    start_date,
    end_date,
    status,
    is_locked,
    locked_at,
    total_gross,
    total_net
)
VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-07-01',
    '2026-07-15',
    'approved',
    TRUE,
    '2026-07-16 09:00:00',
    4000,
    3917
);

-- ==========================================================
-- PAYROLL LINES
-- ==========================================================

INSERT INTO payroll_line
(
    id,
    pay_period_id,
    staff_id,
    gross_pay,
    incentive_pay,
    cpf_amount,
    sdl_amount,
    net_pay,
    status
)
VALUES
(
    '44444444-4444-4444-4444-444444444444',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    1200,
    100,
    120,
    10,
    1170,
    'ok'
),
(
    '55555555-5555-5555-5555-555555555555',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    1800,
    200,
    180,
    15,
    1805,
    'ok'
),
(
    '66666666-6666-6666-6666-666666666666',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    1000,
    50,
    100,
    8,
    942,
    'ok'
);

-- ==========================================================
-- APPROVAL (main pay period)
-- ==========================================================

INSERT INTO approval
(
    id,
    pay_period_id,
    decision,
    approved_by,
    comment
)
VALUES
(
    'ab000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'approved',
    'Payroll Manager',
    'UC-004 approval for the main 2026-07-01 to 2026-07-15 pay period.'
);

-- ==========================================================
-- PAYMENT BATCH (main pay period)
-- Requires the manager account from 004_uc005_login_sample_data.sql
-- (id 81000000-0000-0000-0000-000000000002) to already exist.
-- ==========================================================

INSERT INTO payment_batch
(
    id,
    pay_period_id,
    batch_reference,
    file_format,
    employee_count,
    total_amount,
    status,
    hrms_sync_status,
    hrms_reference,
    generated_by,
    hrms_synced_at
)
VALUES
(
    'fb000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'PAY-20260722143603-F562F5',
    'giro',
    3,
    3917.00,
    'completed',
    'completed',
    'HRMS-SAMPLE-F562F5',
    '81000000-0000-0000-0000-000000000002',
    '2026-07-22 14:37:03'
);

-- ==========================================================
-- PAYMENT BATCH ITEMS (immutable snapshot of the main batch)
-- ==========================================================

INSERT INTO payment_batch_item
(
    id,
    payment_batch_id,
    payroll_line_id,
    staff_id,
    employee_reference,
    employee_name,
    bank_code,
    bank_account_no,
    gross_pay,
    incentive_pay,
    cpf_amount,
    sdl_amount,
    other_deduction,
    net_pay,
    payment_reference
)
VALUES
(
    'fc000000-0000-0000-0000-000000000001',
    'fb000000-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'EMP001',
    'Tan Wei Ming',
    '7171',
    '123456789',
    1200,
    100,
    120,
    10,
    0,
    1170,
    'PAY-20260722143603-F562F5-EMP001'
),
(
    'fc000000-0000-0000-0000-000000000002',
    'fb000000-0000-0000-0000-000000000001',
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'EMP002',
    'Nurul Aisyah',
    '7339',
    '987654321',
    1800,
    200,
    180,
    15,
    0,
    1805,
    'PAY-20260722143603-F562F5-EMP002'
),
(
    'fc000000-0000-0000-0000-000000000003',
    'fb000000-0000-0000-0000-000000000001',
    '66666666-6666-6666-6666-666666666666',
    '33333333-3333-3333-3333-333333333333',
    'EMP003',
    'Rajesh Kumar',
    '7375',
    '345678901',
    1000,
    50,
    100,
    8,
    0,
    942,
    'PAY-20260722143603-F562F5-EMP003'
);

-- ==========================================================
-- PAYSLIPS (generated after the main batch's HRMS sync completed)
-- ==========================================================

INSERT INTO payslip
(
    id,
    payment_batch_id,
    payroll_line_id,
    staff_id,
    payslip_reference,
    company_name,
    employee_reference,
    employee_name,
    pay_period_start,
    pay_period_end,
    gross_pay,
    incentive_pay,
    cpf_amount,
    sdl_amount,
    other_deduction,
    net_pay,
    batch_reference,
    generated_at
)
VALUES
(
    'fd000000-0000-0000-0000-000000000001',
    'fb000000-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'PS-PAY-20260722143603-F562F5-EMP001',
    'Emergencies First Aid & Rescue',
    'EMP001',
    'Tan Wei Ming',
    '2026-07-01',
    '2026-07-15',
    1200,
    100,
    120,
    10,
    0,
    1170,
    'PAY-20260722143603-F562F5',
    '2026-07-22 14:37:03'
),
(
    'fd000000-0000-0000-0000-000000000002',
    'fb000000-0000-0000-0000-000000000001',
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'PS-PAY-20260722143603-F562F5-EMP002',
    'Emergencies First Aid & Rescue',
    'EMP002',
    'Nurul Aisyah',
    '2026-07-01',
    '2026-07-15',
    1800,
    200,
    180,
    15,
    0,
    1805,
    'PAY-20260722143603-F562F5',
    '2026-07-22 14:37:03'
),
(
    'fd000000-0000-0000-0000-000000000003',
    'fb000000-0000-0000-0000-000000000001',
    '66666666-6666-6666-6666-666666666666',
    '33333333-3333-3333-3333-333333333333',
    'PS-PAY-20260722143603-F562F5-EMP003',
    'Emergencies First Aid & Rescue',
    'EMP003',
    'Rajesh Kumar',
    '2026-07-01',
    '2026-07-15',
    1000,
    50,
    100,
    8,
    0,
    942,
    'PAY-20260722143603-F562F5',
    '2026-07-22 14:37:03'
);

-- ==========================================================
-- ADDITIONAL STAFF (UC-005 scenario coverage: missing bank
-- details and an inactive/excluded employee). EMP001-EMP003
-- above are not duplicated here.
-- ==========================================================

INSERT INTO staff
(
    id,
    external_ref,
    full_name,
    employment_type,
    bank_account_no,
    bank_code,
    cpf_eligible,
    status
)
VALUES
(
    'e4444444-4444-4444-4444-444444444444',
    'EMP004',
    'Lim Jia Hui',
    'full_time',
    '765432198',
    '7375',
    TRUE,
    'active'
),
(
    -- Missing bank details on purpose: exercises the "correct missing bank
    -- details" flow before a batch can be generated.
    'e5555555-5555-5555-5555-555555555555',
    'EMP005',
    'Chloe Lee',
    'part_time',
    NULL,
    NULL,
    TRUE,
    'active'
),
(
    -- Inactive/excluded employee: should never appear in payment previews
    -- or batches even if a payroll line existed historically.
    'e6666666-6666-6666-6666-666666666666',
    'EMP006',
    'Arjun Nair',
    'full_time',
    '111222333',
    '7232',
    TRUE,
    'inactive'
);

-- ==========================================================
-- ADDITIONAL PAY PERIODS (UC-005 scenario coverage, ported and
-- adapted from the retired development-payment-test-data seeder).
-- None of these duplicate the 2026-07-01 to 2026-07-15 main period.
-- ==========================================================

INSERT INTO pay_period
(
    id,
    start_date,
    end_date,
    status,
    is_locked,
    validated_at,
    total_gross,
    total_net
)
VALUES
(
    -- MISSING-BANK: approved and locked, but the only staff member on it
    -- (EMP005) has no bank details, so payment generation must be blocked.
    '2aaaaaaa-2aaa-2aaa-2aaa-2aaaaaaaaaaa',
    '2026-06-16',
    '2026-06-30',
    'approved',
    TRUE,
    '2026-07-01 09:00:00',
    1300,
    1210
),
(
    -- HRMS-FAILED: approved, locked, batch generated, but HRMS sync failed
    -- and is retryable without regenerating the batch.
    '3aaaaaaa-3aaa-3aaa-3aaa-3aaaaaaaaaaa',
    '2026-06-01',
    '2026-06-15',
    'approved',
    TRUE,
    '2026-06-16 09:00:00',
    4000,
    3917
),
(
    -- COMPLETED: approved, locked, batch completed with payslips generated.
    '4aaaaaaa-4aaa-4aaa-4aaa-4aaaaaaaaaaa',
    '2026-05-16',
    '2026-05-31',
    'payment_ready',
    TRUE,
    '2026-06-01 09:00:00',
    4600,
    4503
),
(
    -- CANCELLED: approved, locked, batch soft-cancelled (not deleted).
    '5aaaaaaa-5aaa-5aaa-5aaa-5aaaaaaaaaaa',
    '2026-05-01',
    '2026-05-15',
    'approved',
    TRUE,
    '2026-05-16 09:00:00',
    1600,
    1528
),
(
    -- PENDING-APPROVAL: still awaiting UC-004 approval, not locked, so it
    -- correctly cannot have a payment batch yet.
    '6aaaaaaa-6aaa-6aaa-6aaa-6aaaaaaaaaaa',
    '2026-04-16',
    '2026-04-30',
    'pending_approval',
    FALSE,
    NULL,
    3000,
    2975
),
(
    -- EMPTY: approved and locked with zero staff and zero payroll lines,
    -- an honest empty state that Payment Preview must render without error.
    '7aaaaaaa-7aaa-7aaa-7aaa-7aaaaaaaaaaa',
    '2026-04-01',
    '2026-04-15',
    'approved',
    TRUE,
    '2026-04-16 09:00:00',
    0,
    0
),
(
    -- HAPPY-PATH: approved and locked with valid bank details and payroll
    -- lines, but no seeded payment output, so UC-005 generation can succeed.
    '8aaaaaaa-8aaa-8aaa-8aaa-8aaaaaaaaaaa',
    '2026-07-16',
    '2026-07-31',
    'approved',
    TRUE,
    '2026-08-01 09:00:00',
    3000,
    2975
);

-- ==========================================================
-- APPROVALS for the additional approved pay periods (all except
-- PENDING-APPROVAL, which is intentionally not yet decided).
-- ==========================================================

INSERT INTO approval
(
    id,
    pay_period_id,
    decision,
    approved_by,
    comment
)
VALUES
(
    'ab000000-0000-0000-0000-000000000002',
    '2aaaaaaa-2aaa-2aaa-2aaa-2aaaaaaaaaaa',
    'approved',
    'Payroll Manager',
    'UC-005 test approval for MISSING-BANK.'
),
(
    'ab000000-0000-0000-0000-000000000003',
    '3aaaaaaa-3aaa-3aaa-3aaa-3aaaaaaaaaaa',
    'approved',
    'Payroll Manager',
    'UC-005 test approval for HRMS-FAILED.'
),
(
    'ab000000-0000-0000-0000-000000000004',
    '4aaaaaaa-4aaa-4aaa-4aaa-4aaaaaaaaaaa',
    'approved',
    'Payroll Manager',
    'UC-005 test approval for COMPLETED.'
),
(
    'ab000000-0000-0000-0000-000000000005',
    '5aaaaaaa-5aaa-5aaa-5aaa-5aaaaaaaaaaa',
    'approved',
    'Payroll Manager',
    'UC-005 test approval for CANCELLED.'
),
(
    'ab000000-0000-0000-0000-000000000007',
    '7aaaaaaa-7aaa-7aaa-7aaa-7aaaaaaaaaaa',
    'approved',
    'Payroll Manager',
    'UC-005 test approval for EMPTY.'
),
(
    'ac000000-0000-0000-0000-000000000008',
    '8aaaaaaa-8aaa-8aaa-8aaa-8aaaaaaaaaaa',
    'approved',
    'Payroll Manager',
    'UC-005 happy-path approval for successful payment generation testing.'
);

-- ==========================================================
-- ADDITIONAL PAYROLL LINES for the scenario pay periods above.
-- ==========================================================

INSERT INTO payroll_line
(
    id,
    pay_period_id,
    staff_id,
    gross_pay,
    incentive_pay,
    cpf_amount,
    sdl_amount,
    net_pay,
    status
)
VALUES
(
    -- MISSING-BANK line for EMP005 (no bank details on the staff record).
    'cb000000-0000-0000-0000-000000000021',
    '2aaaaaaa-2aaa-2aaa-2aaa-2aaaaaaaaaaa',
    'e5555555-5555-5555-5555-555555555555',
    1300,
    50,
    130,
    10,
    1210,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000031',
    '3aaaaaaa-3aaa-3aaa-3aaa-3aaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    1200,
    100,
    120,
    10,
    1170,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000032',
    '3aaaaaaa-3aaa-3aaa-3aaa-3aaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    1800,
    200,
    180,
    15,
    1805,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000033',
    '3aaaaaaa-3aaa-3aaa-3aaa-3aaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    1000,
    50,
    100,
    8,
    942,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000041',
    '4aaaaaaa-4aaa-4aaa-4aaa-4aaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    1200,
    100,
    120,
    10,
    1170,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000042',
    '4aaaaaaa-4aaa-4aaa-4aaa-4aaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    1800,
    200,
    180,
    15,
    1805,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000044',
    '4aaaaaaa-4aaa-4aaa-4aaa-4aaaaaaaaaaa',
    'e4444444-4444-4444-4444-444444444444',
    1600,
    100,
    160,
    12,
    1528,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000054',
    '5aaaaaaa-5aaa-5aaa-5aaa-5aaaaaaaaaaa',
    'e4444444-4444-4444-4444-444444444444',
    1600,
    100,
    160,
    12,
    1528,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000061',
    '6aaaaaaa-6aaa-6aaa-6aaa-6aaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    1200,
    100,
    120,
    10,
    1170,
    'ok'
),
(
    'cb000000-0000-0000-0000-000000000062',
    '6aaaaaaa-6aaa-6aaa-6aaa-6aaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    1800,
    200,
    180,
    15,
    1805,
    'ok'
),
(
    -- HAPPY-PATH lines use only active staff with valid bank details.
    'cc000000-0000-0000-0000-000000000081',
    '8aaaaaaa-8aaa-8aaa-8aaa-8aaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    1200,
    100,
    120,
    10,
    1170,
    'ok'
),
(
    'cc000000-0000-0000-0000-000000000082',
    '8aaaaaaa-8aaa-8aaa-8aaa-8aaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    1800,
    200,
    180,
    15,
    1805,
    'ok'
);

-- ==========================================================
-- ADDITIONAL PAYMENT BATCHES (HRMS-FAILED, COMPLETED, CANCELLED).
-- MISSING-BANK, PENDING-APPROVAL, EMPTY and HAPPY-PATH intentionally
-- have no payment batch. HAPPY-PATH is reserved for real generation.
-- ==========================================================

INSERT INTO payment_batch
(
    id,
    pay_period_id,
    batch_reference,
    file_format,
    employee_count,
    total_amount,
    status,
    hrms_sync_status,
    hrms_error_message,
    generated_by
)
VALUES
(
    'fb000000-0000-0000-0000-000000000003',
    '3aaaaaaa-3aaa-3aaa-3aaa-3aaaaaaaaaaa',
    'PAY-20260616090500-HRMSFAIL',
    'giro',
    3,
    3917.00,
    'hrms_sync_failed',
    'failed',
    'Mock HRMS synchronisation failed for UC-005 retry testing.',
    '81000000-0000-0000-0000-000000000002'
);

INSERT INTO payment_batch
(
    id,
    pay_period_id,
    batch_reference,
    file_format,
    employee_count,
    total_amount,
    status,
    hrms_sync_status,
    hrms_reference,
    generated_by,
    hrms_synced_at
)
VALUES
(
    'fb000000-0000-0000-0000-000000000004',
    '4aaaaaaa-4aaa-4aaa-4aaa-4aaaaaaaaaaa',
    'PAY-20260601090500-COMPLETE',
    'giro',
    3,
    4503.00,
    'completed',
    'completed',
    'HRMS-SAMPLE-COMPLETE',
    '81000000-0000-0000-0000-000000000002',
    '2026-06-01 09:06:00'
);

INSERT INTO payment_batch
(
    id,
    pay_period_id,
    batch_reference,
    file_format,
    employee_count,
    total_amount,
    status,
    hrms_sync_status,
    generated_by,
    cancelled_by,
    cancelled_at,
    cancellation_reason
)
VALUES
(
    'fb000000-0000-0000-0000-000000000005',
    '5aaaaaaa-5aaa-5aaa-5aaa-5aaaaaaaaaaa',
    'PAY-20260516090500-CANCELLED',
    'giro',
    1,
    1528.00,
    'cancelled',
    'not_started',
    '81000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    '2026-05-16 09:07:00',
    'Cancelled sample batch for UC-005 cancellation testing.'
);

-- ==========================================================
-- ADDITIONAL PAYMENT BATCH ITEMS
-- ==========================================================

INSERT INTO payment_batch_item
(
    id,
    payment_batch_id,
    payroll_line_id,
    staff_id,
    employee_reference,
    employee_name,
    bank_code,
    bank_account_no,
    gross_pay,
    incentive_pay,
    cpf_amount,
    sdl_amount,
    other_deduction,
    net_pay,
    payment_reference
)
VALUES
(
    'fc000000-0000-0000-0000-000000000031',
    'fb000000-0000-0000-0000-000000000003',
    'cb000000-0000-0000-0000-000000000031',
    '11111111-1111-1111-1111-111111111111',
    'EMP001',
    'Tan Wei Ming',
    '7171',
    '123456789',
    1200,
    100,
    120,
    10,
    0,
    1170,
    'PAY-20260616090500-HRMSFAIL-EMP001'
),
(
    'fc000000-0000-0000-0000-000000000032',
    'fb000000-0000-0000-0000-000000000003',
    'cb000000-0000-0000-0000-000000000032',
    '22222222-2222-2222-2222-222222222222',
    'EMP002',
    'Nurul Aisyah',
    '7339',
    '987654321',
    1800,
    200,
    180,
    15,
    0,
    1805,
    'PAY-20260616090500-HRMSFAIL-EMP002'
),
(
    'fc000000-0000-0000-0000-000000000033',
    'fb000000-0000-0000-0000-000000000003',
    'cb000000-0000-0000-0000-000000000033',
    '33333333-3333-3333-3333-333333333333',
    'EMP003',
    'Rajesh Kumar',
    '7375',
    '345678901',
    1000,
    50,
    100,
    8,
    0,
    942,
    'PAY-20260616090500-HRMSFAIL-EMP003'
),
(
    'fc000000-0000-0000-0000-000000000041',
    'fb000000-0000-0000-0000-000000000004',
    'cb000000-0000-0000-0000-000000000041',
    '11111111-1111-1111-1111-111111111111',
    'EMP001',
    'Tan Wei Ming',
    '7171',
    '123456789',
    1200,
    100,
    120,
    10,
    0,
    1170,
    'PAY-20260601090500-COMPLETE-EMP001'
),
(
    'fc000000-0000-0000-0000-000000000042',
    'fb000000-0000-0000-0000-000000000004',
    'cb000000-0000-0000-0000-000000000042',
    '22222222-2222-2222-2222-222222222222',
    'EMP002',
    'Nurul Aisyah',
    '7339',
    '987654321',
    1800,
    200,
    180,
    15,
    0,
    1805,
    'PAY-20260601090500-COMPLETE-EMP002'
),
(
    'fc000000-0000-0000-0000-000000000044',
    'fb000000-0000-0000-0000-000000000004',
    'cb000000-0000-0000-0000-000000000044',
    'e4444444-4444-4444-4444-444444444444',
    'EMP004',
    'Lim Jia Hui',
    '7375',
    '765432198',
    1600,
    100,
    160,
    12,
    0,
    1528,
    'PAY-20260601090500-COMPLETE-EMP004'
),
(
    'fc000000-0000-0000-0000-000000000054',
    'fb000000-0000-0000-0000-000000000005',
    'cb000000-0000-0000-0000-000000000054',
    'e4444444-4444-4444-4444-444444444444',
    'EMP004',
    'Lim Jia Hui',
    '7375',
    '765432198',
    1600,
    100,
    160,
    12,
    0,
    1528,
    'PAY-20260516090500-CANCELLED-EMP004'
);

-- ==========================================================
-- ADDITIONAL PAYSLIPS (only the COMPLETED batch reached a
-- successful HRMS sync, which is what triggers payslip generation).
-- ==========================================================

INSERT INTO payslip
(
    id,
    payment_batch_id,
    payroll_line_id,
    staff_id,
    payslip_reference,
    company_name,
    employee_reference,
    employee_name,
    pay_period_start,
    pay_period_end,
    gross_pay,
    incentive_pay,
    cpf_amount,
    sdl_amount,
    other_deduction,
    net_pay,
    batch_reference,
    generated_at
)
VALUES
(
    'fd000000-0000-0000-0000-000000000041',
    'fb000000-0000-0000-0000-000000000004',
    'cb000000-0000-0000-0000-000000000041',
    '11111111-1111-1111-1111-111111111111',
    'PS-PAY-20260601090500-COMPLETE-EMP001',
    'Emergencies First Aid & Rescue',
    'EMP001',
    'Tan Wei Ming',
    '2026-05-16',
    '2026-05-31',
    1200,
    100,
    120,
    10,
    0,
    1170,
    'PAY-20260601090500-COMPLETE',
    '2026-06-01 09:06:00'
),
(
    'fd000000-0000-0000-0000-000000000042',
    'fb000000-0000-0000-0000-000000000004',
    'cb000000-0000-0000-0000-000000000042',
    '22222222-2222-2222-2222-222222222222',
    'PS-PAY-20260601090500-COMPLETE-EMP002',
    'Emergencies First Aid & Rescue',
    'EMP002',
    'Nurul Aisyah',
    '2026-05-16',
    '2026-05-31',
    1800,
    200,
    180,
    15,
    0,
    1805,
    'PAY-20260601090500-COMPLETE',
    '2026-06-01 09:06:00'
),
(
    'fd000000-0000-0000-0000-000000000044',
    'fb000000-0000-0000-0000-000000000004',
    'cb000000-0000-0000-0000-000000000044',
    'e4444444-4444-4444-4444-444444444444',
    'PS-PAY-20260601090500-COMPLETE-EMP004',
    'Emergencies First Aid & Rescue',
    'EMP004',
    'Lim Jia Hui',
    '2026-05-16',
    '2026-05-31',
    1600,
    100,
    160,
    12,
    0,
    1528,
    'PAY-20260601090500-COMPLETE',
    '2026-06-01 09:06:00'
);

-- ==========================================================
-- ADDITIONAL STAFF
-- EMP007-EMP020 extend the UC-005 demonstration roster. EMP018
-- intentionally has no bank details; EMP020 is intentionally inactive.
-- ==========================================================

INSERT INTO staff
(
    id,
    external_ref,
    full_name,
    employment_type,
    bank_account_no,
    bank_code,
    cpf_eligible,
    status
)
VALUES
('d5000000-0000-4000-8000-000000000007', 'EMP007', 'Siti Nur Izzati', 'full_time', '210700001', '7171', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000008', 'EMP008', 'Marcus Lim Jun Jie', 'part_time', '210800002', '7339', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000009', 'EMP009', 'Priya Devi', 'full_time', '210900003', '7375', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000010', 'EMP010', 'Muhammad Faizal Bin Abdul Rahman', 'part_time', '211000004', '7232', TRUE, 'active'),
(
    -- CPF is deliberately zero on this employee's payroll lines.
    'd5000000-0000-4000-8000-000000000011', 'EMP011', 'Ong Shi En',
    'part_time', '211100005', '7171', FALSE, 'active'
),
('d5000000-0000-4000-8000-000000000012', 'EMP012', 'Goh Pei Xuan', 'full_time', '211200006', '7339', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000013', 'EMP013', 'Ahmad Hakim', 'part_time', '211300007', '7375', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000014', 'EMP014', 'Rachel Teo Xin Yi', 'full_time', '211400008', '7232', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000015', 'EMP015', 'Karthik Subramaniam', 'part_time', '211500009', '7171', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000016', 'EMP016', 'Farah Nadiah Binte Ismail', 'full_time', '211600010', '7339', TRUE, 'active'),
('d5000000-0000-4000-8000-000000000017', 'EMP017', 'Benjamin Koh Wei Lun', 'part_time', '211700011', '7375', TRUE, 'active'),
(
    -- Active and intentionally missing both required bank fields.
    'd5000000-0000-4000-8000-000000000018', 'EMP018', 'Low Mei Qi',
    'part_time', NULL, NULL, TRUE, 'active'
),
('d5000000-0000-4000-8000-000000000019', 'EMP019', 'Vikneshwaran S/O Ramasamy', 'full_time', '211900013', '7232', TRUE, 'active'),
(
    -- Valid historical details, but excluded from all new batch scenarios.
    'd5000000-0000-4000-8000-000000000020', 'EMP020', 'Grace Wong Li Ting',
    'full_time', '212000014', '7171', TRUE, 'inactive'
);

-- ==========================================================
-- LARGE GENERATION TEST PERIOD
-- Approved, locked and deliberately has no payment batch. All 12 payroll
-- lines belong to active staff with valid bank details.
-- ==========================================================

INSERT INTO pay_period
(
    id, start_date, end_date, status, validated_at,
    total_gross, total_net, is_locked, locked_at
)
VALUES
(
    'd5100000-0000-4000-8000-000000000001',
    '2026-08-01',
    '2026-08-15',
    'approved',
    '2026-08-16 08:30:00',
    19480.00,
    19667.00,
    TRUE,
    '2026-08-16 09:00:00'
);

INSERT INTO approval
(
    id, pay_period_id, decision, approved_by, comment, decided_at
)
VALUES
(
    'd5200000-0000-4000-8000-000000000001',
    'd5100000-0000-4000-8000-000000000001',
    'approved',
    'Payroll Manager',
    'Approved large 12-employee payroll for Generate Payment Batch demonstration.',
    '2026-08-16 08:55:00'
);

INSERT INTO payroll_line
(
    id, pay_period_id, staff_id, gross_pay, incentive_pay,
    cpf_amount, sdl_amount, net_pay, status
)
VALUES
('d5300000-0000-4000-8000-000000000001', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000007', 1450.00,   0.00, 145.00, 11.00, 1294.00, 'ok'),
('d5300000-0000-4000-8000-000000000002', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000008', 1100.00,  90.00, 110.00,  9.00, 1071.00, 'ok'),
('d5300000-0000-4000-8000-000000000003', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000009', 2200.00, 180.00, 220.00, 16.00, 2144.00, 'ok'),
('d5300000-0000-4000-8000-000000000004', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000010',  980.00,  60.00,  98.00,  8.00,  934.00, 'ok'),
('d5300000-0000-4000-8000-000000000005', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000011', 1250.00, 120.00,   0.00, 10.00, 1360.00, 'ok'),
('d5300000-0000-4000-8000-000000000006', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000012', 2400.00, 250.00, 240.00, 18.00, 2392.00, 'ok'),
('d5300000-0000-4000-8000-000000000007', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000013', 1050.00,  40.00, 105.00,  8.00,  977.00, 'ok'),
('d5300000-0000-4000-8000-000000000008', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000014', 2300.00, 850.00, 230.00, 18.00, 2902.00, 'ok'),
('d5300000-0000-4000-8000-000000000009', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000015',  900.00,  35.00,  90.00,  7.00,  838.00, 'ok'),
('d5300000-0000-4000-8000-000000000010', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000016', 2100.00, 160.00, 210.00, 16.00, 2034.00, 'ok'),
('d5300000-0000-4000-8000-000000000011', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000017', 1150.00,  75.00, 115.00,  9.00, 1101.00, 'ok'),
('d5300000-0000-4000-8000-000000000012', 'd5100000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000019', 2600.00, 300.00, 260.00, 20.00, 2620.00, 'ok');

-- ==========================================================
-- MISSING BANK TEST PERIOD
-- Approved and locked with no payment batch. EMP018 deliberately blocks
-- readiness while EMP007 and EMP008 demonstrate otherwise valid rows.
-- ==========================================================

INSERT INTO pay_period
(
    id, start_date, end_date, status, validated_at,
    total_gross, total_net, is_locked, locked_at
)
VALUES
(
    'd5100000-0000-4000-8000-000000000002',
    '2026-08-16',
    '2026-08-31',
    'approved',
    '2026-09-01 08:30:00',
    3850.00,
    3625.00,
    TRUE,
    '2026-09-01 09:00:00'
);

INSERT INTO approval
(
    id, pay_period_id, decision, approved_by, comment, decided_at
)
VALUES
(
    'd5200000-0000-4000-8000-000000000002',
    'd5100000-0000-4000-8000-000000000002',
    'approved',
    'Payroll Manager',
    'Approved payroll retained for missing-bank readiness validation.',
    '2026-09-01 08:55:00'
);

INSERT INTO payroll_line
(
    id, pay_period_id, staff_id, gross_pay, incentive_pay,
    cpf_amount, sdl_amount, net_pay, status
)
VALUES
('d5300000-0000-4000-8000-000000000013', 'd5100000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000007', 1450.00,   0.00, 145.00, 11.00, 1294.00, 'ok'),
('d5300000-0000-4000-8000-000000000014', 'd5100000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000008', 1100.00,  90.00, 110.00,  9.00, 1071.00, 'ok'),
('d5300000-0000-4000-8000-000000000015', 'd5100000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000018', 1300.00, 100.00, 130.00, 10.00, 1260.00, 'ok');

-- ==========================================================
-- PAYMENT BATCH STATUS PERIODS AND APPROVALS
-- Each batch below owns a separate approved and locked period.
-- ==========================================================

INSERT INTO pay_period
(
    id, start_date, end_date, status, validated_at,
    total_gross, total_net, is_locked, locked_at
)
VALUES
('d5100000-0000-4000-8000-000000000003', '2026-09-01', '2026-09-15', 'approved', '2026-09-16 08:30:00', 3800.00, 3691.00, TRUE, '2026-09-16 09:00:00'),
('d5100000-0000-4000-8000-000000000004', '2026-09-16', '2026-09-30', 'approved', '2026-10-01 08:30:00', 2400.00, 2457.00, TRUE, '2026-10-01 09:00:00'),
('d5100000-0000-4000-8000-000000000005', '2026-10-01', '2026-10-15', 'approved', '2026-10-16 08:30:00', 3600.00, 3483.00, TRUE, '2026-10-16 09:00:00'),
('d5100000-0000-4000-8000-000000000006', '2026-10-16', '2026-10-31', 'approved', '2026-11-01 08:30:00', 5450.00, 5469.00, TRUE, '2026-11-01 09:00:00'),
('d5100000-0000-4000-8000-000000000007', '2026-11-01', '2026-11-15', 'approved', '2026-11-16 08:30:00', 3900.00, 3791.00, TRUE, '2026-11-16 09:00:00');

INSERT INTO approval
(
    id, pay_period_id, decision, approved_by, comment, decided_at
)
VALUES
('d5200000-0000-4000-8000-000000000003', 'd5100000-0000-4000-8000-000000000003', 'approved', 'Payroll Manager', 'Approval for generated batch status demonstration.', '2026-09-16 08:55:00'),
('d5200000-0000-4000-8000-000000000004', 'd5100000-0000-4000-8000-000000000004', 'approved', 'Payroll Manager', 'Approval for HRMS pending batch status demonstration.', '2026-10-01 08:55:00'),
('d5200000-0000-4000-8000-000000000005', 'd5100000-0000-4000-8000-000000000005', 'approved', 'Payroll Manager', 'Approval for HRMS failed batch status demonstration.', '2026-10-16 08:55:00'),
('d5200000-0000-4000-8000-000000000006', 'd5100000-0000-4000-8000-000000000006', 'approved', 'Payroll Manager', 'Approval for completed batch and payslip demonstration.', '2026-11-01 08:55:00'),
('d5200000-0000-4000-8000-000000000007', 'd5100000-0000-4000-8000-000000000007', 'approved', 'Payroll Manager', 'Approval for cancelled batch demonstration.', '2026-11-16 08:55:00');

INSERT INTO payroll_line
(
    id, pay_period_id, staff_id, gross_pay, incentive_pay,
    cpf_amount, sdl_amount, net_pay, status
)
VALUES
-- Generated batch lines.
('d5300000-0000-4000-8000-000000000016', 'd5100000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000007', 1500.00, 100.00, 150.00, 12.00, 1438.00, 'ok'),
('d5300000-0000-4000-8000-000000000017', 'd5100000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000009', 2300.00, 200.00, 230.00, 17.00, 2253.00, 'ok'),
-- HRMS pending batch lines.
('d5300000-0000-4000-8000-000000000018', 'd5100000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000010', 1050.00,  80.00, 105.00,  8.00, 1017.00, 'ok'),
('d5300000-0000-4000-8000-000000000019', 'd5100000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000011', 1350.00, 100.00,   0.00, 10.00, 1440.00, 'ok'),
-- HRMS failed batch lines.
('d5300000-0000-4000-8000-000000000020', 'd5100000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000012', 2450.00, 220.00, 245.00, 18.00, 2407.00, 'ok'),
('d5300000-0000-4000-8000-000000000021', 'd5100000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000013', 1150.00,  50.00, 115.00,  9.00, 1076.00, 'ok'),
-- Completed batch lines.
('d5300000-0000-4000-8000-000000000022', 'd5100000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000014', 2350.00, 400.00, 235.00, 18.00, 2497.00, 'ok'),
('d5300000-0000-4000-8000-000000000023', 'd5100000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000015',  950.00,  25.00,  95.00,  7.00,  873.00, 'ok'),
('d5300000-0000-4000-8000-000000000024', 'd5100000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000016', 2150.00, 180.00, 215.00, 16.00, 2099.00, 'ok'),
-- Cancelled batch lines.
('d5300000-0000-4000-8000-000000000025', 'd5100000-0000-4000-8000-000000000007', 'd5000000-0000-4000-8000-000000000017', 1200.00,  60.00, 120.00,  9.00, 1131.00, 'ok'),
('d5300000-0000-4000-8000-000000000026', 'd5100000-0000-4000-8000-000000000007', 'd5000000-0000-4000-8000-000000000019', 2700.00, 250.00, 270.00, 20.00, 2660.00, 'ok');

-- ==========================================================
-- GENERATED BATCH
-- ==========================================================

INSERT INTO payment_batch
(
    id, pay_period_id, batch_reference, file_format, employee_count,
    total_amount, status, hrms_sync_status, generated_by, generated_at
)
VALUES
(
    'd5400000-0000-4000-8000-000000000001',
    'd5100000-0000-4000-8000-000000000003',
    'PAY-20260916090500-GENERATED',
    'giro',
    2,
    3691.00,
    'generated',
    'not_started',
    '81000000-0000-0000-0000-000000000002',
    '2026-09-16 09:05:00'
);

-- ==========================================================
-- HRMS PENDING BATCH
-- ==========================================================

INSERT INTO payment_batch
(
    id, pay_period_id, batch_reference, file_format, employee_count,
    total_amount, status, hrms_sync_status, generated_by, generated_at
)
VALUES
(
    'd5400000-0000-4000-8000-000000000002',
    'd5100000-0000-4000-8000-000000000004',
    'PAY-20261001090500-HRMSPENDING',
    'giro',
    2,
    2457.00,
    'hrms_sync_pending',
    'pending',
    '81000000-0000-0000-0000-000000000002',
    '2026-10-01 09:05:00'
);

-- ==========================================================
-- HRMS FAILED BATCH
-- ==========================================================

INSERT INTO payment_batch
(
    id, pay_period_id, batch_reference, file_format, employee_count,
    total_amount, status, hrms_sync_status, hrms_error_message,
    generated_by, generated_at
)
VALUES
(
    'd5400000-0000-4000-8000-000000000003',
    'd5100000-0000-4000-8000-000000000005',
    'PAY-20261016090500-HRMSFAILED',
    'giro',
    2,
    3483.00,
    'hrms_sync_failed',
    'failed',
    'HRMS gateway timed out after accepting the secure transfer request.',
    '81000000-0000-0000-0000-000000000002',
    '2026-10-16 09:05:00'
);

-- ==========================================================
-- COMPLETED BATCH
-- ==========================================================

INSERT INTO payment_batch
(
    id, pay_period_id, batch_reference, file_format, employee_count,
    total_amount, status, hrms_sync_status, hrms_reference,
    generated_by, generated_at, hrms_synced_at
)
VALUES
(
    'd5400000-0000-4000-8000-000000000004',
    'd5100000-0000-4000-8000-000000000006',
    'PAY-20261101090500-COMPLETED',
    'bulk_transfer',
    3,
    5469.00,
    'completed',
    'completed',
    'HRMS-20261101-EFAR-004',
    '81000000-0000-0000-0000-000000000002',
    '2026-11-01 09:05:00',
    '2026-11-01 09:08:30'
);

-- ==========================================================
-- CANCELLED BATCH
-- ==========================================================

INSERT INTO payment_batch
(
    id, pay_period_id, batch_reference, file_format, employee_count,
    total_amount, status, hrms_sync_status, generated_by, generated_at,
    cancelled_by, cancelled_at, cancellation_reason
)
VALUES
(
    'd5400000-0000-4000-8000-000000000005',
    'd5100000-0000-4000-8000-000000000007',
    'PAY-20261116090500-CANCELLED',
    'giro',
    2,
    3791.00,
    'cancelled',
    'not_started',
    '81000000-0000-0000-0000-000000000002',
    '2026-11-16 09:05:00',
    '81000000-0000-0000-0000-000000000002',
    '2026-11-16 09:18:00',
    'Cancelled after the bank advised that the transfer window had closed.'
);

-- ==========================================================
-- PAYMENT BATCH ITEMS
-- Immutable snapshots exactly matching the 11 associated payroll lines.
-- ==========================================================

INSERT INTO payment_batch_item
(
    id, payment_batch_id, payroll_line_id, staff_id,
    employee_reference, employee_name, bank_code, bank_account_no,
    gross_pay, incentive_pay, cpf_amount, sdl_amount,
    other_deduction, net_pay, payment_reference
)
VALUES
-- Generated.
('d5500000-0000-4000-8000-000000000001', 'd5400000-0000-4000-8000-000000000001', 'd5300000-0000-4000-8000-000000000016', 'd5000000-0000-4000-8000-000000000007', 'EMP007', 'Siti Nur Izzati', '7171', '210700001', 1500.00, 100.00, 150.00, 12.00, 0.00, 1438.00, 'PAY-20260916090500-GENERATED-EMP007'),
('d5500000-0000-4000-8000-000000000002', 'd5400000-0000-4000-8000-000000000001', 'd5300000-0000-4000-8000-000000000017', 'd5000000-0000-4000-8000-000000000009', 'EMP009', 'Priya Devi', '7375', '210900003', 2300.00, 200.00, 230.00, 17.00, 0.00, 2253.00, 'PAY-20260916090500-GENERATED-EMP009'),
-- HRMS pending.
('d5500000-0000-4000-8000-000000000003', 'd5400000-0000-4000-8000-000000000002', 'd5300000-0000-4000-8000-000000000018', 'd5000000-0000-4000-8000-000000000010', 'EMP010', 'Muhammad Faizal Bin Abdul Rahman', '7232', '211000004', 1050.00,  80.00, 105.00,  8.00, 0.00, 1017.00, 'PAY-20261001090500-HRMSPENDING-EMP010'),
('d5500000-0000-4000-8000-000000000004', 'd5400000-0000-4000-8000-000000000002', 'd5300000-0000-4000-8000-000000000019', 'd5000000-0000-4000-8000-000000000011', 'EMP011', 'Ong Shi En', '7171', '211100005', 1350.00, 100.00,   0.00, 10.00, 0.00, 1440.00, 'PAY-20261001090500-HRMSPENDING-EMP011'),
-- HRMS failed.
('d5500000-0000-4000-8000-000000000005', 'd5400000-0000-4000-8000-000000000003', 'd5300000-0000-4000-8000-000000000020', 'd5000000-0000-4000-8000-000000000012', 'EMP012', 'Goh Pei Xuan', '7339', '211200006', 2450.00, 220.00, 245.00, 18.00, 0.00, 2407.00, 'PAY-20261016090500-HRMSFAILED-EMP012'),
('d5500000-0000-4000-8000-000000000006', 'd5400000-0000-4000-8000-000000000003', 'd5300000-0000-4000-8000-000000000021', 'd5000000-0000-4000-8000-000000000013', 'EMP013', 'Ahmad Hakim', '7375', '211300007', 1150.00,  50.00, 115.00,  9.00, 0.00, 1076.00, 'PAY-20261016090500-HRMSFAILED-EMP013'),
-- Completed.
('d5500000-0000-4000-8000-000000000007', 'd5400000-0000-4000-8000-000000000004', 'd5300000-0000-4000-8000-000000000022', 'd5000000-0000-4000-8000-000000000014', 'EMP014', 'Rachel Teo Xin Yi', '7232', '211400008', 2350.00, 400.00, 235.00, 18.00, 0.00, 2497.00, 'PAY-20261101090500-COMPLETED-EMP014'),
('d5500000-0000-4000-8000-000000000008', 'd5400000-0000-4000-8000-000000000004', 'd5300000-0000-4000-8000-000000000023', 'd5000000-0000-4000-8000-000000000015', 'EMP015', 'Karthik Subramaniam', '7171', '211500009',  950.00,  25.00,  95.00,  7.00, 0.00,  873.00, 'PAY-20261101090500-COMPLETED-EMP015'),
('d5500000-0000-4000-8000-000000000009', 'd5400000-0000-4000-8000-000000000004', 'd5300000-0000-4000-8000-000000000024', 'd5000000-0000-4000-8000-000000000016', 'EMP016', 'Farah Nadiah Binte Ismail', '7339', '211600010', 2150.00, 180.00, 215.00, 16.00, 0.00, 2099.00, 'PAY-20261101090500-COMPLETED-EMP016'),
-- Cancelled.
('d5500000-0000-4000-8000-000000000010', 'd5400000-0000-4000-8000-000000000005', 'd5300000-0000-4000-8000-000000000025', 'd5000000-0000-4000-8000-000000000017', 'EMP017', 'Benjamin Koh Wei Lun', '7375', '211700011', 1200.00,  60.00, 120.00,  9.00, 0.00, 1131.00, 'PAY-20261116090500-CANCELLED-EMP017'),
('d5500000-0000-4000-8000-000000000011', 'd5400000-0000-4000-8000-000000000005', 'd5300000-0000-4000-8000-000000000026', 'd5000000-0000-4000-8000-000000000019', 'EMP019', 'Vikneshwaran S/O Ramasamy', '7232', '211900013', 2700.00, 250.00, 270.00, 20.00, 0.00, 2660.00, 'PAY-20261116090500-CANCELLED-EMP019');

-- ==========================================================
-- PAYSLIPS
-- Only the newly completed batch receives payslips. Values are exact
-- snapshots of its batch items and source payroll lines.
-- ==========================================================

INSERT INTO payslip
(
    id, payment_batch_id, payroll_line_id, staff_id, payslip_reference,
    company_name, employee_reference, employee_name,
    pay_period_start, pay_period_end, gross_pay, incentive_pay,
    cpf_amount, sdl_amount, other_deduction, net_pay,
    batch_reference, generated_at
)
VALUES
(
    'd5600000-0000-4000-8000-000000000001',
    'd5400000-0000-4000-8000-000000000004',
    'd5300000-0000-4000-8000-000000000022',
    'd5000000-0000-4000-8000-000000000014',
    'PS-PAY-20261101090500-COMPLETED-EMP014',
    'Emergencies First Aid & Rescue',
    'EMP014',
    'Rachel Teo Xin Yi',
    '2026-10-16',
    '2026-10-31',
    2350.00, 400.00, 235.00, 18.00, 0.00, 2497.00,
    'PAY-20261101090500-COMPLETED',
    '2026-11-01 09:09:00'
),
(
    'd5600000-0000-4000-8000-000000000002',
    'd5400000-0000-4000-8000-000000000004',
    'd5300000-0000-4000-8000-000000000023',
    'd5000000-0000-4000-8000-000000000015',
    'PS-PAY-20261101090500-COMPLETED-EMP015',
    'Emergencies First Aid & Rescue',
    'EMP015',
    'Karthik Subramaniam',
    '2026-10-16',
    '2026-10-31',
    950.00, 25.00, 95.00, 7.00, 0.00, 873.00,
    'PAY-20261101090500-COMPLETED',
    '2026-11-01 09:09:05'
),
(
    'd5600000-0000-4000-8000-000000000003',
    'd5400000-0000-4000-8000-000000000004',
    'd5300000-0000-4000-8000-000000000024',
    'd5000000-0000-4000-8000-000000000016',
    'PS-PAY-20261101090500-COMPLETED-EMP016',
    'Emergencies First Aid & Rescue',
    'EMP016',
    'Farah Nadiah Binte Ismail',
    '2026-10-16',
    '2026-10-31',
    2150.00, 180.00, 215.00, 16.00, 0.00, 2099.00,
    'PAY-20261101090500-COMPLETED',
    '2026-11-01 09:09:10'
);

-- ==========================================================
-- AUDIT LOGS
-- Action values below are the exact strings emitted by the current backend.
-- In particular, the implemented equivalents are PAYMENT_FILE_DOWNLOAD
-- (not PAYMENT_FILE_DOWNLOADED), HRMS_SYNC_START / HRMS_SYNC_FAILURE /
-- HRMS_RETRY / HRMS_SYNC_SUCCESS, and PAYSLIP_GENERATION / PAYSLIP_VIEW /
-- PAYSLIP_DOWNLOAD. The backend has no PAYMENT_PREVIEW_VIEWED action;
-- PAYMENT_READINESS_FAILURE is its only current payment-preview audit event.
-- ==========================================================

INSERT INTO audit_log
(
    id, user_id, user_role, action, entity_type, entity_id,
    actor, ip_address, details, created_at
)
VALUES
(
    'd5700000-0000-4000-8000-000000000001',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_READINESS_FAILURE', 'pay_period', 'd5100000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('errorCode', 'MISSING_BANK_DETAILS', 'employeeReference', 'EMP018'),
    '2026-09-01 09:10:00'
),
(
    'd5700000-0000-4000-8000-000000000002',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'BANK_DETAILS_UPDATED', 'staff', 'd5000000-0000-4000-8000-000000000007',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('updatedFields', jsonb_build_array('bankCode', 'bankAccountNumber'), 'employeeReference', 'EMP007'),
    '2026-09-02 10:15:00'
),
(
    'd5700000-0000-4000-8000-000000000003',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'BANK_DETAILS_UPDATED', 'staff', 'd5000000-0000-4000-8000-000000000008',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('updatedFields', jsonb_build_array('bankCode', 'bankAccountNumber'), 'employeeReference', 'EMP008'),
    '2026-09-02 10:18:00'
),
(
    'd5700000-0000-4000-8000-000000000004',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_BATCH_GENERATED', 'payment_batch', 'd5400000-0000-4000-8000-000000000001',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20260916090500-GENERATED', 'employeeCount', 2, 'totalAmount', 3691.00),
    '2026-09-16 09:05:05'
),
(
    'd5700000-0000-4000-8000-000000000005',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_FILE_DOWNLOAD', 'payment_batch', 'd5400000-0000-4000-8000-000000000001',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20260916090500-GENERATED', 'fileFormat', 'csv'),
    '2026-09-16 09:10:00'
),
(
    'd5700000-0000-4000-8000-000000000006',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_FILE_DOWNLOAD', 'payment_batch', 'd5400000-0000-4000-8000-000000000001',
    'Payroll Manager', '192.0.2.21',
    jsonb_build_object('batchReference', 'PAY-20260916090500-GENERATED', 'fileFormat', 'csv', 'downloadReason', 'bank verification'),
    '2026-09-16 09:15:00'
),
(
    'd5700000-0000-4000-8000-000000000007',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_BATCH_GENERATED', 'payment_batch', 'd5400000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261001090500-HRMSPENDING', 'employeeCount', 2, 'totalAmount', 2457.00),
    '2026-10-01 09:05:05'
),
(
    'd5700000-0000-4000-8000-000000000008',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_START', 'payment_batch', 'd5400000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261001090500-HRMSPENDING', 'retry', FALSE),
    '2026-10-01 09:06:00'
),
(
    'd5700000-0000-4000-8000-000000000009',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_FILE_DOWNLOAD', 'payment_batch', 'd5400000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261001090500-HRMSPENDING', 'fileFormat', 'csv'),
    '2026-10-01 09:07:00'
),
(
    'd5700000-0000-4000-8000-000000000010',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_BATCH_GENERATED', 'payment_batch', 'd5400000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261016090500-HRMSFAILED', 'employeeCount', 2, 'totalAmount', 3483.00),
    '2026-10-16 09:05:05'
),
(
    'd5700000-0000-4000-8000-000000000011',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_START', 'payment_batch', 'd5400000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261016090500-HRMSFAILED', 'retry', FALSE),
    '2026-10-16 09:06:00'
),
(
    'd5700000-0000-4000-8000-000000000012',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_FAILURE', 'payment_batch', 'd5400000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261016090500-HRMSFAILED', 'errorCode', 'HRMS_GATEWAY_TIMEOUT'),
    '2026-10-16 09:06:45'
),
(
    'd5700000-0000-4000-8000-000000000013',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_FILE_DOWNLOAD', 'payment_batch', 'd5400000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261016090500-HRMSFAILED', 'fileFormat', 'csv'),
    '2026-10-16 09:12:00'
),
(
    'd5700000-0000-4000-8000-000000000014',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_RETRY', 'payment_batch', 'd5400000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261016090500-HRMSFAILED', 'attempt', 2),
    '2026-10-17 08:40:00'
),
(
    'd5700000-0000-4000-8000-000000000015',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_START', 'payment_batch', 'd5400000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261016090500-HRMSFAILED', 'retry', TRUE),
    '2026-10-17 08:40:05'
),
(
    'd5700000-0000-4000-8000-000000000016',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_FAILURE', 'payment_batch', 'd5400000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261016090500-HRMSFAILED', 'errorCode', 'HRMS_GATEWAY_TIMEOUT', 'attempt', 2),
    '2026-10-17 08:40:50'
),
(
    'd5700000-0000-4000-8000-000000000017',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_READINESS_FAILURE', 'pay_period', 'd5100000-0000-4000-8000-000000000005',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('errorCode', 'DUPLICATE_PAYMENT_BATCH', 'paymentBatchId', 'd5400000-0000-4000-8000-000000000003'),
    '2026-10-18 11:20:00'
),
(
    'd5700000-0000-4000-8000-000000000018',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'BANK_DETAILS_UPDATED', 'staff', 'd5000000-0000-4000-8000-000000000009',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('updatedFields', jsonb_build_array('bankCode', 'bankAccountNumber'), 'employeeReference', 'EMP009'),
    '2026-10-20 14:25:00'
),
(
    'd5700000-0000-4000-8000-000000000019',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_BATCH_GENERATED', 'payment_batch', 'd5400000-0000-4000-8000-000000000004',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261101090500-COMPLETED', 'employeeCount', 3, 'totalAmount', 5469.00),
    '2026-11-01 09:05:05'
),
(
    'd5700000-0000-4000-8000-000000000020',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_START', 'payment_batch', 'd5400000-0000-4000-8000-000000000004',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261101090500-COMPLETED', 'retry', FALSE),
    '2026-11-01 09:06:00'
),
(
    'd5700000-0000-4000-8000-000000000021',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_SUCCESS', 'payment_batch', 'd5400000-0000-4000-8000-000000000004',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261101090500-COMPLETED', 'externalReference', 'HRMS-20261101-EFAR-004', 'acceptedRecords', 3),
    '2026-11-01 09:08:30'
),
(
    'd5700000-0000-4000-8000-000000000022',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_GENERATION', 'payslip', 'd5600000-0000-4000-8000-000000000001',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('paymentBatchId', 'd5400000-0000-4000-8000-000000000004', 'employeeReference', 'EMP014'),
    '2026-11-01 09:09:00'
),
(
    'd5700000-0000-4000-8000-000000000023',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_GENERATION', 'payslip', 'd5600000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('paymentBatchId', 'd5400000-0000-4000-8000-000000000004', 'employeeReference', 'EMP015'),
    '2026-11-01 09:09:05'
),
(
    'd5700000-0000-4000-8000-000000000024',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_GENERATION', 'payslip', 'd5600000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('paymentBatchId', 'd5400000-0000-4000-8000-000000000004', 'employeeReference', 'EMP016'),
    '2026-11-01 09:09:10'
),
(
    'd5700000-0000-4000-8000-000000000025',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_FILE_DOWNLOAD', 'payment_batch', 'd5400000-0000-4000-8000-000000000004',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261101090500-COMPLETED', 'fileFormat', 'csv'),
    '2026-11-01 09:15:00'
),
(
    'd5700000-0000-4000-8000-000000000026',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_VIEW', 'payment_batch', 'd5400000-0000-4000-8000-000000000004',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipCount', 3, 'batchReference', 'PAY-20261101090500-COMPLETED'),
    '2026-11-01 09:20:00'
),
(
    'd5700000-0000-4000-8000-000000000027',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_VIEW', 'payslip_list', '81000000-0000-0000-0000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipCount', 9, 'view', 'manager list'),
    '2026-11-01 09:21:00'
),
(
    'd5700000-0000-4000-8000-000000000028',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_VIEW', 'payslip', 'd5600000-0000-4000-8000-000000000001',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipReference', 'PS-PAY-20261101090500-COMPLETED-EMP014'),
    '2026-11-01 09:22:00'
),
(
    'd5700000-0000-4000-8000-000000000029',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_DOWNLOAD', 'payslip', 'd5600000-0000-4000-8000-000000000001',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipReference', 'PS-PAY-20261101090500-COMPLETED-EMP014', 'fileFormat', 'pdf'),
    '2026-11-01 09:23:00'
),
(
    'd5700000-0000-4000-8000-000000000030',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_VIEW', 'payslip', 'd5600000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipReference', 'PS-PAY-20261101090500-COMPLETED-EMP015'),
    '2026-11-01 09:24:00'
),
(
    'd5700000-0000-4000-8000-000000000031',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_DOWNLOAD', 'payslip', 'd5600000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipReference', 'PS-PAY-20261101090500-COMPLETED-EMP015', 'fileFormat', 'pdf'),
    '2026-11-01 09:25:00'
),
(
    'd5700000-0000-4000-8000-000000000032',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_VIEW', 'payslip', 'd5600000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipReference', 'PS-PAY-20261101090500-COMPLETED-EMP016'),
    '2026-11-01 09:26:00'
),
(
    'd5700000-0000-4000-8000-000000000033',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYSLIP_DOWNLOAD', 'payslip', 'd5600000-0000-4000-8000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('payslipReference', 'PS-PAY-20261101090500-COMPLETED-EMP016', 'fileFormat', 'pdf'),
    '2026-11-01 09:27:00'
),
(
    -- Employee login linked to EMP001 views its own payslips.
    'd5700000-0000-4000-8000-000000000034',
    '81000000-0000-0000-0000-000000000003', 'employee',
    'PAYSLIP_VIEW', 'staff', '11111111-1111-1111-1111-111111111111',
    'Tan Wei Ming', '198.51.100.31',
    jsonb_build_object('ownPayslips', TRUE, 'employeeReference', 'EMP001', 'payslipCount', 2),
    '2026-11-02 18:10:00'
),
(
    'd5700000-0000-4000-8000-000000000035',
    '81000000-0000-0000-0000-000000000003', 'employee',
    'PAYSLIP_VIEW', 'payslip', 'fd000000-0000-0000-0000-000000000001',
    'Tan Wei Ming', '198.51.100.31',
    jsonb_build_object('payslipReference', 'PS-PAY-20260722143603-F562F5-EMP001', 'ownPayslip', TRUE),
    '2026-11-02 18:11:00'
),
(
    'd5700000-0000-4000-8000-000000000036',
    '81000000-0000-0000-0000-000000000003', 'employee',
    'PAYSLIP_DOWNLOAD', 'payslip', 'fd000000-0000-0000-0000-000000000001',
    'Tan Wei Ming', '198.51.100.31',
    jsonb_build_object('payslipReference', 'PS-PAY-20260722143603-F562F5-EMP001', 'fileFormat', 'pdf', 'ownPayslip', TRUE),
    '2026-11-02 18:12:00'
),
(
    'd5700000-0000-4000-8000-000000000037',
    '81000000-0000-0000-0000-000000000003', 'employee',
    'PAYSLIP_VIEW', 'staff', '11111111-1111-1111-1111-111111111111',
    'Tan Wei Ming', '198.51.100.31',
    jsonb_build_object('ownPayslips', TRUE, 'employeeReference', 'EMP001', 'view', 'history refresh'),
    '2026-11-03 19:05:00'
),
(
    'd5700000-0000-4000-8000-000000000038',
    '81000000-0000-0000-0000-000000000003', 'employee',
    'PAYSLIP_DOWNLOAD', 'payslip', 'fd000000-0000-0000-0000-000000000001',
    'Tan Wei Ming', '198.51.100.31',
    jsonb_build_object('payslipReference', 'PS-PAY-20260722143603-F562F5-EMP001', 'fileFormat', 'pdf', 'repeatDownload', TRUE),
    '2026-11-03 19:06:00'
),
(
    'd5700000-0000-4000-8000-000000000039',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_BATCH_GENERATED', 'payment_batch', 'd5400000-0000-4000-8000-000000000005',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261116090500-CANCELLED', 'employeeCount', 2, 'totalAmount', 3791.00),
    '2026-11-16 09:05:05'
),
(
    'd5700000-0000-4000-8000-000000000040',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_FILE_DOWNLOAD', 'payment_batch', 'd5400000-0000-4000-8000-000000000005',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261116090500-CANCELLED', 'fileFormat', 'csv'),
    '2026-11-16 09:12:00'
),
(
    'd5700000-0000-4000-8000-000000000041',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_BATCH_CANCELLED', 'payment_batch', 'd5400000-0000-4000-8000-000000000005',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20261116090500-CANCELLED', 'reason', 'Bank transfer window closed'),
    '2026-11-16 09:18:00'
),
(
    'd5700000-0000-4000-8000-000000000042',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'PAYMENT_READINESS_FAILURE', 'pay_period', 'd5100000-0000-4000-8000-000000000002',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('errorCode', 'MISSING_BANK_DETAILS', 'employeeReference', 'EMP018', 'missingFields', jsonb_build_array('bankCode', 'bankAccountNumber')),
    '2026-11-17 10:00:00'
),
(
    'd5700000-0000-4000-8000-000000000043',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_RETRY', 'payment_batch', 'fb000000-0000-0000-0000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20260616090500-HRMSFAIL', 'attempt', 2),
    '2026-11-18 08:30:00'
),
(
    'd5700000-0000-4000-8000-000000000044',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_START', 'payment_batch', 'fb000000-0000-0000-0000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20260616090500-HRMSFAIL', 'retry', TRUE),
    '2026-11-18 08:30:05'
),
(
    'd5700000-0000-4000-8000-000000000045',
    '81000000-0000-0000-0000-000000000002', 'manager',
    'HRMS_SYNC_FAILURE', 'payment_batch', 'fb000000-0000-0000-0000-000000000003',
    'Payroll Manager', '192.0.2.20',
    jsonb_build_object('batchReference', 'PAY-20260616090500-HRMSFAIL', 'errorCode', 'HRMS_SIMULATED_FAILURE', 'attempt', 2),
    '2026-11-18 08:30:45'
);

-- ==========================================================
-- VALIDATION QUERIES (run manually after seeding)
-- ==========================================================

-- Count staff by status.
-- SELECT status, COUNT(*) FROM staff GROUP BY status ORDER BY status;

-- List approved and locked pay periods that do not have an active batch.
-- SELECT pp.id, pp.start_date, pp.end_date, pp.total_gross, pp.total_net
-- FROM pay_period pp
-- WHERE pp.status = 'approved'
--   AND pp.is_locked = TRUE
--   AND NOT EXISTS (
--       SELECT 1
--       FROM payment_batch pb
--       WHERE pb.pay_period_id = pp.id
--         AND pb.status <> 'cancelled'
--   )
-- ORDER BY pp.start_date;

-- List payment batches by status.
-- SELECT status, hrms_sync_status, COUNT(*)
-- FROM payment_batch
-- GROUP BY status, hrms_sync_status
-- ORDER BY status, hrms_sync_status;

-- Compare each batch total and employee count with its item rows.
-- SELECT pb.batch_reference,
--        pb.employee_count,
--        COUNT(pbi.id) AS item_count,
--        pb.total_amount,
--        COALESCE(SUM(pbi.net_pay), 0) AS item_total,
--        pb.total_amount = COALESCE(SUM(pbi.net_pay), 0) AS totals_match
-- FROM payment_batch pb
-- LEFT JOIN payment_batch_item pbi ON pbi.payment_batch_id = pb.id
-- GROUP BY pb.id, pb.batch_reference, pb.employee_count, pb.total_amount
-- ORDER BY pb.generated_at;

-- Compare each pay-period total with its payroll lines.
-- SELECT pp.start_date,
--        pp.end_date,
--        pp.total_gross,
--        COALESCE(SUM(pl.gross_pay), 0) AS payroll_gross,
--        pp.total_net,
--        COALESCE(SUM(pl.net_pay), 0) AS payroll_net,
--        pp.total_gross = COALESCE(SUM(pl.gross_pay), 0) AS gross_matches,
--        pp.total_net = COALESCE(SUM(pl.net_pay), 0) AS net_matches
-- FROM pay_period pp
-- LEFT JOIN payroll_line pl ON pl.pay_period_id = pp.id
-- GROUP BY pp.id, pp.start_date, pp.end_date, pp.total_gross, pp.total_net
-- ORDER BY pp.start_date;

-- Count payslips for every completed batch.
-- SELECT pb.batch_reference, pb.employee_count, COUNT(p.id) AS payslip_count
-- FROM payment_batch pb
-- LEFT JOIN payslip p ON p.payment_batch_id = pb.id
-- WHERE pb.status = 'completed'
-- GROUP BY pb.id, pb.batch_reference, pb.employee_count
-- ORDER BY pb.generated_at;

-- Confirm non-completed batches have no payslips.
-- SELECT pb.batch_reference, pb.status, COUNT(p.id) AS payslip_count
-- FROM payment_batch pb
-- LEFT JOIN payslip p ON p.payment_batch_id = pb.id
-- WHERE pb.status <> 'completed'
-- GROUP BY pb.id, pb.batch_reference, pb.status
-- HAVING COUNT(p.id) > 0;

-- Find active staff with missing bank details.
-- SELECT external_ref, full_name, bank_code, bank_account_no
-- FROM staff
-- WHERE status = 'active'
--   AND (bank_code IS NULL OR bank_account_no IS NULL)
-- ORDER BY external_ref;

-- Count audit logs by the exact backend action value.
-- SELECT action, COUNT(*) FROM audit_log GROUP BY action ORDER BY action;

-- Confirm the two generation-test periods have no active batch.
-- SELECT pp.id, pp.start_date, pp.end_date, COUNT(pb.id) AS active_batch_count
-- FROM pay_period pp
-- LEFT JOIN payment_batch pb
--   ON pb.pay_period_id = pp.id
--  AND pb.status <> 'cancelled'
-- WHERE pp.id IN (
--     'd5100000-0000-4000-8000-000000000001',
--     'd5100000-0000-4000-8000-000000000002'
-- )
-- GROUP BY pp.id, pp.start_date, pp.end_date
-- ORDER BY pp.start_date;

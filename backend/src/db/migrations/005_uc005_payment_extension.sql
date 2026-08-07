-- ==========================================================
-- UC-005 Payment Processing Extension
-- Extends the shared 001_initial_schema.sql
-- ==========================================================

-- ==========================================================
-- USER ACCOUNT
-- Required for UC-005 authentication and authorised actions
-- ==========================================================

CREATE TABLE user_account (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    full_name VARCHAR(150) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    role VARCHAR(20)
        CHECK (role IN ('manager', 'employee'))
        NOT NULL,

    staff_id UUID UNIQUE,

    status VARCHAR(20)
        DEFAULT 'active'
        CHECK (status IN ('active', 'disabled'))
        NOT NULL,

    last_login_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (staff_id)
        REFERENCES staff(id)
);

-- ==========================================================
-- PAY PERIOD EXTENSION
-- UC-005 only processes approved and locked payroll periods
-- ==========================================================

ALTER TABLE pay_period
    ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN locked_at TIMESTAMP;

-- ==========================================================
-- PAYMENT BATCH EXTENSION
-- Adds the full UC-005 payment lifecycle fields
-- ==========================================================

-- Replace the original limited status constraint
ALTER TABLE payment_batch
    DROP CONSTRAINT IF EXISTS payment_batch_status_check;

ALTER TABLE payment_batch
    ADD CONSTRAINT payment_batch_status_check
    CHECK (
        status IN (
            'generating',
            'generated',
            'hrms_sync_pending',
            'hrms_sync_failed',
            'completed',
            'cancelled'
        )
    );

-- Add UC-005 payment batch fields
ALTER TABLE payment_batch
    ADD COLUMN batch_reference VARCHAR(50) UNIQUE NOT NULL,

    ADD COLUMN employee_count INTEGER NOT NULL DEFAULT 0,

    ADD COLUMN total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,

    ADD COLUMN hrms_sync_status VARCHAR(20)
        NOT NULL
        DEFAULT 'not_started'
        CHECK (
            hrms_sync_status IN (
                'not_started',
                'pending',
                'failed',
                'completed'
            )
        ),

    ADD COLUMN hrms_reference VARCHAR(100),

    ADD COLUMN hrms_error_message VARCHAR(500),

    ADD COLUMN generated_by UUID NOT NULL,

    ADD COLUMN hrms_synced_at TIMESTAMP,

    ADD COLUMN cancelled_by UUID,

    ADD COLUMN cancelled_at TIMESTAMP,

    ADD COLUMN cancellation_reason VARCHAR(500),

    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Link payment actions to authenticated users
ALTER TABLE payment_batch
    ADD CONSTRAINT fk_payment_batch_generated_by
        FOREIGN KEY (generated_by)
        REFERENCES user_account(id),

    ADD CONSTRAINT fk_payment_batch_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES user_account(id);

-- ==========================================================
-- PAYMENT BATCH ITEM
-- Immutable snapshot of each employee's payment line
-- ==========================================================

CREATE TABLE payment_batch_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    payment_batch_id UUID NOT NULL,

    payroll_line_id UUID NOT NULL,

    staff_id UUID NOT NULL,

    employee_reference VARCHAR(100) NOT NULL,

    employee_name VARCHAR(150) NOT NULL,

    bank_code VARCHAR(20),

    bank_account_no VARCHAR(100),

    gross_pay NUMERIC(12,2) NOT NULL,

    incentive_pay NUMERIC(12,2) NOT NULL,

    cpf_amount NUMERIC(12,2) NOT NULL,

    sdl_amount NUMERIC(12,2) NOT NULL,

    other_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,

    net_pay NUMERIC(12,2) NOT NULL,

    payment_reference VARCHAR(100) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_batch_id)
        REFERENCES payment_batch(id),

    FOREIGN KEY (payroll_line_id)
        REFERENCES payroll_line(id),

    FOREIGN KEY (staff_id)
        REFERENCES staff(id)
);

-- ==========================================================
-- PAYSLIP
-- Generated after successful HRMS synchronization
-- ==========================================================

CREATE TABLE payslip (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    payment_batch_id UUID NOT NULL,

    payroll_line_id UUID NOT NULL,

    staff_id UUID NOT NULL,

    payslip_reference VARCHAR(60) UNIQUE NOT NULL,

    company_name VARCHAR(150) NOT NULL,

    employee_reference VARCHAR(100) NOT NULL,

    employee_name VARCHAR(150) NOT NULL,

    pay_period_start DATE NOT NULL,

    pay_period_end DATE NOT NULL,

    gross_pay NUMERIC(12,2) NOT NULL,

    incentive_pay NUMERIC(12,2) NOT NULL,

    cpf_amount NUMERIC(12,2) NOT NULL,

    sdl_amount NUMERIC(12,2) NOT NULL,

    other_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,

    net_pay NUMERIC(12,2) NOT NULL,

    batch_reference VARCHAR(50) NOT NULL,

    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_batch_id)
        REFERENCES payment_batch(id),

    FOREIGN KEY (payroll_line_id)
        REFERENCES payroll_line(id),

    FOREIGN KEY (staff_id)
        REFERENCES staff(id)
);

-- ==========================================================
-- AUDIT LOG EXTENSION
-- Adds UC-005 authentication and request context fields
-- ==========================================================

ALTER TABLE audit_log
    ALTER COLUMN entity_id DROP NOT NULL;

ALTER TABLE audit_log
    ADD COLUMN user_id UUID,
    ADD COLUMN user_role VARCHAR(30),
    ADD COLUMN ip_address VARCHAR(64),
    ADD COLUMN details JSONB;

ALTER TABLE audit_log
    ADD CONSTRAINT fk_audit_log_user_id
        FOREIGN KEY (user_id)
        REFERENCES user_account(id);

-- ==========================================================
-- UC-005 INDEXES
-- ==========================================================

CREATE INDEX idx_user_account_staff_id
    ON user_account(staff_id);

CREATE INDEX idx_payment_batch_pay_period_id
    ON payment_batch(pay_period_id);

CREATE INDEX idx_payment_batch_status
    ON payment_batch(status);

CREATE INDEX idx_payment_batch_hrms_sync_status
    ON payment_batch(hrms_sync_status);

CREATE INDEX idx_payment_batch_item_payment_batch_id
    ON payment_batch_item(payment_batch_id);

CREATE INDEX idx_payment_batch_item_staff_id
    ON payment_batch_item(staff_id);

CREATE INDEX idx_payment_batch_item_payroll_line_id
    ON payment_batch_item(payroll_line_id);

CREATE INDEX idx_payslip_payment_batch_id
    ON payslip(payment_batch_id);

CREATE INDEX idx_payslip_staff_id
    ON payslip(staff_id);

CREATE INDEX idx_payslip_payroll_line_id
    ON payslip(payroll_line_id);
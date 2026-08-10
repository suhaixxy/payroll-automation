-- UC-003: align the UC-003-owned tables created by 001_initial_schema.sql
-- with the ported calculation engine and its Sequelize models.
--
-- Background: the UC-003 code was ported from an older repo whose schema for
-- these four tables (payroll_line, pay_rate, performance_input,
-- incentive_scheme) differed from what 001 creates here — money lives in
-- INTEGER CENTS columns (exact maths, no floats), payroll_line carries the
-- employer CPF share and incomplete-reason notes, and Sequelize expects an
-- updated_at column on the tables it manages.
--
-- payroll_line and pay_rate are DROPPED and recreated: no code path in this
-- repo has ever successfully written to them (the engine referenced columns
-- that did not exist), so they are empty on every teammate's database.
-- Only UC-003-owned tables are touched — staff, pay_period, timesheet,
-- audit_log and the rest are not altered.

DROP TABLE IF EXISTS payroll_line;
CREATE TABLE payroll_line (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pay_period_id UUID NOT NULL REFERENCES pay_period(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  gross_pay_cents INTEGER NOT NULL DEFAULT 0,
  incentive_cents INTEGER NOT NULL DEFAULT 0,
  cpf_employee_cents INTEGER NOT NULL DEFAULT 0,
  cpf_employer_cents INTEGER NOT NULL DEFAULT 0,
  sdl_cents INTEGER NOT NULL DEFAULT 0,
  other_deductions_cents INTEGER NOT NULL DEFAULT 0,
  net_pay_cents INTEGER NOT NULL DEFAULT 0,
  line_status VARCHAR NOT NULL DEFAULT 'complete' CHECK (line_status IN ('complete', 'incomplete')),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  -- Re-running a calculation replaces a period's lines in one transaction;
  -- this constraint makes double-counting impossible even if that regresses.
  UNIQUE (pay_period_id, staff_id)
);

DROP TABLE IF EXISTS pay_rate;
CREATE TABLE pay_rate (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  hourly_rate_cents INTEGER NOT NULL,
  ot_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  ph_multiplier NUMERIC(4,2) NOT NULL DEFAULT 2.0,
  effective_from DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX pay_rate_staff_id_effective_from ON pay_rate (staff_id, effective_from);

-- performance_input and incentive_scheme keep their 001 shape and data;
-- they only gain the updated_at column Sequelize maintains, and
-- performance_input gains the one-value-per-metric guard.
ALTER TABLE performance_input ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE incentive_scheme ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS performance_input_period_staff_metric
  ON performance_input (pay_period_id, staff_id, metric_type);

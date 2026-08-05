-- UC-003 (guide §3.2, adapted to UUID keys): calculation runs and the
-- run-scoped payroll lines. Recalculation NEVER overwrites — it creates a
-- new run with run_number + 1; only the latest non-voided run is
-- authoritative (guide §5.9). These tables SUPERSEDE the ported
-- payroll_line table, which stays until the engine is reworked onto runs
-- (guide phase 3) and is then dropped in a later migration.

CREATE TABLE calculation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES pay_period(id),
  run_number INTEGER NOT NULL,               -- 1, 2, 3... per period
  rate_set_id UUID NOT NULL REFERENCES statutory_rate_sets(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'complete', 'failed', 'voided')),
  total_gross NUMERIC(12,2),
  total_employee_deductions NUMERIC(12,2),
  total_employer_cost NUMERIC(12,2),
  total_net_payable NUMERIC(12,2),
  lines_complete INTEGER,
  lines_incomplete INTEGER,
  void_reason TEXT,
  run_by UUID NOT NULL REFERENCES users(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, run_number)
);

-- One calculated result per employee per run. Money NUMERIC(12,2), hours
-- NUMERIC(10,2). calc_breakdown holds the ordered human-readable derivation
-- (guide §5.7); incomplete_reasons holds [{code, message}] (guide §5.8).
CREATE TABLE payroll_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES calculation_runs(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  period_id UUID NOT NULL REFERENCES pay_period(id),
  regular_hours NUMERIC(10,2) DEFAULT 0,
  ot_hours NUMERIC(10,2) DEFAULT 0,
  ph_hours NUMERIC(10,2) DEFAULT 0,
  hourly_rate_used NUMERIC(12,2),
  gross_from_hours NUMERIC(12,2) DEFAULT 0,
  incentive_amount NUMERIC(12,2) DEFAULT 0,
  adjustments_total NUMERIC(12,2) DEFAULT 0,
  gross_total NUMERIC(12,2) DEFAULT 0,
  cpf_employee NUMERIC(12,2) DEFAULT 0,
  cpf_employer NUMERIC(12,2) DEFAULT 0,
  sdl NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  line_status VARCHAR(20) NOT NULL CHECK (line_status IN ('complete', 'incomplete')),
  incomplete_reasons JSONB,
  calc_breakdown JSONB,
  UNIQUE (run_id, staff_id)
);

CREATE INDEX payroll_lines_period_id ON payroll_lines (period_id);
CREATE INDEX payroll_lines_run_id ON payroll_lines (run_id);

-- UC-003 (guide §3.2, adapted to UUID keys and the singular pay_period
-- table): per-period performance inputs and ad-hoc payroll adjustments.
--
-- performance_inputs (plural) is the guide's quantity × unit_value model and
-- SUPERSEDES the ported performance_input (singular, metric_type/metric_value)
-- table. The legacy table stays until the calculation engine is reworked to
-- read from this one (guide phase 2/5); it is then dropped in a later
-- migration. Nothing may write to both.

CREATE TABLE performance_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  period_id UUID NOT NULL REFERENCES pay_period(id),
  input_type VARCHAR(40) NOT NULL,           -- 'sessions' | 'courses' | ...
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity >= 0),
  unit_value NUMERIC(12,2) NOT NULL,         -- $ per unit
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,                    -- soft delete only
  UNIQUE (staff_id, period_id, input_type)
);

CREATE INDEX performance_inputs_period_id ON performance_inputs (period_id);

-- Ad-hoc money added to or removed from a payroll line. amount is SIGNED:
-- negative reduces pay. Only cpf_applicable amounts enter the CPF wage base.
CREATE TABLE payroll_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  period_id UUID NOT NULL REFERENCES pay_period(id),
  adjustment_type VARCHAR(40) NOT NULL,      -- 'bonus'|'allowance'|'deduction'|'clawback'|'correction'
  amount NUMERIC(12,2) NOT NULL,
  cpf_applicable BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ                     -- soft delete only
);

CREATE INDEX payroll_adjustments_period_id ON payroll_adjustments (period_id);
CREATE INDEX payroll_adjustments_staff_period ON payroll_adjustments (staff_id, period_id);

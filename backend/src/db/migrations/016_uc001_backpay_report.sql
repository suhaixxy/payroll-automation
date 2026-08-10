-- UC-001: records missed-pay reports for past pay periods.

CREATE TABLE backpay_report (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  pay_period_id UUID NOT NULL REFERENCES pay_period(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('missing_hours', 'missing_performance_input')),
  missing_hours NUMERIC,
  missing_regular_hours NUMERIC,
  missing_ot_hours NUMERIC,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  resolved_at TIMESTAMP
);

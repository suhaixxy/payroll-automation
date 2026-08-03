CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== staff =====
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_ref VARCHAR UNIQUE,
  full_name VARCHAR NOT NULL,
  employment_type VARCHAR NOT NULL CHECK (employment_type IN ('part_time','full_time')),
  bank_account_no VARCHAR,
  bank_code VARCHAR,
  cpf_eligible BOOLEAN DEFAULT true,
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ===== pay_period =====
CREATE TABLE pay_period (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR DEFAULT 'draft',
  validated_at TIMESTAMP,
  total_gross NUMERIC(12,2),
  total_net NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ===== audit_log =====
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR NOT NULL,
  actor VARCHAR NOT NULL,
  detail JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- ===== timesheet (UC-001 / UC-002) =====
CREATE TABLE timesheet (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pay_period_id UUID NOT NULL REFERENCES pay_period(id),
  staff_id UUID REFERENCES staff(id),
  roster_raw_name VARCHAR,
  total_hours NUMERIC(6,2) DEFAULT 0,
  ot_hours NUMERIC(6,2) DEFAULT 0,
  ph_hours NUMERIC(6,2) DEFAULT 0,
  is_frozen BOOLEAN DEFAULT false,
  match_status VARCHAR DEFAULT 'unmatched' CHECK (match_status IN ('matched','unmatched')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ===== timesheet_exception (UC-002) =====
CREATE TABLE timesheet_exception (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timesheet_id UUID NOT NULL REFERENCES timesheet(id),
  rule_type VARCHAR NOT NULL CHECK (rule_type IN ('overlap','exceeds_cap','missing_entry','public_holiday')),
  status VARCHAR DEFAULT 'open' CHECK (status IN ('open','corrected','noted','returned')),
  note TEXT,
  resolved_by VARCHAR,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ===== pay_rate (UC-003) =====
CREATE TABLE pay_rate (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  hourly_rate NUMERIC(8,2) NOT NULL,
  ot_multiplier NUMERIC(4,2) DEFAULT 1.5,
  ph_multiplier NUMERIC(4,2) DEFAULT 2.0,
  effective_from DATE NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- ===== incentive_scheme (UC-003) =====
CREATE TABLE incentive_scheme (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  rule_definition JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- ===== performance_input (UC-003) =====
CREATE TABLE performance_input (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pay_period_id UUID NOT NULL REFERENCES pay_period(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  metric_type VARCHAR NOT NULL CHECK (metric_type IN ('sessions','enrolments','sales','kpi')),
  metric_value NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- ===== payroll_line (UC-003) =====
CREATE TABLE payroll_line (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pay_period_id UUID NOT NULL REFERENCES pay_period(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  gross_pay NUMERIC(12,2) DEFAULT 0,
  incentive_pay NUMERIC(12,2) DEFAULT 0,
  cpf_amount NUMERIC(12,2) DEFAULT 0,
  sdl_amount NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  status VARCHAR DEFAULT 'ok' CHECK (status IN ('ok','incomplete')),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ===== approval (UC-004) =====
CREATE TABLE approval (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pay_period_id UUID NOT NULL REFERENCES pay_period(id),
  decision VARCHAR NOT NULL CHECK (decision IN ('approved','rejected')),
  approved_by VARCHAR NOT NULL,
  comment TEXT,
  decided_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- ===== payment_batch (UC-005) =====
CREATE TABLE payment_batch (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pay_period_id UUID NOT NULL REFERENCES pay_period(id),
  file_format VARCHAR DEFAULT 'giro' CHECK (file_format IN ('giro','bulk_transfer')),
  file_path VARCHAR,
  status VARCHAR DEFAULT 'generated' CHECK (status IN ('generated','hrms_sync_pending','hrms_sync_failed','completed')),
  generated_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);
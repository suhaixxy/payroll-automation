-- Integrates UC-003 calculation runs with UC-004 approvals and UC-005 payments.
-- Existing legacy payroll_line references are preserved. NOT VALID foreign keys
-- enforce canonical payroll_lines references for new rows without rejecting
-- historical payment snapshots created before this integration.

ALTER TABLE approval ADD COLUMN IF NOT EXISTS calculation_run_id UUID;
ALTER TABLE approval DROP CONSTRAINT IF EXISTS approval_calculation_run_id_fkey;
ALTER TABLE approval ADD CONSTRAINT approval_calculation_run_id_fkey
  FOREIGN KEY (calculation_run_id) REFERENCES calculation_runs(id) NOT VALID;
CREATE INDEX IF NOT EXISTS approval_calculation_run_id ON approval (calculation_run_id);

ALTER TABLE payment_batch ADD COLUMN IF NOT EXISTS calculation_run_id UUID;
ALTER TABLE payment_batch DROP CONSTRAINT IF EXISTS payment_batch_calculation_run_id_fkey;
ALTER TABLE payment_batch ADD CONSTRAINT payment_batch_calculation_run_id_fkey
  FOREIGN KEY (calculation_run_id) REFERENCES calculation_runs(id) NOT VALID;
CREATE INDEX IF NOT EXISTS payment_batch_calculation_run_id ON payment_batch (calculation_run_id);

ALTER TABLE payment_batch_item DROP CONSTRAINT IF EXISTS payment_batch_item_payroll_line_id_fkey;
ALTER TABLE payment_batch_item ADD CONSTRAINT payment_batch_item_payroll_line_id_fkey
  FOREIGN KEY (payroll_line_id) REFERENCES payroll_lines(id) NOT VALID;
ALTER TABLE payslip DROP CONSTRAINT IF EXISTS payslip_payroll_line_id_fkey;
ALTER TABLE payslip ADD CONSTRAINT payslip_payroll_line_id_fkey
  FOREIGN KEY (payroll_line_id) REFERENCES payroll_lines(id) NOT VALID;

-- user_account is the authenticated application identity. Historic UC-003
-- actor rows remain readable; all new actor references use authenticated IDs.
ALTER TABLE statutory_rate_sets DROP CONSTRAINT IF EXISTS statutory_rate_sets_created_by_fkey;
ALTER TABLE statutory_rate_sets ADD CONSTRAINT statutory_rate_sets_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_account(id) NOT VALID;
ALTER TABLE performance_inputs DROP CONSTRAINT IF EXISTS performance_inputs_created_by_fkey;
ALTER TABLE performance_inputs ADD CONSTRAINT performance_inputs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_account(id) NOT VALID;
ALTER TABLE performance_inputs DROP CONSTRAINT IF EXISTS performance_inputs_updated_by_fkey;
ALTER TABLE performance_inputs ADD CONSTRAINT performance_inputs_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES user_account(id) NOT VALID;
ALTER TABLE payroll_adjustments DROP CONSTRAINT IF EXISTS payroll_adjustments_created_by_fkey;
ALTER TABLE payroll_adjustments ADD CONSTRAINT payroll_adjustments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_account(id) NOT VALID;
ALTER TABLE payroll_adjustments DROP CONSTRAINT IF EXISTS payroll_adjustments_updated_by_fkey;
ALTER TABLE payroll_adjustments ADD CONSTRAINT payroll_adjustments_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES user_account(id) NOT VALID;
ALTER TABLE calculation_runs DROP CONSTRAINT IF EXISTS calculation_runs_run_by_fkey;
ALTER TABLE calculation_runs ADD CONSTRAINT calculation_runs_run_by_fkey
  FOREIGN KEY (run_by) REFERENCES user_account(id) NOT VALID;
ALTER TABLE uc003_audit_log DROP CONSTRAINT IF EXISTS uc003_audit_log_actor_id_fkey;
ALTER TABLE uc003_audit_log ADD CONSTRAINT uc003_audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES user_account(id) NOT VALID;

-- Payment workflow state belongs to payment_batch. A successfully completed
-- legacy period is normalized to the final shared period state.
UPDATE pay_period SET status = 'paid' WHERE status = 'payment_ready';
ALTER TABLE pay_period DROP CONSTRAINT IF EXISTS pay_period_status_check;
ALTER TABLE pay_period ADD CONSTRAINT pay_period_status_check
  CHECK (status IN ('draft', 'validated', 'calculated', 'pending_approval', 'approved', 'paid')) NOT VALID;

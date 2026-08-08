-- UC-002 validation support.
-- Extends the existing shared timesheet_exception table instead of creating
-- a second competing validation_flag table.

-- Missing-entry and weekly-cap findings are not tied to one timesheet row.
ALTER TABLE timesheet_exception
  ALTER COLUMN timesheet_id DROP NOT NULL;

ALTER TABLE timesheet_exception
  ADD COLUMN IF NOT EXISTS pay_period_id UUID REFERENCES pay_period(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS expected_value NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS actual_value NUMERIC(8,2);

-- Backfill the new foreign keys for any exception rows created before this migration.
UPDATE timesheet_exception e
SET pay_period_id = t.pay_period_id,
    staff_id = COALESCE(e.staff_id, t.staff_id)
FROM timesheet t
WHERE e.timesheet_id = t.id
  AND (e.pay_period_id IS NULL OR e.staff_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_timesheet_exception_period_status
  ON timesheet_exception(pay_period_id, status);

CREATE INDEX IF NOT EXISTS idx_timesheet_exception_staff
  ON timesheet_exception(staff_id);

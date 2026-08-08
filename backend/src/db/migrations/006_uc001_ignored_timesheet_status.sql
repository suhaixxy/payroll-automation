-- UC-001: allows managers to permanently ignore roster exceptions that
-- should not be included in draft timesheets or future exception lists.

ALTER TABLE timesheet DROP CONSTRAINT IF EXISTS timesheet_match_status_check;
ALTER TABLE timesheet ADD CONSTRAINT timesheet_match_status_check
  CHECK (match_status IN ('matched', 'unmatched', 'invalid_time', 'ignored'));
